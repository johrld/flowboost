import type { Project, Topic } from "../../models/types.js";

export function buildNewsletterWriterPrompt(
  project: Project,
  topic: Topic,
  briefingContext?: {
    inputs?: string[];
    researchAngle?: string;
    existingArticle?: string;
  },
): string {
  const parts: string[] = [
    "You are an expert newsletter writer. Create a compelling email newsletter.",
    "",
    "## Topic",
    `- **Title:** ${topic.title}`,
    `- **Category:** ${topic.category || "general"}`,
  ];

  if (topic.keywords?.primary) {
    parts.push(`- **Primary Keyword:** ${topic.keywords.primary}`);
  }
  if (topic.suggestedAngle) {
    parts.push(`- **Angle:** ${topic.suggestedAngle}`);
  }

  if (briefingContext?.inputs && briefingContext.inputs.length > 0) {
    parts.push("", "## Briefing Inputs (source material)");
    for (const input of briefingContext.inputs) {
      parts.push(`- ${input.slice(0, 500)}`);
    }
  }

  if (briefingContext?.existingArticle) {
    parts.push("", "## Related Article (use as reference)", briefingContext.existingArticle.slice(0, 2000));
  }

  parts.push(
    "",
    "## Brand Voice",
    `- **Language:** ${project.defaultLanguage === "de" ? "German (Du-Ansprache)" : project.defaultLanguage}`,
    "- Follow the project's brand voice guidelines",
    "",
    "## Newsletter Guidelines",
    "",
    "Read the newsletter skill using flowboost_read_project_data:",
    '  resource: "skill:newsletter/default"',
    "Follow the tone, structure, and style rules from that skill document.",
    "If the skill file is not available, follow these defaults:",
    "- Subject line: 40-60 characters, compelling, no clickbait",
    "- Preview text: 80-120 characters, complements subject",
    "- Structure: Introduction → Main Content (2-3 sections) → CTA",
    "- Each section: heading + 2-4 paragraphs",
    "- Tone: personal, direct, valuable",
    "- Total: 300-800 words",
    "- Include one clear CTA",
    "",
    "## Output Format",
    "Return a JSON object:",
    "```json",
    "{",
    '  "subject": "Email subject line",',
    '  "previewText": "Preview text shown in inbox",',
    '  "sections": [',
    '    { "heading": "Section Title", "body": "Markdown content for this section" }',
    "  ],",
    '  "cta": { "text": "CTA description", "buttonLabel": "Button text", "url": "https://..." }',
    "}",
    "```",
  );

  return parts.join("\n");
}
