import type { ContentReader } from "../../services/sync.js";
import type { ContentItem, ContentVersion, LanguageVariant, Project } from "../../models/types.js";
import type { TransformResult } from "../templates/types.js";

// ─── Connector Schema (discovered from external platforms) ───

/**
 * A content structure that a platform supports.
 * Discovered via API (Shopware CMS layouts, WordPress ACF field groups, etc.)
 * or defined as built-in (LinkedIn post, Markdown article).
 */
export interface ConnectorSchema {
  /** Platform-internal identifier (Shopware layout UUID, ACF group key, etc.) */
  id: string;
  /** Human-readable name ("Branchen-Landingpage", "Blog Article Layout") */
  label: string;
  /** Optional description */
  description?: string;
  /** Content category */
  category: "site" | "social" | "email" | "media";
  /** Slots that need to be filled with content */
  slots: ConnectorSlot[];
}

/**
 * A single content slot within a connector schema.
 * Each slot represents one piece of content the platform expects.
 */
export interface ConnectorSlot {
  /** Slot identifier (e.g. "hero-text", "faq", "caption") */
  id: string;
  /** Human-readable label */
  label: string;
  /** Content type expected in this slot */
  type: "text" | "html" | "markdown" | "image" | "faq" | "cta" | "product-list" | "json";
  /** Whether this slot must be filled */
  required: boolean;
  /** Constraints for content generation */
  constraints?: {
    charLimit?: number;
    wordCount?: { min: number; max: number };
    imageAspectRatio?: string;
    maxItems?: number;
  };
}

// ─── Site Connector Interface ────────────────────────────────

/**
 * Universal Site Connector interface.
 *
 * Each platform (GitHub, WordPress, Shopware, Webflow) implements this.
 * The core never knows which platform it talks to.
 *
 * Workflow:
 *   1. createReader() → for Sync (read existing content)
 *   2. write()        → deliver content to platform
 *   3. publish()      → make content live (if write returned published=false)
 *
 * Optional schema discovery:
 *   4. discoverSchemas() → read available content structures from platform
 *   5. writeStructured() → deliver slot-based content
 */
export interface SiteConnector {
  readonly platform: string;

  /** Create a ContentReader for syncing content from this platform. */
  createReader(): ContentReader;

  /**
   * Discover content structures the platform supports.
   * Returns available schemas (layouts, templates, post types) that
   * FlowBoost can target when producing content.
   *
   * Optional — only implemented by connectors with API-accessible templates.
   * - Shopware: reads CMS layouts via Admin API
   * - WordPress+ACF: reads field groups via REST API
   * - GitHub/Filesystem: not implemented (uses built-in types)
   */
  discoverSchemas?(): Promise<ConnectorSchema[]>;

  /**
   * Write structured (slot-based) content to the platform.
   * Used when the connector has a schema and content was generated per-slot.
   *
   * Optional — connectors without schemas use write() with Markdown.
   */
  writeStructured?(
    project: Project,
    contentItem: ContentItem,
    version: ContentVersion,
    schema: ConnectorSchema,
  ): Promise<WriteResult>;

  /**
   * Write content to the platform.
   *
   * - GitHub: clone → branch → commit → push → PR (published=false)
   * - WordPress: POST /posts status=publish (published=true)
   * - Shopify: articleCreate (published=true)
   * - Webflow: POST /items as draft (published=false)
   */
  write(
    project: Project,
    contentItem: ContentItem,
    languages: LanguageVariant[],
    versionDir: string,
  ): Promise<WriteResult>;

  /**
   * Update existing content on the platform.
   *
   * - GitHub: clone → branch → commit → push → PR (update)
   * - WordPress: PUT /posts/{id}
   * - Shopify: articleUpdate
   * - Filesystem: overwrite files
   *
   * Optional — falls back to write() if not implemented.
   */
  update?(
    project: Project,
    contentItem: ContentItem,
    languages: LanguageVariant[],
    versionDir: string,
    previousRef?: string,
  ): Promise<WriteResult>;

  /**
   * Remove content from the platform.
   *
   * - GitHub: PR that deletes files
   * - WordPress: DELETE /posts/{id} or status=draft
   * - Shopify: articleDelete or published=false
   * - Filesystem: delete files
   *
   * Optional — not all platforms support unpublish.
   */
  unpublish?(ref: string, options?: { soft?: boolean }): Promise<UnpublishResult>;

  /**
   * Make content live. Only needed when write() returns published=false.
   *
   * - GitHub: merge PR + delete branch
   * - Webflow: POST /sites/{id}/publish
   * - WordPress/Shopify: no-op (already published on write)
   *
   * Optional — not all platforms need this.
   */
  publish?(writeRef: string): Promise<PublishResult>;
}

export interface WriteResult {
  success: boolean;
  /** Platform-specific reference (GitHub: PR number, WordPress: post ID, etc.) */
  ref: string;
  /** URL to the draft/PR/preview */
  url?: string;
  /** true if content is already live after write() */
  published: boolean;
  /** Files that were written (for git-based connectors) */
  filesWritten: string[];
  /** Git commit hash (git-based only) */
  commitHash?: string;
  error?: string;
}

export interface PublishResult {
  success: boolean;
  /** Final commit SHA or post ID after publishing */
  ref?: string;
  /** Live URL of the published content */
  url?: string;
  error?: string;
}

export interface UnpublishResult {
  success: boolean;
  /** Platform reference for the unpublish action */
  ref?: string;
  error?: string;
}
