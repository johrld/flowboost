import type { LucideIcon } from "lucide-react";
import {
  GitBranch,
  Globe,
  Aperture,
  ShoppingBag,
  Radio,
  Linkedin,
  Instagram,
  Music2,
  Video,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type ConnectorCategory = "site" | "ecommerce" | "newsletter" | "social" | "media";
export type Framework = "astro" | "hugo" | "nextjs" | "custom";

export interface ConnectorFieldDef {
  key: string;
  label: string;
  type: string;
  placeholder?: string;
}

/** ConnectorDef = backend metadata + frontend icon */
export interface ConnectorDef {
  id: string;
  name: string;
  category: string;
  icon: LucideIcon;
  description: string;
  comingSoon: boolean;
  configKey?: string;
  fields?: ConnectorFieldDef[];
  hasSchemaDiscovery?: boolean;
  setupGuide?: string[];
  streams?: Array<{ id: string; label: string; dataType: string; defaultEnabled: boolean }>;
}

export interface FrameworkDef {
  id: Framework;
  name: string;
  contentPath: string;
  assetsPath: string;
  categoriesPath: string;
  authorsPath: string;
  hint: string;
  comingSoon: boolean;
}

// ── Icon Mapping (only UI concern that can't come from backend) ──

export const CONNECTOR_ICONS: Record<string, LucideIcon> = {
  git: GitBranch,
  github: GitBranch,
  wordpress: Globe,
  webflow: Aperture,
  shopware: ShoppingBag,
  shopify: ShoppingBag,
  woocommerce: ShoppingBag,
  listmonk: Radio,
  mailchimp: Radio,
  linkedin: Linkedin,
  instagram: Instagram,
  tiktok: Music2,
  x: Radio,
  youtube: Video,
  spotify: Music2,
};

// ── Static Data (UI-only, can't come from backend) ───────────────

export const FRAMEWORKS: FrameworkDef[] = [
  { id: "astro", name: "Astro", contentPath: "src/content/posts", assetsPath: "src/assets/posts", categoriesPath: "src/data/categories.json", authorsPath: "src/data/authors.json", hint: "Requires Content Collections configured to match FlowBoost's frontmatter schema.", comingSoon: false },
  { id: "hugo", name: "Hugo", contentPath: "content/posts", assetsPath: "static/images", categoriesPath: "", authorsPath: "", hint: "Content must use Hugo's front matter format. Archetypes should match FlowBoost output.", comingSoon: true },
  { id: "nextjs", name: "Next.js", contentPath: "posts", assetsPath: "public/images", categoriesPath: "", authorsPath: "", hint: "MDX files with compatible frontmatter. Requires a content layer (e.g. Contentlayer, Velite).", comingSoon: true },
  { id: "custom", name: "Custom", contentPath: "", assetsPath: "", categoriesPath: "", authorsPath: "", hint: "Manually configure paths and ensure your project can process FlowBoost's markdown output.", comingSoon: true },
];

export const CATEGORY_LABELS: Record<string, { title: string; description: string }> = {
  site: { title: "Site Delivery", description: "Publish articles, guides, and landing pages" },
  ecommerce: { title: "E-Commerce", description: "Connect shop platforms for content and product data" },
  newsletter: { title: "Newsletter", description: "Create and send email campaigns" },
  social: { title: "Social Channels", description: "Distribute social media posts" },
  media: { title: "Media Platforms", description: "Upload video and audio content" },
};

/** Merge backend connector types with frontend icons → ConnectorDef[] */
export function mergeWithIcons(
  backendTypes: Array<{
    id: string; name: string; category: string; description: string; comingSoon: boolean;
    configKey?: string; fields?: ConnectorFieldDef[];
    hasSchemaDiscovery?: boolean; setupGuide?: string[];
    streams?: Array<{ id: string; label: string; dataType: string; defaultEnabled: boolean }>;
  }>,
): ConnectorDef[] {
  return backendTypes.map((t) => ({
    ...t,
    icon: CONNECTOR_ICONS[t.id] ?? Radio,
  }));
}
