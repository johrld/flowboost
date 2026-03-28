import type { LucideIcon } from "lucide-react";
import type { SourceStreamDef } from "@/lib/types";
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
  type: "text" | "password" | "url";
  placeholder?: string;
}

export interface ConnectorDef {
  id: string;
  name: string;
  category: ConnectorCategory;
  icon: LucideIcon;
  description: string;
  comingSoon: boolean;
  /** Key under ConnectorConfig where this connector's config lives */
  configKey?: string;
  /** Declarative config fields — rendered automatically in detail view */
  fields?: ConnectorFieldDef[];
  /** Whether this connector supports schema discovery */
  hasSchemaDiscovery?: boolean;
  /** Setup guide steps shown in the detail view sidebar */
  setupGuide?: string[];
  /** Source data streams this connector can provide */
  streams?: SourceStreamDef[];
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

// ── Connector Definitions ────────────────────────────────────────

export const CONNECTORS: ConnectorDef[] = [
  {
    id: "git", name: "Git Repository", category: "site", icon: GitBranch,
    description: "Push content to a Git repository", comingSoon: false,
    streams: [
      { id: "files", label: "File Inventory", dataType: "reference", defaultEnabled: true },
      { id: "articles", label: "Published Articles", dataType: "content", defaultEnabled: false },
      { id: "commits", label: "Commit Frequency", dataType: "metrics", defaultEnabled: false },
    ],
  },
  {
    id: "wordpress", name: "WordPress", category: "site", icon: Globe,
    description: "Publish directly via WordPress API", comingSoon: false,
    configKey: "wordpress", hasSchemaDiscovery: true,
    fields: [
      { key: "siteUrl", label: "Site URL", type: "url", placeholder: "https://my-site.com" },
      { key: "username", label: "Username", type: "text", placeholder: "WordPress username" },
      { key: "applicationPassword", label: "Application Password", type: "password", placeholder: "xxxx xxxx xxxx xxxx" },
    ],
    setupGuide: [
      "Go to WordPress Admin → Users → Profile",
      'Scroll to "Application Passwords"',
      'Enter a name (e.g. "FlowBoost") and click "Add New"',
      "Copy the generated password and paste it above",
    ],
    streams: [
      { id: "posts", label: "Blog Posts", dataType: "content", defaultEnabled: true },
      { id: "pages", label: "Pages", dataType: "content", defaultEnabled: false },
      { id: "categories", label: "Categories", dataType: "reference", defaultEnabled: true },
      { id: "comments", label: "Comments", dataType: "mixed", defaultEnabled: false },
    ],
  },
  { id: "webflow", name: "Webflow", category: "site", icon: Aperture, description: "Publish to Webflow CMS", comingSoon: true },
  {
    id: "shopware", name: "Shopware 6", category: "ecommerce", icon: ShoppingBag,
    description: "Read Shopping Experiences, write CMS slots", comingSoon: false,
    configKey: "shopware", hasSchemaDiscovery: true,
    fields: [
      { key: "shopUrl", label: "Shop URL", type: "url", placeholder: "https://my-shop.com" },
      { key: "clientId", label: "Client ID", type: "text", placeholder: "Integration Client ID" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Integration Client Secret" },
    ],
    setupGuide: [
      'Settings → System → Users & Permissions → Roles → New Role "FlowBoost"',
      "Permissions: Categories (View, Edit, Create), Shopping Experiences (View), Products (View), Media (View, Create)",
      "Settings → System → Integrations → Add Integration → assign role",
      "Copy Client ID and Client Secret (shown only once)",
    ],
    streams: [
      { id: "products", label: "Product Catalog", dataType: "reference", defaultEnabled: true },
      { id: "categories", label: "Category Tree", dataType: "reference", defaultEnabled: true },
      { id: "descriptions", label: "Product Descriptions", dataType: "content", defaultEnabled: false },
      { id: "reviews", label: "Customer Reviews", dataType: "mixed", defaultEnabled: false },
      { id: "sales", label: "Sales Statistics", dataType: "metrics", defaultEnabled: false },
    ],
  },
  { id: "shopify", name: "Shopify", category: "ecommerce", icon: ShoppingBag, description: "Publish to Shopify blog and pages", comingSoon: true },
  { id: "woocommerce", name: "WooCommerce", category: "ecommerce", icon: ShoppingBag, description: "Publish via WooCommerce REST API", comingSoon: true },
  {
    id: "listmonk", name: "Listmonk", category: "newsletter", icon: Radio,
    description: "Create newsletter drafts via Listmonk API", comingSoon: false,
    configKey: "listmonk",
    fields: [
      { key: "baseUrl", label: "Base URL", type: "url", placeholder: "https://newsletter.example.com" },
      { key: "username", label: "Username", type: "text", placeholder: "API username" },
      { key: "password", label: "Password", type: "password", placeholder: "API token or password" },
    ],
    setupGuide: [
      'Settings → User Roles → New → Name: "FlowBoost"',
      "Permissions: lists:get_all, campaigns:get, campaigns:manage, templates:get",
      "Settings → Users → New User → Type: API → Role: FlowBoost",
      "Copy username + API token (token shown only once)",
      "FlowBoost creates campaign drafts only — never sends automatically",
    ],
    streams: [
      { id: "lists", label: "Lists & Templates", dataType: "reference", defaultEnabled: true },
      { id: "campaigns", label: "Campaign Content", dataType: "content", defaultEnabled: false },
      { id: "open-rates", label: "Open / Click Rates", dataType: "metrics", defaultEnabled: false },
      { id: "bounces", label: "Bounce / Unsubscribe Rates", dataType: "metrics", defaultEnabled: false },
    ],
  },
  { id: "mailchimp", name: "Mailchimp", category: "newsletter", icon: Radio, description: "Create campaigns via Mailchimp API", comingSoon: true },
  { id: "linkedin", name: "LinkedIn", category: "social", icon: Linkedin, description: "Post to LinkedIn", comingSoon: true },
  { id: "instagram", name: "Instagram", category: "social", icon: Instagram, description: "Post to Instagram", comingSoon: true },
  { id: "tiktok", name: "TikTok", category: "social", icon: Music2, description: "Post to TikTok", comingSoon: true },
  { id: "x", name: "X (Twitter)", category: "social", icon: Radio, description: "Post to X", comingSoon: true },
  { id: "youtube", name: "YouTube", category: "media", icon: Video, description: "Upload to YouTube", comingSoon: true },
  { id: "spotify", name: "Spotify", category: "media", icon: Music2, description: "Publish to Spotify", comingSoon: true },
];

export const FRAMEWORKS: FrameworkDef[] = [
  { id: "astro", name: "Astro", contentPath: "src/content/posts", assetsPath: "src/assets/posts", categoriesPath: "src/data/categories.json", authorsPath: "src/data/authors.json", hint: "Requires Content Collections configured to match FlowBoost's frontmatter schema.", comingSoon: false },
  { id: "hugo", name: "Hugo", contentPath: "content/posts", assetsPath: "static/images", categoriesPath: "", authorsPath: "", hint: "Content must use Hugo's front matter format. Archetypes should match FlowBoost output.", comingSoon: true },
  { id: "nextjs", name: "Next.js", contentPath: "posts", assetsPath: "public/images", categoriesPath: "", authorsPath: "", hint: "MDX files with compatible frontmatter. Requires a content layer (e.g. Contentlayer, Velite).", comingSoon: true },
  { id: "custom", name: "Custom", contentPath: "", assetsPath: "", categoriesPath: "", authorsPath: "", hint: "Manually configure paths and ensure your project can process FlowBoost's markdown output.", comingSoon: true },
];

export const CATEGORY_LABELS: Record<ConnectorCategory, { title: string; description: string }> = {
  site: { title: "Site Delivery", description: "Publish articles, guides, and landing pages" },
  ecommerce: { title: "E-Commerce", description: "Connect shop platforms for content and product data" },
  newsletter: { title: "Newsletter", description: "Create and send email campaigns" },
  social: { title: "Social Channels", description: "Distribute social media posts" },
  media: { title: "Media Platforms", description: "Upload video and audio content" },
};
