import type { SourceStreamDef } from "../models/types.js";
import { ShopwareSiteConnector } from "./site/shopware.js";
import { WordPressSiteConnector } from "./site/wordpress.js";
import { ListmonkConnector } from "./email/listmonk.js";

// ── Types ────────────────────────────────────────────────────────

export interface ConnectorFieldDef {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder?: string;
}

export type ConnectorCategory = "site" | "ecommerce" | "newsletter" | "social" | "media";

export interface ConnectorTypeDef {
  id: string;
  name: string;
  category: ConnectorCategory;
  description: string;
  comingSoon: boolean;
  /** Key under ConnectorConfig where credentials live */
  configKey?: string;
  /** Config fields needed for connection */
  fields?: ConnectorFieldDef[];
  /** Whether this connector supports schema discovery */
  hasSchemaDiscovery?: boolean;
  /** Setup guide steps */
  setupGuide?: string[];
  /** Available source data streams */
  streams?: SourceStreamDef[];
  /** Test function (if available) */
  test?: (config: Record<string, string>) => Promise<Record<string, unknown>>;
}

// ── Registry ─────────────────────────────────────────────────────

export const CONNECTOR_REGISTRY: ConnectorTypeDef[] = [
  {
    id: "git", name: "Git Repository", category: "site",
    description: "Push content to a Git repository", comingSoon: false,
    streams: [
      { id: "files", label: "File Inventory", dataType: "reference", defaultEnabled: true },
      { id: "articles", label: "Published Articles", dataType: "content", defaultEnabled: false },
      { id: "commits", label: "Commit Frequency", dataType: "metrics", defaultEnabled: false },
    ],
  },
  {
    id: "wordpress", name: "WordPress", category: "site",
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
    test: (config) => WordPressSiteConnector.testConnection(config),
  },
  {
    id: "webflow", name: "Webflow", category: "site",
    description: "Publish to Webflow CMS", comingSoon: true,
  },
  {
    id: "shopware", name: "Shopware 6", category: "ecommerce",
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
    test: (config) => ShopwareSiteConnector.testConnection(config),
  },
  {
    id: "shopify", name: "Shopify", category: "ecommerce",
    description: "Publish to Shopify blog and pages", comingSoon: true,
  },
  {
    id: "woocommerce", name: "WooCommerce", category: "ecommerce",
    description: "Publish via WooCommerce REST API", comingSoon: true,
  },
  {
    id: "listmonk", name: "Listmonk", category: "newsletter",
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
    test: async (config) => {
      if (!config.baseUrl || !config.username || !config.password) {
        return { success: false, error: "baseUrl, username, password are required" };
      }
      const connector = new ListmonkConnector({
        baseUrl: config.baseUrl.replace(/\/+$/, ""),
        username: config.username,
        password: config.password,
      });
      return connector.testConnection();
    },
  },
  { id: "mailchimp", name: "Mailchimp", category: "newsletter", description: "Create campaigns via Mailchimp API", comingSoon: true },
  { id: "linkedin", name: "LinkedIn", category: "social", description: "Post to LinkedIn", comingSoon: true },
  { id: "instagram", name: "Instagram", category: "social", description: "Post to Instagram", comingSoon: true },
  { id: "tiktok", name: "TikTok", category: "social", description: "Post to TikTok", comingSoon: true },
  { id: "x", name: "X (Twitter)", category: "social", description: "Post to X", comingSoon: true },
  { id: "youtube", name: "YouTube", category: "media", description: "Upload to YouTube", comingSoon: true },
  { id: "spotify", name: "Spotify", category: "media", description: "Publish to Spotify", comingSoon: true },
];

// ── Helpers ──────────────────────────────────────────────────────

/** Find a connector type definition by ID */
export function getConnectorTypeDef(id: string): ConnectorTypeDef | undefined {
  return CONNECTOR_REGISTRY.find((c) => c.id === id);
}

/** Get all connector type definitions (without test functions — safe for API response) */
export function getConnectorTypes(): Omit<ConnectorTypeDef, "test">[] {
  return CONNECTOR_REGISTRY.map(({ test: _test, ...rest }) => rest);
}

/** Get the test function for a connector type */
export function getConnectorTester(id: string): ConnectorTypeDef["test"] | undefined {
  return CONNECTOR_REGISTRY.find((c) => c.id === id)?.test;
}
