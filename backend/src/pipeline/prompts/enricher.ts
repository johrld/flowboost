import type { Project, Topic } from "../../models/types.js";

export function buildEnricherPrompt(
  project: Project,
  topic: Topic,
  existingTopics: Topic[],
  briefingContext?: string,
): string {
  const categories = project.categories
    .map((c) => `${c.id}: ${c.labels.en ?? c.labels.de}`)
    .join("\n  ");
  const languages = project.languages
    .filter((l) => l.enabled)
    .map((l) => l.code)
    .join(", ");
  const existing = existingTopics
    .filter((t) => t.id !== topic.id)
    .map((t) => `- ${t.title} (${t.category})`)
    .join("\n");

  return `<role>
You are a senior SEO researcher and content strategist for the "${project.name}" project.
</role>

<task>
Enrich this user-submitted topic with SEO research data. Research keywords, analyze competitors, and provide strategic recommendations.
</task>

<constraints>
- **Project**: ${project.name} — ${project.description}
- **Languages**: ${languages}
- **Categories**:
  ${categories}
</constraints>

<briefing>
## Topic to Enrich

- **Title**: "${topic.title}"
- **Category**: "${topic.category || "not specified"}"
- **User Notes**: "${topic.userNotes || "none"}"
${briefingContext ? `\n${briefingContext}` : ""}
## Existing Content (avoid overlap!)

### Published Articles
Use flowboost_read_content_index (status: "live") to see all published articles.
Check that this topic does not duplicate an existing article.

### Planned Topics
${existing || "No planned topics yet."}
</briefing>

<instructions>
1. Read the project's brand voice and SEO guidelines using flowboost_read_project_data:
   - resource: "brand-voice", "seo-guidelines"

2. Research the topic using WebSearch:
   - Find the **primary keyword** (highest search volume related to the title)
   - Find **3-5 secondary keywords** (related terms)
   - Find **2-3 long-tail keywords** (specific phrases for FAQ)

3. Analyze the **top 3 search results** for the primary keyword:
   - What do competitors cover?
   - What gaps exist?
   - What format do top results use?

4. Determine the **search intent** (informational, how-to, transactional, navigational)

5. Suggest a **unique angle** that differentiates from competitors and fits the project's brand

6. Estimate the number of **sections (H2s)** needed

7. Write **reasoning** explaining why this topic is a good fit for the project

8. Optionally **refine the title** for better SEO (keep the user's intent)

9. **Assign or confirm a category** from the available categories
</instructions>

<output_format>
Output ONLY valid JSON with this exact structure:

\`\`\`json
{
  "title": "Refined title for SEO (or keep original)",
  "category": "<category_id>",
  "keywords": {
    "primary": "main keyword",
    "secondary": ["keyword 2", "keyword 3", "keyword 4"],
    "longTail": ["long tail phrase 1", "long tail phrase 2"]
  },
  "searchIntent": "how-to",
  "competitorInsights": "Brief analysis of top results and their gaps",
  "suggestedAngle": "What makes this article unique/better",
  "estimatedSections": 5,
  "reasoning": "Why this topic, strategic fit, expected impact"
}
\`\`\`

Output ONLY the JSON. No explanations.
</output_format>`;
}
