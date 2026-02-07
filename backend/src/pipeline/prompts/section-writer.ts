import type { Project } from "../../models/types.js";

interface SectionSpec {
  id: string;
  type: "meta" | "introduction" | "h2_section" | "conclusion" | "faq";
  outputFile: string;
  // Type-specific fields included as JSON
  [key: string]: unknown;
}

export function buildSectionWriterPrompt(
  project: Project,
  section: SectionSpec,
  outlineContext: {
    title: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    suggestedAngle: string;
  },
  scratchpadDir: string,
): string {
  const sectionSpecResource = section.type === "h2_section"
    ? "section-spec:h2-section"
    : `section-spec:${section.type}`;

  return `You are a Section Writer for the "${project.name}" project.

## Your Task

Write a SINGLE content section based on the spec below. You write ONE section — not the whole article.

## Article Context

- **Title**: ${outlineContext.title}
- **Primary Keyword**: ${outlineContext.primaryKeyword}
- **Secondary Keywords**: ${outlineContext.secondaryKeywords.join(", ")}
- **Angle**: ${outlineContext.suggestedAngle}
- **Language**: ${project.defaultLanguage === "de" ? "German (Du-Ansprache)" : project.defaultLanguage}

## Section Spec

\`\`\`json
${JSON.stringify(section, null, 2)}
\`\`\`

## Instructions

1. Read the section type spec and brand voice using flowboost_read_project_data:
   - projectId: "${project.id}"
   - resource: "${sectionSpecResource}", "brand-voice"

2. Write the section following the spec rules EXACTLY:
   - Match the required format for type "${section.type}"
   - Hit the target word count (if specified)
   - Include required keywords naturally
   - Follow the content direction from the spec
   - Use natural paragraph length variation

3. Write the content to: ${scratchpadDir}/${section.outputFile}

4. Validate your section using flowboost_validate_section:
   - path: "${scratchpadDir}/${section.outputFile}"
   - type: "${section.type}"${section.type === "h2_section" && section.targetWords ? `\n   - targetWords: ${section.targetWords}` : ""}

5. If validation fails, fix the issues and re-validate.

## Rules

- Write ONLY the section content, not a full article
- Start with the appropriate heading (H1 for intro, H2 for body, ## Fazit for conclusion)
- For meta type: output ONLY YAML fields (no --- wrapper, no faq field)
- For faq type: output ONLY the YAML array (- question: / answer:)
- Follow brand voice: warm, encouraging, Du-Ansprache, no forbidden terms
- Use active language, max 20 words per sentence on average
- Include concrete examples, science, or practical tips — no filler text

Output ONLY the section content. No meta-commentary.`;
}
