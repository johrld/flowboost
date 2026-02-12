/**
 * Template Engine — separates content FORMAT from connector TRANSPORT.
 *
 * Template  = WAS gesendet wird (Format, Limits, Felder)
 * Connector = WIE gesendet wird (API Call, Auth, Upload)
 */

// ─── Site Templates ─────────────────────────────────────────────

export interface SiteTemplate {
  /** Transform universal content data into platform-specific file format. */
  transform(content: SiteContentData): TransformResult;

  /** Platform constraints for pre-transform validation. */
  constraints: SiteConstraints;
}

export interface SiteContentData {
  title: string;
  description: string;
  slug: string;
  lang: string;
  translationKey: string;
  translations?: Record<string, string>;
  markdown: string;
  publishedAt: string;
  updatedAt?: string;
  authorId: string;
  category: string;
  tags: string[];
  keywords: string[];
  pillar?: string;
  heroImage?: {
    localPath: string;
    alt: string;
  };
  faq?: Array<{ question: string; answer: string }>;
  contentPath: string;
  draft?: boolean;
}

export interface TransformResult {
  /** Fully formatted file content (Markdown, HTML, JSON, etc.) */
  content: string;
  /** Target file path relative to repo/CMS root */
  filePath: string;
  /** MIME type of the output */
  mimeType: string;
}

export interface SiteConstraints {
  contentFormat: "markdown" | "html" | "richtext";
  titleLength: { min: number; max: number };
  descriptionLength: { min: number; max: number };
  keywordsCount: { min: number; max: number };
  tagsCount: { min: number; max: number };
  frontmatterFormat?: "yaml" | "json";
}

// ─── Social Templates (Phase 4) ────────────────────────────────

export interface SocialTemplate {
  /** Transform universal content into platform-specific API payload. */
  transform(content: SocialContentData): Record<string, unknown>;

  /** Format text with hashtags according to platform rules. */
  formatText(text: string, hashtags: string[]): string;

  /** Platform constraints for validation. */
  constraints: SocialConstraints;
}

export interface SocialContentData {
  text: string;
  hashtags: string[];
  mentions: string[];
  media?: Array<{
    type: "image" | "video" | "document";
    url: string;
    mimeType: string;
    altText?: string;
  }>;
  linkUrl?: string;
  disclosure: {
    brandedContent: boolean;
    aiGenerated: boolean;
  };
}

export interface SocialConstraints {
  textMaxLength: number;
  hashtagsMax: number;
  mentionsMax: number;
  imageFormats: string[];
  imageMaxSize: number;
  videoFormats?: string[];
  videoMaxDuration?: number;
  videoMaxSize?: number;
}
