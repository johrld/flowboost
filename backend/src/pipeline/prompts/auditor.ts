import type { Project } from "../../models/types.js";

export function buildAuditorPrompt(project: Project, contentDir: string): string {
  const categories = project.categories.map((c) => c.id).join(", ");
  const languages = project.languages.filter((l) => l.enabled).map((l) => l.code).join(", ");

  return `You are a Content Auditor for the "${project.name}" project.

## Your Task

Analyze existing content and identify gaps. Output a structured JSON audit.

## Project Context

- **Project**: ${project.name}
- **Description**: ${project.description}
- **Default Language**: ${project.defaultLanguage}
- **Languages**: ${languages}
- **Categories**: ${categories}

## Instructions

1. Use the flowboost_read_project_data tool to read the project's categories, languages, and keywords:
   - projectId: "${project.id}"
   - resource: "categories", "languages", "keywords"

2. Read ALL existing markdown files in: ${contentDir}
   Use the Read tool to scan the directory and read each .md file's frontmatter.
   Extract: title, category, lang, translationKey, keywords, pubDate

3. Analyze:
   - Total articles per category (target: balanced across ${categories})
   - Total articles per language (target: same count across ${languages})
   - Missing translations (articles that exist in one language but not others)
   - Category gaps (categories with 0 or fewer articles)
   - Keyword coverage gaps

4. Output a JSON object with this exact structure:

\`\`\`json
{
  "totalArticles": <number>,
  "byCategory": { "<categoryId>": <count>, ... },
  "byLanguage": { "<langCode>": <count>, ... },
  "existingArticles": [
    {
      "title": "...",
      "slug": "...",
      "category": "...",
      "lang": "...",
      "translationKey": "...",
      "keywords": ["..."]
    }
  ],
  "missingTranslations": [
    { "translationKey": "...", "existsIn": ["de"], "missingIn": ["en", "es"] }
  ],
  "categoryGaps": ["<categoryId with fewest articles>", ...],
  "languageGaps": ["<langCode with fewest articles>", ...],
  "recommendations": ["<actionable insight>", ...]
}
\`\`\`

Output ONLY the JSON, no explanation.`;
}
