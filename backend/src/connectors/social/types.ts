/**
 * SocialConnector — interface for social media platforms.
 *
 * Implementations (Phase 5):
 *   - LinkedInSocialConnector
 *   - InstagramSocialConnector
 *   - TikTokSocialConnector
 *   - XSocialConnector (Twitter)
 *   - FacebookSocialConnector
 */
export interface SocialConnector {
  readonly platform: string;

  /** Publish a post immediately */
  publish(post: SocialPost): Promise<SocialPublishResult>;

  /** Schedule a post for later */
  schedule(post: SocialPost, scheduledAt: string): Promise<SocialPublishResult>;

  /** Delete a published post */
  delete(platformPostId: string): Promise<SocialResult>;

  /** Get post metrics (likes, shares, comments) */
  getMetrics?(platformPostId: string): Promise<SocialMetrics>;
}

export interface SocialPost {
  text: string;
  mediaUrls?: string[];
  mediaType?: "image" | "video" | "carousel";
  hashtags?: string[];
  mentions?: string[];
  linkUrl?: string;
  altText?: string;
}

export interface SocialPublishResult {
  success: boolean;
  platformPostId?: string;
  url?: string;
  scheduledAt?: string;
  error?: string;
}

export interface SocialResult {
  success: boolean;
  error?: string;
}

export interface SocialMetrics {
  likes: number;
  shares: number;
  comments: number;
  impressions?: number;
  clicks?: number;
  engagement?: number;
  fetchedAt: string;
}
