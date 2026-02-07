import fs from "node:fs";
import path from "node:path";

// ─── Shared Helpers ─────────────────────────────────────────────

export function countWords(text: string): number {
  const cleaned = text
    .replace(/^#+\s+.*$/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/>\s+/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
  return cleaned.split(/\s+/).filter((w) => w.length > 0).length;
}

export function countParagraphs(text: string): number {
  const cleaned = text
    .replace(/^#+\s+.*$/gm, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*[-*]\s+.*$/gm, "")
    .replace(/^\s*\d+\.\s+.*$/gm, "")
    .replace(/^>\s+.*$/gm, "");
  return cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.split(/\s+/).length >= 5).length;
}

function parseMarkdown(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = match ? match[1] : "";
  const body = match ? content.slice(match[0].length).trim() : content;
  return { frontmatter, body };
}

// ─── Article Validation (port of content-metrics.js) ────────────

const ARTICLE_CONFIG = {
  minWords: 1200,
  maxWords: 2500,
  minParagraphs: 15,
  minParagraphsPerH2: 3,
  minH2Count: 4,
  maxH2Count: 7,
  minFaqCount: 3,
  minInternalLinks: 2,
};

export interface ValidationIssue {
  type: string;
  severity: "error" | "warning";
  message: string;
  actual?: number;
  minimum?: number;
  maximum?: number;
  section?: string;
}

export interface H2Section {
  title: string;
  words: number;
  paragraphs: number;
}

export interface ArticleValidation {
  pass: boolean;
  metrics: {
    wordCount: number;
    paragraphCount: number;
    h2Count: number;
    faqCount: number;
    internalLinks: number;
    hasAnswerCapsule: boolean;
  };
  h2Sections: H2Section[];
  issues: ValidationIssue[];
  summary: string;
}

function analyzeH2Sections(text: string): H2Section[] {
  const sections: H2Section[] = [];
  const matches = [...text.matchAll(/^##\s+(.+)$/gm)];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + matches[i][0].length;
    const end = matches[i + 1]?.index ?? text.length;
    const content = text.slice(start, end);
    sections.push({
      title: matches[i][1].trim(),
      words: countWords(content),
      paragraphs: countParagraphs(content),
    });
  }
  return sections;
}

function countFaqs(frontmatter: string): number {
  return (frontmatter.match(/^\s*-\s*question:/gm) || []).length;
}

function countInternalLinks(text: string): number {
  return (text.match(/\[([^\]]+)\]\((\/[^)]+|\.\.\/[^)]+)\)/g) || []).length;
}

function hasAnswerCapsule(text: string): boolean {
  return /^(?:#[^#].*\n\n)?>\s*\*\*(?:Kurz|Kurze Antwort|Kurz & Knapp|Quick Answer|Short Answer|Respuesta Rápida|Respuesta corta|En Resumen)/m.test(
    text,
  );
}

function hasFaqInContent(text: string): boolean {
  return /^##\s*(?:Häufige Fragen|FAQ|Frequently Asked)/im.test(text);
}

export function validateArticle(content: string): ArticleValidation {
  const { frontmatter, body } = parseMarkdown(content);
  const issues: ValidationIssue[] = [];

  const wordCount = countWords(body);
  const paragraphCount = countParagraphs(body);
  const h2Sections = analyzeH2Sections(body);
  const faqCount = countFaqs(frontmatter);
  const internalLinks = countInternalLinks(body);
  const capsule = hasAnswerCapsule(body);

  if (wordCount < ARTICLE_CONFIG.minWords) {
    issues.push({
      type: "word_count_low",
      severity: "error",
      actual: wordCount,
      minimum: ARTICLE_CONFIG.minWords,
      message: `Article has ${wordCount} words. Minimum: ${ARTICLE_CONFIG.minWords}.`,
    });
  } else if (wordCount > ARTICLE_CONFIG.maxWords) {
    issues.push({
      type: "word_count_high",
      severity: "warning",
      actual: wordCount,
      maximum: ARTICLE_CONFIG.maxWords,
      message: `Article has ${wordCount} words. Consider splitting.`,
    });
  }

  if (paragraphCount < ARTICLE_CONFIG.minParagraphs) {
    issues.push({
      type: "paragraph_count_low",
      severity: "error",
      actual: paragraphCount,
      minimum: ARTICLE_CONFIG.minParagraphs,
      message: `Only ${paragraphCount} paragraphs. Minimum: ${ARTICLE_CONFIG.minParagraphs}.`,
    });
  }

  if (h2Sections.length < ARTICLE_CONFIG.minH2Count) {
    issues.push({
      type: "h2_count_low",
      severity: "error",
      actual: h2Sections.length,
      minimum: ARTICLE_CONFIG.minH2Count,
      message: `Only ${h2Sections.length} H2 headings. Minimum: ${ARTICLE_CONFIG.minH2Count}.`,
    });
  } else if (h2Sections.length > ARTICLE_CONFIG.maxH2Count) {
    issues.push({
      type: "h2_count_high",
      severity: "warning",
      actual: h2Sections.length,
      maximum: ARTICLE_CONFIG.maxH2Count,
      message: `${h2Sections.length} H2 headings. Consider consolidating.`,
    });
  }

  for (const s of h2Sections) {
    if (s.paragraphs < ARTICLE_CONFIG.minParagraphsPerH2) {
      issues.push({
        type: "thin_section",
        severity: "error",
        section: s.title,
        actual: s.paragraphs,
        minimum: ARTICLE_CONFIG.minParagraphsPerH2,
        message: `Section "${s.title}" has only ${s.paragraphs} paragraphs. Minimum: ${ARTICLE_CONFIG.minParagraphsPerH2}.`,
      });
    }
  }

  if (faqCount < ARTICLE_CONFIG.minFaqCount) {
    issues.push({
      type: "faq_count_low",
      severity: "error",
      actual: faqCount,
      minimum: ARTICLE_CONFIG.minFaqCount,
      message: `Only ${faqCount} FAQs in frontmatter. Minimum: ${ARTICLE_CONFIG.minFaqCount}.`,
    });
  }

  if (internalLinks < ARTICLE_CONFIG.minInternalLinks) {
    issues.push({
      type: "internal_links_low",
      severity: "error",
      actual: internalLinks,
      minimum: ARTICLE_CONFIG.minInternalLinks,
      message: `Only ${internalLinks} internal links. Minimum: ${ARTICLE_CONFIG.minInternalLinks}.`,
    });
  }

  if (!capsule) {
    issues.push({
      type: "no_answer_capsule",
      severity: "error",
      message: "No Answer Capsule found (blockquote after H1).",
    });
  }

  if (hasFaqInContent(body)) {
    issues.push({
      type: "faq_in_content",
      severity: "error",
      message: "FAQ section found in content body. FAQs belong in frontmatter only.",
    });
  }

  const errors = issues.filter((i) => i.severity === "error");
  const pass = errors.length === 0;

  return {
    pass,
    metrics: {
      wordCount,
      paragraphCount,
      h2Count: h2Sections.length,
      faqCount,
      internalLinks,
      hasAnswerCapsule: capsule,
    },
    h2Sections,
    issues,
    summary: pass
      ? `PASS - ${wordCount} words, ${paragraphCount} paragraphs, ${h2Sections.length} H2s`
      : `FAIL - ${errors.length} error(s), ${issues.length - errors.length} warning(s)`,
  };
}

// ─── Section Validation (port of section-metrics.js) ────────────

export type SectionType = "introduction" | "h2_section" | "conclusion" | "faq" | "meta";

const SECTION_CONFIG = {
  introduction: { minWords: 80, maxWords: 200, minParagraphs: 1 },
  h2_section: { minWords: 200, maxWords: 500, minParagraphs: 3, defaultTargetWords: 300 },
  conclusion: { minWords: 80, maxWords: 250, minParagraphs: 2 },
  faq: { minItems: 3, maxItems: 5, answerMinWords: 30, answerMaxWords: 80 },
  meta: {
    requiredFields: ["title", "description", "pubDate", "author", "category", "lang", "translationKey", "translations", "keywords"],
    titleMinChars: 50,
    titleMaxChars: 70,
    descriptionMinChars: 100,
    descriptionMaxChars: 160,
  },
};

export interface SectionValidation {
  pass: boolean;
  type: SectionType;
  metrics: Record<string, unknown>;
  issues: ValidationIssue[];
  summary: string;
}

export function validateSection(
  content: string,
  type: SectionType,
  targetWords?: number,
): SectionValidation {
  const issues: ValidationIssue[] = [];
  let metrics: Record<string, unknown> = {};

  switch (type) {
    case "introduction": {
      const cfg = SECTION_CONFIG.introduction;
      const wc = countWords(content);
      const pc = countParagraphs(content);
      metrics = { wordCount: wc, paragraphCount: pc, hasH1: /^#\s+.+$/m.test(content), hasAnswerCapsule: /^>\s*\*\*/m.test(content) };

      if (!metrics.hasH1) issues.push({ type: "missing_h1", severity: "error", message: "H1 heading missing." });
      if (!metrics.hasAnswerCapsule) issues.push({ type: "missing_answer_capsule", severity: "error", message: "Answer Capsule missing." });
      if (wc < cfg.minWords) issues.push({ type: "too_short", severity: "error", actual: wc, minimum: cfg.minWords, message: `Introduction has ${wc} words. Minimum: ${cfg.minWords}.` });
      if (wc > cfg.maxWords) issues.push({ type: "too_long", severity: "warning", actual: wc, maximum: cfg.maxWords, message: `Introduction has ${wc} words. Maximum: ${cfg.maxWords}.` });
      break;
    }
    case "h2_section": {
      const cfg = SECTION_CONFIG.h2_section;
      const target = targetWords ?? cfg.defaultTargetWords;
      const wc = countWords(content);
      const pc = countParagraphs(content);
      metrics = { wordCount: wc, paragraphCount: pc, hasH2: /^##\s+.+$/m.test(content), targetWords: target };

      if (!metrics.hasH2) issues.push({ type: "missing_h2", severity: "error", message: "H2 heading missing." });
      if (pc < cfg.minParagraphs) issues.push({ type: "too_few_paragraphs", severity: "error", actual: pc, minimum: cfg.minParagraphs, message: `Section has ${pc} paragraphs. Minimum: ${cfg.minParagraphs}.` });
      if (wc < cfg.minWords) issues.push({ type: "too_short", severity: "error", actual: wc, minimum: cfg.minWords, message: `Section has ${wc} words. Minimum: ${cfg.minWords}.` });
      if (wc > cfg.maxWords) issues.push({ type: "too_long", severity: "warning", actual: wc, maximum: cfg.maxWords, message: `Section has ${wc} words. Maximum: ${cfg.maxWords}.` });

      const tolerance = 0.2;
      if (wc < Math.floor(target * (1 - tolerance))) {
        issues.push({ type: "below_target", severity: "warning", actual: wc, message: `Section has ${wc} words. Target: ${target} (±20%).` });
      }
      break;
    }
    case "conclusion": {
      const cfg = SECTION_CONFIG.conclusion;
      const wc = countWords(content);
      const pc = countParagraphs(content);
      metrics = { wordCount: wc, paragraphCount: pc, hasH2: /^##\s+.+$/m.test(content) };

      if (!metrics.hasH2) issues.push({ type: "missing_h2", severity: "error", message: "H2 heading missing for conclusion." });
      if (pc < cfg.minParagraphs) issues.push({ type: "too_few_paragraphs", severity: "error", actual: pc, minimum: cfg.minParagraphs, message: `Conclusion has ${pc} paragraphs. Minimum: ${cfg.minParagraphs}.` });
      if (wc < cfg.minWords) issues.push({ type: "too_short", severity: "error", actual: wc, minimum: cfg.minWords, message: `Conclusion has ${wc} words. Minimum: ${cfg.minWords}.` });
      if (wc > cfg.maxWords) issues.push({ type: "too_long", severity: "warning", actual: wc, maximum: cfg.maxWords, message: `Conclusion has ${wc} words. Maximum: ${cfg.maxWords}.` });
      break;
    }
    case "faq": {
      const cfg = SECTION_CONFIG.faq;
      const questionMatches = content.match(/^\s*-\s*question:/gm);
      const itemCount = questionMatches?.length ?? 0;

      const answers = [...content.matchAll(/answer:\s*"([^"]+)"/g)].map((m) => m[1]);
      if (answers.length === 0) {
        answers.push(...[...content.matchAll(/answer:\s*(.+)$/gm)].map((m) => m[1].trim()));
      }

      metrics = { itemCount, answerWordCounts: answers.map((a) => a.split(/\s+/).length) };

      if (itemCount < cfg.minItems) issues.push({ type: "too_few_items", severity: "error", actual: itemCount, minimum: cfg.minItems, message: `Only ${itemCount} FAQ items. Minimum: ${cfg.minItems}.` });
      if (itemCount > cfg.maxItems) issues.push({ type: "too_many_items", severity: "warning", actual: itemCount, maximum: cfg.maxItems, message: `${itemCount} FAQ items. Maximum: ${cfg.maxItems}.` });

      answers.forEach((a, i) => {
        const wc = a.split(/\s+/).length;
        if (wc < cfg.answerMinWords) issues.push({ type: "answer_too_short", severity: "warning", actual: wc, minimum: cfg.answerMinWords, message: `FAQ ${i + 1} answer has ${wc} words. Minimum: ${cfg.answerMinWords}.` });
        if (wc > cfg.answerMaxWords) issues.push({ type: "answer_too_long", severity: "warning", actual: wc, maximum: cfg.answerMaxWords, message: `FAQ ${i + 1} answer has ${wc} words. Maximum: ${cfg.answerMaxWords}.` });
      });
      break;
    }
    case "meta": {
      const cfg = SECTION_CONFIG.meta;
      const present = cfg.requiredFields.filter((f) => new RegExp(`^${f}:`, "m").test(content));
      const missing = cfg.requiredFields.filter((f) => !present.includes(f));
      metrics = { fieldsPresent: present, fieldsMissing: missing };

      for (const f of missing) {
        issues.push({ type: "missing_field", severity: "error", message: `Required field '${f}' missing.` });
      }

      const titleMatch = content.match(/^title:\s*"?([^"\n]+)"?\s*$/m);
      if (titleMatch) {
        const len = titleMatch[1].length;
        if (len < cfg.titleMinChars) issues.push({ type: "title_too_short", severity: "error", actual: len, minimum: cfg.titleMinChars, message: `Title has ${len} chars. Minimum: ${cfg.titleMinChars}.` });
        if (len > cfg.titleMaxChars) issues.push({ type: "title_too_long", severity: "warning", actual: len, maximum: cfg.titleMaxChars, message: `Title has ${len} chars. Maximum: ${cfg.titleMaxChars}.` });
      }

      const descMatch = content.match(/^description:\s*"?([^"\n]+)"?\s*$/m);
      if (descMatch) {
        const len = descMatch[1].length;
        if (len < cfg.descriptionMinChars) issues.push({ type: "description_too_short", severity: "error", actual: len, minimum: cfg.descriptionMinChars, message: `Description has ${len} chars. Minimum: ${cfg.descriptionMinChars}.` });
        if (len > cfg.descriptionMaxChars) issues.push({ type: "description_too_long", severity: "warning", actual: len, maximum: cfg.descriptionMaxChars, message: `Description has ${len} chars. Maximum: ${cfg.descriptionMaxChars}.` });
      }
      break;
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  return {
    pass: errors.length === 0,
    type,
    metrics,
    issues,
    summary: errors.length === 0 ? `PASS - ${type} validation OK` : `FAIL - ${errors.length} error(s)`,
  };
}

// ─── Assembly (port of assemble-article.js) ─────────────────────

export interface AssemblyResult {
  success: boolean;
  outputPath?: string;
  metrics?: {
    wordCountEstimate: number;
    h2Sections: number;
    sectionFiles: number;
    hasIntro: boolean;
    hasConclusion: boolean;
    hasFaq: boolean;
  };
  filesAssembled: string[];
  issues: { severity: string; message: string }[];
}

function readIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8").trim();
}

export function assembleArticle(scratchpadDir: string, outputPath: string): AssemblyResult {
  const issues: { severity: string; message: string }[] = [];

  const metaContent = readIfExists(path.join(scratchpadDir, "meta.yaml"));
  if (!metaContent) {
    issues.push({ severity: "error", message: "meta.yaml not found" });
    return { success: false, filesAssembled: [], issues };
  }

  const faqContent = readIfExists(path.join(scratchpadDir, "faq.yaml"));
  if (!faqContent) {
    issues.push({ severity: "warning", message: "faq.yaml not found - article will have no FAQ" });
  }

  const introContent = readIfExists(path.join(scratchpadDir, "intro.md"));
  if (!introContent) {
    issues.push({ severity: "error", message: "intro.md not found" });
    return { success: false, filesAssembled: [], issues };
  }

  // Find section files sorted numerically
  const sectionFiles = fs
    .readdirSync(scratchpadDir)
    .filter((f) => /^section-\d+\.md$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)![0]);
      const nb = parseInt(b.match(/\d+/)![0]);
      return na - nb;
    });

  if (sectionFiles.length === 0) {
    issues.push({ severity: "error", message: "No section-*.md files found" });
    return { success: false, filesAssembled: [], issues };
  }

  const sections = sectionFiles.map((f) => ({
    file: f,
    content: fs.readFileSync(path.join(scratchpadDir, f), "utf-8").trim(),
  }));

  const conclusionContent = readIfExists(path.join(scratchpadDir, "conclusion.md"));
  if (!conclusionContent) {
    issues.push({ severity: "error", message: "conclusion.md not found" });
    return { success: false, filesAssembled: [], issues };
  }

  // Assemble frontmatter
  let frontmatter = metaContent;
  if (faqContent) {
    frontmatter += "\nfaq:\n";
    for (const line of faqContent.split("\n")) {
      if (!line.trim()) continue;
      frontmatter += line.trim().startsWith("-") ? `  ${line.trim()}\n` : `    ${line.trim()}\n`;
    }
  }

  // Build article
  const parts = [
    "---",
    frontmatter,
    "---",
    "",
    introContent,
    "",
    ...sections.map((s) => s.content + "\n"),
    conclusionContent,
    "",
  ];
  const article = parts.join("\n");

  // Write output
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, article, "utf-8");

  const bodyText = article.replace(/^---[\s\S]*?---/, "").trim();
  const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
  const h2Count = (article.match(/^##\s+/gm) || []).length;

  const filesAssembled = [
    "meta.yaml",
    ...(faqContent ? ["faq.yaml"] : []),
    "intro.md",
    ...sectionFiles,
    "conclusion.md",
  ];

  return {
    success: true,
    outputPath,
    metrics: {
      wordCountEstimate: wordCount,
      h2Sections: h2Count,
      sectionFiles: sections.length,
      hasIntro: true,
      hasConclusion: true,
      hasFaq: !!faqContent,
    },
    filesAssembled,
    issues,
  };
}
