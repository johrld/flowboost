/**
 * MediaConnector — interface for video/audio platforms.
 *
 * Implementations (Phase 4):
 *   - YouTubeMediaConnector
 *   - VimeoMediaConnector
 *   - SpotifyMediaConnector
 *   - ApplePodcastsMediaConnector
 *   - SoundCloudMediaConnector
 */
export interface MediaConnector {
  readonly platform: string;

  /** Upload media file to the platform */
  upload(options: MediaUploadOptions): Promise<MediaUploadResult>;

  /** Update metadata (title, description, tags) without re-uploading */
  updateMetadata(platformId: string, metadata: MediaMetadataUpdate): Promise<MediaResult>;

  /** Replace the media file (new version) */
  replace(platformId: string, options: MediaUploadOptions): Promise<MediaUploadResult>;

  /** Change visibility (public, unlisted, private) */
  setVisibility(platformId: string, visibility: MediaVisibility): Promise<MediaResult>;

  /** Delete from platform */
  delete(platformId: string): Promise<MediaResult>;
}

export interface MediaUploadOptions {
  filePath: string;
  title: string;
  description: string;
  tags?: string[];
  visibility?: MediaVisibility;
  thumbnailPath?: string;
  language?: string;
  category?: string;
}

export type MediaVisibility = "public" | "unlisted" | "private" | "draft";

export interface MediaUploadResult {
  success: boolean;
  platformId?: string;
  url?: string;
  error?: string;
}

export interface MediaMetadataUpdate {
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  thumbnailPath?: string;
}

export interface MediaResult {
  success: boolean;
  error?: string;
}
