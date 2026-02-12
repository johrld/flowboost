import type { SiteContentLangMeta } from "../models/types.js";

/**
 * Parse frontmatter from a Markdown file to extract SiteContentLangMeta.
 * Simple regex-based parser (no yaml dependency needed for basic fields).
 */
export function parseFrontmatter(
  content: string,
  filePath: string,
): SiteContentLangMeta {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = fmMatch ? fmMatch[1] : "";
  const body = content.replace(/^---[\s\S]*?---\n*/, "");

  const title = extractField(frontmatter, "title") ?? "";
  const description = extractField(frontmatter, "description") ?? "";
  const lang = extractField(frontmatter, "lang") ?? extractLangFromPath(filePath);
  const slug = extractSlugFromPath(filePath);
  const wordCount = countWords(body);

  return {
    lang,
    slug,
    title,
    description,
    wordCount,
    filePath,
    sha: "", // Filled by caller
  };
}

function extractField(frontmatter: string, field: string): string | null {
  const regex = new RegExp(`^${field}:\\s*["']?(.+?)["']?\\s*$`, "m");
  const match = frontmatter.match(regex);
  return match ? match[1] : null;
}

function extractLangFromPath(filePath: string): string {
  // Paths like src/content/posts/de/slug.md → extract "de"
  const parts = filePath.split("/");
  // Find the language segment (2-3 letter code before the filename)
  for (let i = parts.length - 2; i >= 0; i--) {
    if (/^[a-z]{2,3}$/.test(parts[i])) {
      return parts[i];
    }
  }
  return "de";
}

function extractSlugFromPath(filePath: string): string {
  const parts = filePath.split("/");
  const filename = parts[parts.length - 1];
  return filename.replace(/\.md$/, "");
}

function countWords(text: string): number {
  // Strip markdown syntax
  const plain = text
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`[^`]*`/g, "") // inline code
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[([^\]]*)\]\(.*?\)/g, "$1") // links
    .replace(/#{1,6}\s*/g, "") // headings
    .replace(/[*_~]+/g, "") // emphasis
    .replace(/>\s*/g, "") // blockquotes
    .replace(/[-*+]\s+/g, "") // list markers
    .replace(/\d+\.\s+/g, "") // ordered list markers
    .trim();

  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}
