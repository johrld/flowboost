import fs from "node:fs";
import path from "node:path";
import { createLogger } from "../utils/logger.js";
import type { MemoryMeta } from "./types.js";

const log = createLogger("memory");

/**
 * Project-level persistent memory store using PARA structure.
 * Stores flat JSON files in: data/customers/{cid}/projects/{pid}/memory/
 *
 * Unlike Store<T>, memory files are singletons per project (not entity-per-directory).
 * The PARA folders are:
 *   areas/     — ongoing domains (competitor-landscape, content-portfolio, brand-context)
 *   resources/ — reference material (citation-sources, topic-clusters, seo-guidelines, author-profiles)
 *   projects/  — active campaigns with deadlines
 *   archives/  — inactive/historical snapshots
 */
export class MemoryStore {
  private memoryDir: string;

  constructor(projectDir: string) {
    this.memoryDir = path.join(projectDir, "memory");
  }

  /** Ensure the memory directory structure exists */
  private ensureDir(subDir?: string): void {
    const dir = subDir ? path.join(this.memoryDir, subDir) : this.memoryDir;
    fs.mkdirSync(dir, { recursive: true });
  }

  /** Load a specific memory file. Path relative to memory dir (e.g., "areas/competitor-landscape.json") */
  load<T>(filePath: string): T | null {
    const fullPath = path.join(this.memoryDir, filePath);
    if (!fs.existsSync(fullPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as T;
    } catch (err) {
      log.warn({ filePath, err }, "failed to read memory file");
      return null;
    }
  }

  /** Save a memory file and update meta. Path relative to memory dir. */
  save<T>(filePath: string, data: T, agentName: string): void {
    const dir = path.dirname(path.join(this.memoryDir, filePath));
    fs.mkdirSync(dir, { recursive: true });
    const fullPath = path.join(this.memoryDir, filePath);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf-8");

    // Update meta
    const meta = this.getMeta();
    meta.lastUpdated[filePath] = new Date().toISOString();
    meta.lastRunBy[filePath] = agentName;
    this.saveMeta(meta);

    log.debug({ filePath, agentName }, "memory saved");
  }

  /** Load all memory files into a single object for prompt injection */
  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    this.walkDir(this.memoryDir, result, "");
    return result;
  }

  /** Get memory metadata (last-updated timestamps) */
  getMeta(): MemoryMeta {
    const metaPath = path.join(this.memoryDir, "meta.json");
    if (!fs.existsSync(metaPath)) {
      return { lastUpdated: {}, lastRunBy: {} };
    }
    try {
      return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as MemoryMeta;
    } catch {
      return { lastUpdated: {}, lastRunBy: {} };
    }
  }

  /** Check if a specific memory file exists */
  exists(filePath: string): boolean {
    return fs.existsSync(path.join(this.memoryDir, filePath));
  }

  /** Get the absolute path to the memory directory */
  getDir(): string {
    return this.memoryDir;
  }

  /** Load only HOT memory files for prompt injection (~4-6 KB) */
  getHotMemory(): Record<string, unknown> {
    const HOT_FILES = [
      "areas/competitors/_index.json",
      "areas/trend-watch.json",
      "areas/content-gaps.json",
    ];
    const result: Record<string, unknown> = {};
    for (const file of HOT_FILES) {
      const data = this.load(file);
      if (data) {
        const key = file.replace(/\.json$/, "").replace(/\//g, ".");
        result[key] = data;
      }
    }
    // Gap matrix: include summary only (not full cluster list)
    const gapMatrix = this.load<{ summary?: unknown; clusters?: Array<{ gapType: string; priority: string; cluster: string; recommendation: string }> }>("areas/competitors/_gap-matrix.json");
    if (gapMatrix) {
      result["areas.competitors._gap-matrix"] = {
        summary: gapMatrix.summary,
        topGaps: (gapMatrix.clusters ?? [])
          .filter((c) => c.gapType === "we_lag")
          .sort((a, b) => (a.priority === "high" ? -1 : 1))
          .slice(0, 10)
          .map((c) => ({ cluster: c.cluster, recommendation: c.recommendation })),
      };
    }
    return result;
  }

  /** List all memory files (relative paths) */
  listFiles(): string[] {
    const files: string[] = [];
    this.walkFiles(this.memoryDir, files, "");
    return files.filter((f) => f !== "meta.json");
  }

  private saveMeta(meta: MemoryMeta): void {
    this.ensureDir();
    fs.writeFileSync(
      path.join(this.memoryDir, "meta.json"),
      JSON.stringify(meta, null, 2),
      "utf-8",
    );
  }

  private walkDir(dir: string, result: Record<string, unknown>, prefix: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        this.walkDir(path.join(dir, entry.name), result, relPath);
      } else if (entry.name.endsWith(".json") && entry.name !== "meta.json") {
        try {
          const key = relPath.replace(/\.json$/, "").replace(/\//g, ".");
          result[key] = JSON.parse(fs.readFileSync(path.join(dir, entry.name), "utf-8"));
        } catch { /* skip corrupt files */ }
      }
    }
  }

  private walkFiles(dir: string, files: string[], prefix: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        this.walkFiles(path.join(dir, entry.name), files, relPath);
      } else if (entry.name.endsWith(".json")) {
        files.push(relPath);
      }
    }
  }
}
