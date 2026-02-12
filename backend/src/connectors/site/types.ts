import type { ContentReader } from "../../services/sync.js";
import type { Article, ArticleVersion, Project } from "../../models/types.js";
import type { TransformResult } from "../templates/types.js";

/**
 * Universal Site Connector interface.
 *
 * Each platform (GitHub, WordPress, Shopify, Webflow) implements this.
 * The core never knows which platform it talks to.
 *
 * Workflow:
 *   1. createReader() → for Sync (read existing content)
 *   2. write()        → deliver content to platform (may create draft or publish directly)
 *   3. publish()      → make content live (only if write() returned published=false)
 */
export interface SiteConnector {
  readonly platform: string;

  /** Create a ContentReader for syncing content from this platform. */
  createReader(): ContentReader;

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
    article: Article,
    versions: ArticleVersion[],
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
    article: Article,
    versions: ArticleVersion[],
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
