import type { Project, Topic } from "../../models/types.js";
import type { CustomContentType } from "../../models/content-type.js";

/**
 * Generic prompt builder for all content production agents.
 *
 * Assembles a prompt from:
 * - ContentType.agent.role (identity, first line — highest attention)
 * - ContentType.fields (hard constraints, generated)
 * - Topic + briefing context (dynamic data)
 * - ContentType.agent.guidelines (tone, structure, do/don'ts — user-editable)
 * - Output schema (generated from fields — last section, high attention)
 *
 * Uses XML tags for section boundaries (Anthropic best practice).
 * Markdown inside sections (optimal for LLM processing).
 */
export function buildContentWriterPrompt(
  contentType: CustomContentType,
  project: Project,
  topic: Topic,
  briefingContext: string,
): string {
  const role = contentType.agent?.role
    ?? `You are a professional ${contentType.label} writer for the "${project.name}" project.`;

  // ── Constraints from fields ────────────────────────────────
  const constraints = contentType.fields
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => {
      const parts: string[] = [`- **${f.label}**`];
      if (f.required) parts.push("(required)");
      if (f.constraints?.charLimit) parts.push(`— max ${f.constraints.charLimit} characters`);
      if (f.constraints?.wordCount) {
        const wc = f.constraints.wordCount as { min: number; max: number };
        parts.push(`— ${wc.min}-${wc.max} words`);
      }
      if (f.constraints?.maxItems) parts.push(`— max ${f.constraints.maxItems} items`);
      if (f.helpText) parts.push(`(${f.helpText})`);
      return parts.join(" ");
    })
    .join("\n");

  // ── Topic section ──────────────────────────────────────────
  const topicParts: string[] = [
    `- **Title:** ${topic.title}`,
    `- **Category:** ${topic.category || "general"}`,
  ];
  if (topic.keywords?.primary) {
    topicParts.push(`- **Primary Keyword:** ${topic.keywords.primary}`);
    if (topic.keywords.secondary.length > 0) {
      topicParts.push(`- **Secondary Keywords:** ${topic.keywords.secondary.join(", ")}`);
    }
  }
  if (topic.suggestedAngle) {
    topicParts.push(`- **Angle:** ${topic.suggestedAngle}`);
  }
  if (topic.searchIntent) {
    topicParts.push(`- **Search Intent:** ${topic.searchIntent}`);
  }
  if (topic.competitorInsights) {
    topicParts.push(`- **Competitor Insights:** ${topic.competitorInsights}`);
  }

  // ── Brand voice ────────────────────────────────────────────
  const lang = project.defaultLanguage === "de" ? "German (Du-Ansprache)" : project.defaultLanguage;

  // ── Output schema from fields ──────────────────────────────
  const outputSchema = generateOutputSchema(contentType);

  // ── Top constraint for final reminder ──────────────────────
  const topConstraint = getTopConstraint(contentType);

  // ── Guidelines ─────────────────────────────────────────────
  const guidelines = contentType.agent?.guidelines ?? "";

  // ── Assemble with XML tags ─────────────────────────────────
  const sections: string[] = [
    `<role>\n${role}\n</role>`,
    "",
    `<task>\nCreate a ${contentType.label} about the following topic.\n</task>`,
    "",
    `<constraints>\n${constraints}\n\n- **Language:** ${lang}\n</constraints>`,
    "",
    `<briefing>\n## Topic\n${topicParts.join("\n")}${briefingContext ? `\n\n${briefingContext}` : ""}\n</briefing>`,
  ];

  if (guidelines) {
    sections.push("", `<guidelines>\n${guidelines}\n</guidelines>`);
  }

  sections.push(
    "",
    `<instructions>\n1. Read the project's brand voice using flowboost_read_project_data: resource: "brand-voice"\n2. Write content that follows the brand voice and respects all constraints above.\n3. Return ONLY the JSON output — no explanations.\n</instructions>`,
    "",
    `<output_format>\n${outputSchema}\n</output_format>`,
    "",
    topConstraint,
  );

  return sections.join("\n");
}

/**
 * Generate JSON output schema from content type fields.
 */
function generateOutputSchema(ct: CustomContentType): string {
  const fields = ct.fields
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => {
      let typeHint = "string";
      let comment = "";
      if (f.type === "list") typeHint = "string[]";
      if (f.type === "faq") typeHint = "Array<{question, answer}>";
      if (f.type === "cta") typeHint = "{text, buttonLabel, url}";
      if (f.type === "image") {
        typeHint = "string | null";
        comment = " // Image generation prompt in English, or null";
      }
      if (f.type === "number") typeHint = "number";
      if (f.type === "boolean") typeHint = "boolean";
      // No constraint comments here — constraints are in <constraints> section
      return `  "${f.id}": ${typeHint}${comment}`;
    })
    .join(",\n");

  return `Return a JSON object with exactly these fields:\n\`\`\`json\n{\n${fields}\n}\n\`\`\`\n\nOutput ONLY the JSON. No explanations.`;
}

/**
 * Get the most important constraint for the final reminder line.
 */
function getTopConstraint(ct: CustomContentType): string {
  // Find the primary text field with a char limit
  const textField = ct.fields.find(
    (f) => f.constraints?.charLimit && (f.type === "long-text" || f.type === "short-text"),
  );
  if (textField?.constraints?.charLimit) {
    return `IMPORTANT: ${textField.label} must not exceed ${textField.constraints.charLimit} characters. Count carefully.`;
  }

  // Fallback to word count
  const wordField = ct.fields.find((f) => f.constraints?.wordCount);
  if (wordField?.constraints?.wordCount) {
    const wc = wordField.constraints.wordCount as { min: number; max: number };
    return `IMPORTANT: ${wordField.label} must be ${wc.min}-${wc.max} words.`;
  }

  return "";
}
