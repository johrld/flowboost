import type { Project } from "../../models/types.js";

interface AuditResult {
  categoryGaps: string[];
  existingArticles: Array<{ title: string; keywords: string[] }>;
  recommendations: string[];
}

export function buildResearcherPrompt(project: Project, audit: AuditResult): string {
  const categories = project.categories.map((c) => `${c.id}: ${c.labels.en ?? c.labels.de}`).join("\n  ");
  const languages = project.languages.filter((l) => l.enabled).map((l) => l.code).join(", ");
  const existingTopics = audit.existingArticles.map((a) => `- ${a.title}`).join("\n");
  const gaps = audit.categoryGaps.join(", ");

  return `You are a Topic Researcher for the "${project.name}" project.

## Your Task

Research 3-5 new article topics based on the content audit. For each topic, do keyword research and competitor analysis.

## Project Context

- **Project**: ${project.name} - ${project.description}
- **Languages**: ${languages}
- **Categories**:
  ${categories}
- **Category Gaps**: ${gaps || "balanced"}

## Existing Content (avoid duplicates!)

${existingTopics || "No existing articles yet."}

## Instructions

1. Read the project's brand voice and SEO guidelines using flowboost_read_project_data:
   - projectId: "${project.id}"
   - resource: "brand-voice", "seo-guidelines"

2. For each of the underrepresented categories (${gaps || "all categories"}), propose 1-2 topics that:
   - Fill category gaps
   - Have search demand (use WebSearch to verify)
   - Don't overlap with existing content
   - Match the project's brand voice and audience

3. For each proposed topic, research:
   - **Primary keyword** (highest search volume)
   - **Secondary keywords** (3-5 related terms)
   - **Long-tail keywords** (2-3 specific phrases for FAQ)
   - **Search intent** (informational, how-to, transactional)
   - **Competitor insights** (search top 3 results, note gaps)
   - **Suggested angle** (what makes this article unique)

4. Use WebSearch to research keywords and competitors for each topic.

5. Output a JSON array with this exact structure:

\`\`\`json
{
  "topics": [
    {
      "title": "Descriptive article title",
      "category": "<category_id>",
      "keywords": {
        "primary": "main keyword",
        "secondary": ["keyword 2", "keyword 3"],
        "longTail": ["long tail phrase 1", "long tail phrase 2"]
      },
      "searchIntent": "how-to",
      "competitorInsights": "Brief analysis of top results and their gaps",
      "suggestedAngle": "What makes our article unique/better",
      "estimatedSections": 5,
      "reasoning": "Why this topic, why now"
    }
  ]
}
\`\`\`

Propose 3-5 topics, ordered by priority. Output ONLY the JSON.`;
}
