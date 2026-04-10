#!/usr/bin/env npx tsx
/**
 * Standalone MCP server over stdio for FlowBoost tools.
 * Launched by Claude Code CLI as a child process.
 *
 * Usage: npx tsx src/tools/mcp-stdio-server.ts
 * Env:   FLOWBOOST_DATA_DIR (required) - path to data directory
 */
import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  validateArticle,
  validateSection,
  assembleArticle,
  type SectionType,
} from "../utils/markdown.js";

const dataDir = process.env.FLOWBOOST_DATA_DIR;
const projectDir = process.env.FLOWBOOST_PROJECT_DIR;
const customerDir = process.env.FLOWBOOST_CUSTOMER_DIR;
if (!dataDir) {
  process.stderr.write("FLOWBOOST_DATA_DIR not set\n");
  process.exit(1);
}

const server = new McpServer({ name: "flowboost", version: "0.1.0" });

// ── Tool 1: Validate Section ─────────────────────────────────────

server.tool(
  "flowboost_validate_section",
  "Validate a content section file against type-specific rules. Returns pass/fail with metrics and issues.",
  {
    path: z.string().describe("Absolute path to the section file"),
    type: z.enum(["introduction", "h2_section", "conclusion", "faq", "meta"]).describe("Section type"),
    targetWords: z.number().optional().describe("Target word count for h2_section type"),
  },
  async (args) => {
    if (!fs.existsSync(args.path)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `File not found: ${args.path}` }) }] };
    }
    const content = fs.readFileSync(args.path, "utf-8");
    const result = validateSection(content, args.type as SectionType, args.targetWords);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Tool 2: Validate Article ─────────────────────────────────────

server.tool(
  "flowboost_validate_article",
  "Validate a complete markdown article. Checks word count, paragraphs, H2 structure, FAQ, internal links, and answer capsule.",
  {
    path: z.string().describe("Absolute path to the markdown article file"),
  },
  async (args) => {
    if (!fs.existsSync(args.path)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `File not found: ${args.path}` }) }] };
    }
    const content = fs.readFileSync(args.path, "utf-8");
    const result = validateArticle(content);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Tool 3: Assemble Article ─────────────────────────────────────

server.tool(
  "flowboost_assemble_article",
  "Assemble individual section files (meta.yaml, intro.md, section-*.md, conclusion.md, faq.yaml) into a complete markdown article.",
  {
    scratchpadDir: z.string().describe("Directory containing the section files"),
    outputPath: z.string().describe("Path where the assembled article will be written"),
  },
  async (args) => {
    const result = assembleArticle(args.scratchpadDir, args.outputPath);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Tool 4: Generate Image ───────────────────────────────────────

server.tool(
  "flowboost_generate_image",
  "Generate an image using Google Imagen 4 Fast API. Returns the saved file path. Costs ~$0.02 per image.",
  {
    prompt: z.string().describe("English image generation prompt (detailed scene description)"),
    outputPath: z.string().describe("Absolute path where the PNG will be saved"),
    aspectRatio: z.enum(["16:9", "1:1", "9:16", "4:3", "3:4"]).default("16:9").describe("Image aspect ratio"),
  },
  async (args) => {
    try {
      const { generateImageBuffer } = await import("../services/imagen.js");
      const buffer = await generateImageBuffer(args.prompt, { aspectRatio: args.aspectRatio });

      fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
      fs.writeFileSync(args.outputPath, buffer);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ success: true, path: args.outputPath, sizeKb: Math.round(buffer.length / 1024) }),
        }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
    }
  },
);

// ── Tool 5: Read Project Data ────────────────────────────────────

server.tool(
  "flowboost_read_project_data",
  "Read project configuration, brand voice, style guide, SEO guidelines, templates, section specs, or other project resources. Brand voice and style guide use fallback: project-level > customer-level.",
  {
    resource: z.string().describe("Resource to read: project, brand-voice, style-guide, seo-guidelines, content-types, content-plan, template:<name>, section-spec:<name>"),
  },
  async (args) => {
    if (!projectDir) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "FLOWBOOST_PROJECT_DIR not set" }) }] };
    }

    const resourceMap: Record<string, string> = {
      project: "project.json",
      "seo-guidelines": "seo-guidelines.md",
      "seo-ai-strategy": "seo-ai-strategy.md",
      "content-types": "content-types.md",
      "content-plan": "content-plan.json",
    };

    // Resources with customer-level fallback
    const fallbackResources = ["brand-voice", "style-guide"];

    let filePath: string | undefined;
    const resource = args.resource;

    if (resource.startsWith("template:")) {
      filePath = path.join(projectDir, "templates", `${resource.slice(9)}.md`);
    } else if (resource.startsWith("section-spec:")) {
      filePath = path.join(projectDir, "section-specs", `${resource.slice(13)}.md`);
    } else if (fallbackResources.includes(resource)) {
      // Try project-level first, then customer-level
      const fileName = `${resource}.md`;
      const projectPath = path.join(projectDir, fileName);
      const customerPath = customerDir ? path.join(customerDir, fileName) : null;

      if (fs.existsSync(projectPath)) {
        filePath = projectPath;
      } else if (customerPath && fs.existsSync(customerPath)) {
        filePath = customerPath;
      } else {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Resource not found: ${resource} (checked project and customer level)` }) }] };
      }
    } else if (resourceMap[resource]) {
      filePath = path.join(projectDir, resourceMap[resource]);
    } else {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown resource: ${resource}` }) }] };
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Resource not found: ${filePath ?? resource}` }) }] };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const isJson = filePath.endsWith(".json");

    return {
      content: [{
        type: "text" as const,
        text: isJson ? content : JSON.stringify({ resource, content }),
      }],
    };
  },
);

// ── Tool 6: Read Content Index ───────────────────────────────────

server.tool(
  "flowboost_read_content_index",
  "Read the project's content index — all published and in-progress articles with metadata (title, category, language, keywords, word count). Use this to understand what content already exists.",
  {
    status: z.string().optional().describe("Filter by status: live, archived, planned, producing, review, delivered"),
    channel: z.string().optional().describe("Filter by channel: website, social"),
  },
  async (args) => {
    if (!projectDir) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "FLOWBOOST_PROJECT_DIR not set" }) }] };
    }
    const indexPath = path.join(projectDir, "content-index.json");
    if (!fs.existsSync(indexPath)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ entries: [], total: 0 }) }] };
    }
    const index = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as {
      lastSyncedAt?: string;
      entries?: Array<{ status?: string; channel?: string }>;
    };
    let entries = index.entries ?? [];
    if (args.status) entries = entries.filter((e) => e.status === args.status);
    if (args.channel) entries = entries.filter((e) => e.channel === args.channel);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ total: entries.length, lastSyncedAt: index.lastSyncedAt, entries }),
      }],
    };
  },
);

// ── Tool 7: Read Article via GitHub API ─────────────────────────

server.tool(
  "flowboost_read_article",
  "Read the full markdown content of a specific article from the repository via GitHub API. Use sparingly — for most tasks, the content index metadata is sufficient.",
  {
    filePath: z.string().describe("File path within the repo (e.g. src/content/posts/de/article-slug.md)"),
  },
  async (args) => {
    if (!projectDir) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "FLOWBOOST_PROJECT_DIR not set" }) }] };
    }

    // Load project config for GitHub connector
    const projectPath = path.join(projectDir, "project.json");
    if (!fs.existsSync(projectPath)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "project.json not found" }) }] };
    }

    const project = JSON.parse(fs.readFileSync(projectPath, "utf-8")) as {
      connector?: {
        type?: string;
        github?: { installationId: number; owner: string; repo: string; branch: string };
      };
    };
    const connectors = (project as { connectors?: Array<{ type: string; github?: { installationId: number; owner: string; repo: string; branch: string } }> }).connectors ?? [];
    const ghConn = connectors.find((c) => c.type === "github");
    const gh = ghConn?.github ?? project.connector?.github;
    if (!gh) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No GitHub connector configured" }) }] };
    }

    try {
      // Dynamic import to avoid hard dependency — github.ts uses env vars for auth
      const { getFileContent } = await import("../services/github.js");
      const content = await getFileContent(gh.installationId, gh.owner, gh.repo, args.filePath, gh.branch);
      return { content: [{ type: "text" as const, text: content }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Failed to read article: ${msg}` }) }] };
    }
  },
);

// ── Tool 8: Validate Social Post ─────────────────────────────────

const SOCIAL_SPECS: Record<string, { charLimit: number; hashtagLimit: number; mediaRequired: boolean }> = {
  linkedin: { charLimit: 3000, hashtagLimit: 5, mediaRequired: false },
  x: { charLimit: 280, hashtagLimit: 3, mediaRequired: false },
  instagram: { charLimit: 2200, hashtagLimit: 30, mediaRequired: true },
  tiktok: { charLimit: 4000, hashtagLimit: 5, mediaRequired: true },
};

server.tool(
  "flowboost_validate_social_post",
  "Validate a social media post against platform-specific rules (character limit, hashtag count, media requirements).",
  {
    platform: z.enum(["linkedin", "x", "instagram", "tiktok"]).describe("Target platform"),
    text: z.string().describe("Post text content"),
    hashtagCount: z.number().optional().describe("Number of hashtags"),
    hasMedia: z.boolean().optional().describe("Whether the post includes media"),
  },
  async (args) => {
    const spec = SOCIAL_SPECS[args.platform];
    if (!spec) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown platform: ${args.platform}` }) }] };
    }

    const issues: string[] = [];
    const charCount = args.text.length;

    if (charCount > spec.charLimit) {
      issues.push(`Text exceeds ${args.platform} limit: ${charCount}/${spec.charLimit} characters`);
    }
    if (args.hashtagCount !== undefined && args.hashtagCount > spec.hashtagLimit) {
      issues.push(`Too many hashtags: ${args.hashtagCount}/${spec.hashtagLimit}`);
    }
    if (spec.mediaRequired && !args.hasMedia) {
      issues.push(`${args.platform} requires media (image or video)`);
    }

    const pass = issues.length === 0;
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ pass, platform: args.platform, charCount, charLimit: spec.charLimit, issues }),
      }],
    };
  },
);

// ── Tool 9: Validate Newsletter ──────────────────────────────────

server.tool(
  "flowboost_validate_newsletter",
  "Validate a newsletter structure (subject length, preview text, section count).",
  {
    subject: z.string().describe("Email subject line"),
    previewText: z.string().optional().describe("Preview text shown in inbox"),
    sectionCount: z.number().optional().describe("Number of content sections"),
    wordCount: z.number().optional().describe("Total word count"),
  },
  async (args) => {
    const issues: string[] = [];

    if (args.subject.length < 10) issues.push("Subject too short (min 10 characters)");
    if (args.subject.length > 80) issues.push(`Subject too long: ${args.subject.length}/80 characters`);
    if (args.previewText && args.previewText.length > 150) {
      issues.push(`Preview text too long: ${args.previewText.length}/150 characters`);
    }
    if (args.sectionCount !== undefined && args.sectionCount < 1) {
      issues.push("Newsletter must have at least 1 section");
    }
    if (args.wordCount !== undefined && args.wordCount < 50) {
      issues.push("Newsletter too short (min 50 words)");
    }

    const pass = issues.length === 0;
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ pass, subjectLength: args.subject.length, issues }),
      }],
    };
  },
);

// ── Tool: Read Memory ───────────────────────────────────────────

server.tool(
  "flowboost_read_memory",
  "Read project memory (competitor state, content gaps, trends, topic clusters, citation sources). Use resource='all' to get everything.",
  {
    resource: z.string().describe("Memory file path relative to memory/ dir (e.g., 'areas/competitor-landscape.json') or 'all' for everything"),
  },
  async (args) => {
    if (!projectDir) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No project context" }) }] };
    }
    const memoryDir = path.join(projectDir, "memory");

    if (args.resource === "all") {
      // Load all memory files
      const result: Record<string, unknown> = {};
      if (fs.existsSync(memoryDir)) {
        walkMemory(memoryDir, result, "");
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }

    const filePath = path.join(memoryDir, args.resource);
    if (!fs.existsSync(filePath)) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Memory file not found: ${args.resource}` }) }] };
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ── Tool: Write Memory ──────────────────────────────────────────

server.tool(
  "flowboost_write_memory",
  "Write/update a project memory file. Used by background monitor agents to persist knowledge.",
  {
    resource: z.string().describe("Memory file path relative to memory/ dir (e.g., 'areas/competitor-landscape.json')"),
    data: z.string().describe("JSON string of the memory data to write"),
    agentName: z.string().describe("Name of the agent writing this memory"),
  },
  async (args) => {
    if (!projectDir) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No project context" }) }] };
    }

    const memoryDir = path.join(projectDir, "memory");
    const filePath = path.join(memoryDir, args.resource);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    let parsed: unknown;
    try {
      parsed = JSON.parse(args.data);
    } catch {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid JSON data" }) }] };
    }

    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), "utf-8");

    // Update meta
    const metaPath = path.join(memoryDir, "meta.json");
    let meta = { lastUpdated: {} as Record<string, string>, lastRunBy: {} as Record<string, string> };
    if (fs.existsSync(metaPath)) {
      try { meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")); } catch { /* use default */ }
    }
    meta.lastUpdated[args.resource] = new Date().toISOString();
    meta.lastRunBy[args.resource] = args.agentName;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");

    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, resource: args.resource }) }] };
  },
);

/** Helper: recursively walk memory directory and build a flat object */
function walkMemory(dir: string, result: Record<string, unknown>, prefix: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      walkMemory(path.join(dir, entry.name), result, relPath);
    } else if (entry.name.endsWith(".json") && entry.name !== "meta.json") {
      try {
        const key = relPath.replace(/\.json$/, "").replace(/\//g, ".");
        result[key] = JSON.parse(fs.readFileSync(path.join(dir, entry.name), "utf-8"));
      } catch { /* skip corrupt files */ }
    }
  }
}

// ── Start server ─────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
