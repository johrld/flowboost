import { createLogger } from "../utils/logger.js";
import { ContentIndexStore } from "../models/content-index.js";
import type {
  ContentIndex,
  ContentIndexEntry,
  ContentRevision,
  Publication,
  SiteContentLangMeta,
} from "../models/types.js";

const log = createLogger("sync");

/**
 * Platform-agnostic Content Reader interface.
 * Each platform (GitHub, WordPress, Shopify, etc.) implements this.
 */
export interface ContentReader {
  getContentTree(): Promise<Map<string, { path: string; sha: string }>>;
  readFile(path: string): Promise<{ content: string; sha: string }>;
  readFiles(paths: string[]): Promise<Map<string, { content: string; sha: string }>>;
}

export interface SyncResult {
  added: string[];
  updated: string[];
  removed: string[];
  unchanged: number;
}

/**
 * Platform-agnostic sync service.
 * Compares remote content tree against local Content Index.
 */
export class SyncService {
  constructor(
    private indexStore: ContentIndexStore,
    private parseFrontmatter: (content: string, filePath: string) => SiteContentLangMeta,
  ) {}

  /**
   * Full sync — reads all remote files and rebuilds the index.
   */
  async fullSync(
    customerId: string,
    projectId: string,
    reader: ContentReader,
  ): Promise<SyncResult> {
    let index = await this.indexStore.load(customerId, projectId);
    const tree = await reader.getContentTree();
    const allPaths = [...tree.keys()];

    if (allPaths.length === 0) {
      log.info({ customerId, projectId }, "no content files found");
      return { added: [], updated: [], removed: [], unchanged: 0 };
    }

    // Read all files
    const files = await reader.readFiles(allPaths);

    const result: SyncResult = { added: [], updated: [], removed: [], unchanged: 0 };
    const seenTranslationKeys = new Set<string>();

    // Group files by translation key
    const grouped = this.groupByTranslationKey(files);

    for (const [translationKey, { langFiles, rawContent }] of grouped) {
      seenTranslationKeys.add(translationKey);

      const existing = this.indexStore.getByTranslationKey(index, translationKey);

      if (!existing) {
        // New content (external)
        const entry = this.createEntry(translationKey, langFiles, rawContent, "external", "live");
        index = this.indexStore.upsertEntry(index, entry);
        result.added.push(translationKey);
        log.info({ translationKey }, "new external content detected");
      } else {
        // Check if any language version changed
        const changed = this.hasChanges(existing, langFiles);
        // Always update metadata (category/tags/keywords) — may have been missing from older syncs
        const metadataChanged = this.updateEntryMetadata(existing, rawContent);
        if (changed || metadataChanged) {
          const updatedEntry = this.updateEntryLanguages(
            metadataChanged ? metadataChanged : existing,
            langFiles,
          );
          index = this.indexStore.upsertEntry(index, updatedEntry);
          if (changed) result.updated.push(translationKey);
          else result.unchanged++;
        } else {
          result.unchanged++;
        }
      }
    }

    // Detect removals (entries in index but not in remote tree)
    for (const entry of index.entries) {
      if (
        entry.channel === "website" &&
        entry.site?.translationKey &&
        !seenTranslationKeys.has(entry.site.translationKey)
      ) {
        // Only mark external content as removed, FlowBoost content might be in-progress
        if (entry.source === "external" && entry.status === "live") {
          index = this.indexStore.updateStatus(index, entry.id, "archived");
          result.removed.push(entry.site.translationKey);
        }
      }
    }

    index.lastSyncedAt = new Date().toISOString();
    await this.indexStore.save(customerId, projectId, index);

    log.info(
      { customerId, projectId, ...result },
      "full sync complete",
    );

    return result;
  }

  /**
   * Delta sync — only reads files where SHA changed.
   */
  async deltaSync(
    customerId: string,
    projectId: string,
    reader: ContentReader,
  ): Promise<SyncResult> {
    let index = await this.indexStore.load(customerId, projectId);
    const tree = await reader.getContentTree();

    // Build SHA map from current index
    const indexShaMap = new Map<string, string>();
    for (const entry of index.entries) {
      if (entry.site?.languages) {
        for (const langMeta of entry.site.languages) {
          indexShaMap.set(langMeta.filePath, langMeta.sha);
        }
      }
    }

    // Find changed/new files (SHA differs or file is new)
    const changedPaths: string[] = [];
    const newPaths: string[] = [];

    for (const [filePath, { sha }] of tree) {
      const existingSha = indexShaMap.get(filePath);
      if (!existingSha) {
        newPaths.push(filePath);
      } else if (existingSha !== sha) {
        changedPaths.push(filePath);
      }
    }

    if (changedPaths.length === 0 && newPaths.length === 0) {
      index.lastSyncedAt = new Date().toISOString();
      await this.indexStore.save(customerId, projectId, index);
      return { added: [], updated: [], removed: [], unchanged: tree.size };
    }

    // Read only changed/new files
    const pathsToRead = [...changedPaths, ...newPaths];
    const files = await reader.readFiles(pathsToRead);

    const result: SyncResult = {
      added: [],
      updated: [],
      removed: [],
      unchanged: tree.size - pathsToRead.length,
    };

    const grouped = this.groupByTranslationKey(files);

    for (const [translationKey, { langFiles, rawContent }] of grouped) {
      const existing = this.indexStore.getByTranslationKey(index, translationKey);

      if (!existing) {
        const entry = this.createEntry(translationKey, langFiles, rawContent, "external", "live");
        index = this.indexStore.upsertEntry(index, entry);
        result.added.push(translationKey);
      } else {
        const updatedEntry = this.updateEntryLanguages(existing, langFiles);
        index = this.indexStore.upsertEntry(index, updatedEntry);
        result.updated.push(translationKey);
      }
    }

    index.lastSyncedAt = new Date().toISOString();
    await this.indexStore.save(customerId, projectId, index);

    log.info(
      { customerId, projectId, ...result },
      "delta sync complete",
    );

    return result;
  }

  /**
   * Record a FlowBoost delivery (after push/PR).
   * Updates index without API call — we already know the data.
   */
  async recordDelivery(
    customerId: string,
    projectId: string,
    contentId: string,
    publication: Publication,
    langMetas: SiteContentLangMeta[],
  ): Promise<void> {
    let index = await this.indexStore.load(customerId, projectId);

    const entry = this.indexStore.getById(index, contentId);
    if (entry) {
      // Update existing entry
      const updatedEntry: ContentIndexEntry = {
        ...entry,
        lastUpdatedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        site: entry.site
          ? { ...entry.site, languages: langMetas }
          : undefined,
      };
      index = this.indexStore.upsertEntry(index, updatedEntry);
      index = this.indexStore.addPublication(index, contentId, publication);
    }

    await this.indexStore.save(customerId, projectId, index);
    log.info({ customerId, projectId, contentId }, "delivery recorded");
  }

  // ─── Helpers ────────────────────────────────────────────────

  private groupByTranslationKey(
    files: Map<string, { content: string; sha: string }>,
  ): Map<string, { langFiles: SiteContentLangMeta[]; rawContent: string }> {
    const grouped = new Map<string, { langFiles: SiteContentLangMeta[]; rawContent: string }>();

    for (const [filePath, { content, sha }] of files) {
      try {
        const langMeta = this.parseFrontmatter(content, filePath);
        langMeta.sha = sha;

        // Extract translationKey from frontmatter, fallback to slug
        const translationKey = this.extractTranslationKey(content) ?? langMeta.slug;

        if (!grouped.has(translationKey)) {
          grouped.set(translationKey, { langFiles: [], rawContent: content });
        }
        grouped.get(translationKey)!.langFiles.push(langMeta);
      } catch (err) {
        log.warn({ filePath, err }, "failed to parse frontmatter");
      }
    }

    return grouped;
  }

  private extractTranslationKey(content: string): string | undefined {
    const match = content.match(/^translationKey:\s*(.+)$/m);
    if (!match) return undefined;
    return match[1].trim().replace(/^["']|["']$/g, "");
  }

  private createEntry(
    translationKey: string,
    langFiles: SiteContentLangMeta[],
    rawContent: string,
    source: "flowboost" | "external",
    status: "planned" | "producing" | "review" | "delivered" | "live" | "archived",
  ): ContentIndexEntry {
    const category = this.extractFrontmatterField(rawContent, "category");
    const tagsRaw = this.extractFrontmatterList(rawContent, "tags");
    const keywordsRaw = this.extractFrontmatterList(rawContent, "keywords");

    return {
      id: crypto.randomUUID(),
      channel: "website",
      source,
      status,
      site: {
        type: "blog",
        translationKey,
        languages: langFiles,
        category: category ?? undefined,
        tags: tagsRaw.length > 0 ? tagsRaw : undefined,
        keywords: keywordsRaw.length > 0 ? keywordsRaw : undefined,
      },
      createdAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      firstPublishedAt: status === "live" ? new Date().toISOString() : undefined,
      publications: [],
    };
  }

  private updateEntryLanguages(
    existing: ContentIndexEntry,
    langFiles: SiteContentLangMeta[],
  ): ContentIndexEntry {
    if (!existing.site) return existing;

    // Merge: update existing languages, add new ones
    const existingLangs = new Map(
      existing.site.languages.map((l) => [l.lang, l]),
    );

    for (const langFile of langFiles) {
      existingLangs.set(langFile.lang, langFile);
    }

    return {
      ...existing,
      lastUpdatedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      site: {
        ...existing.site,
        languages: [...existingLangs.values()],
      },
    };
  }

  /** Returns updated entry if metadata was missing/changed, null otherwise. */
  private updateEntryMetadata(
    existing: ContentIndexEntry,
    rawContent: string,
  ): ContentIndexEntry | null {
    if (!existing.site) return null;

    const category = this.extractFrontmatterField(rawContent, "category");
    const tags = this.extractFrontmatterList(rawContent, "tags");
    const keywords = this.extractFrontmatterList(rawContent, "keywords");

    const catChanged = (category ?? undefined) !== existing.site.category;
    const tagsChanged = JSON.stringify(tags) !== JSON.stringify(existing.site.tags ?? []);
    const kwChanged = JSON.stringify(keywords) !== JSON.stringify(existing.site.keywords ?? []);

    if (!catChanged && !tagsChanged && !kwChanged) return null;

    return {
      ...existing,
      site: {
        ...existing.site,
        category: category ?? undefined,
        tags: tags.length > 0 ? tags : undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
      },
    };
  }

  private hasChanges(
    existing: ContentIndexEntry,
    langFiles: SiteContentLangMeta[],
  ): boolean {
    if (!existing.site) return true;

    const existingShas = new Map(
      existing.site.languages.map((l) => [l.filePath, l.sha]),
    );

    for (const langFile of langFiles) {
      const existingSha = existingShas.get(langFile.filePath);
      if (!existingSha || existingSha !== langFile.sha) return true;
    }

    return false;
  }

  private extractFrontmatterField(content: string, field: string): string | null {
    const match = content.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
    if (!match) return null;
    return match[1].trim().replace(/^["']|["']$/g, "");
  }

  /** Extract a YAML list field (e.g. tags, keywords) from frontmatter. */
  private extractFrontmatterList(content: string, field: string): string[] {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return [];
    const fm = fmMatch[1];
    const listMatch = fm.match(new RegExp(`^${field}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`, "m"));
    if (!listMatch) return [];
    return listMatch[1]
      .split("\n")
      .map((line) => line.replace(/^\s+-\s+/, "").trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
}
