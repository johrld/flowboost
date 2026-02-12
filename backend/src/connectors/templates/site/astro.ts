import type { SiteTemplate, SiteContentData, TransformResult, SiteConstraints } from "../types.js";

/**
 * Astro template — Markdown with YAML frontmatter.
 * Used for Astro-based static sites (e.g. breathejourney.com).
 */

const constraints: SiteConstraints = {
  contentFormat: "markdown",
  titleLength: { min: 10, max: 70 },
  descriptionLength: { min: 50, max: 160 },
  keywordsCount: { min: 1, max: 10 },
  tagsCount: { min: 1, max: 5 },
  frontmatterFormat: "yaml",
};

function yamlValue(value: unknown): string {
  if (typeof value === "string") {
    // Quote strings that contain special YAML chars
    if (/[:{}\[\],&*?|>!%@`#]/.test(value) || value.includes('"')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return `"${value}"`;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return `"${String(value)}"`;
}

function buildFrontmatter(content: SiteContentData): string {
  const lines: string[] = [];

  lines.push(`title: ${yamlValue(content.title)}`);
  lines.push(`description: ${yamlValue(content.description)}`);
  lines.push(`pubDate: ${content.publishedAt}`);
  if (content.updatedAt) {
    lines.push(`updatedDate: ${content.updatedAt}`);
  }
  lines.push(`author: ${content.authorId}`);
  lines.push(`category: ${content.category}`);

  // Tags
  if (content.tags.length > 0) {
    lines.push("tags:");
    for (const tag of content.tags) {
      lines.push(`  - ${yamlValue(tag)}`);
    }
  }

  // Keywords
  if (content.keywords.length > 0) {
    lines.push("keywords:");
    for (const kw of content.keywords) {
      lines.push(`  - ${yamlValue(kw)}`);
    }
  }

  // Pillar reference
  if (content.pillar) {
    lines.push(`pillar: ${content.pillar}`);
  }

  lines.push(`lang: ${content.lang}`);
  lines.push(`translationKey: ${content.translationKey}`);

  // Translations
  if (content.translations && Object.keys(content.translations).length > 0) {
    lines.push("translations:");
    for (const [lang, slug] of Object.entries(content.translations)) {
      lines.push(`  ${lang}: ${yamlValue(slug)}`);
    }
  }

  // Hero image
  if (content.heroImage) {
    lines.push(`heroImage: ${yamlValue(content.heroImage.localPath)}`);
    lines.push(`heroAlt: ${yamlValue(content.heroImage.alt)}`);
  }

  // FAQ
  if (content.faq && content.faq.length > 0) {
    lines.push("faq:");
    for (const item of content.faq) {
      lines.push(`  - question: ${yamlValue(item.question)}`);
      lines.push(`    answer: ${yamlValue(item.answer)}`);
    }
  }

  lines.push(`draft: ${content.draft ?? false}`);

  return lines.join("\n");
}

function transform(content: SiteContentData): TransformResult {
  const frontmatter = buildFrontmatter(content);
  const fileContent = `---\n${frontmatter}\n---\n\n${content.markdown}`;

  return {
    content: fileContent,
    filePath: `${content.contentPath}/${content.lang}/${content.slug}.md`,
    mimeType: "text/markdown",
  };
}

export const astroTemplate: SiteTemplate = {
  constraints,
  transform,
};
