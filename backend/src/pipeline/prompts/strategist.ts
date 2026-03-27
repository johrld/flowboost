import type { Project } from "../../models/types.js";

interface AuditResult {
  totalContent: number;
  byCategory: Record<string, number>;
  byLanguage: Record<string, number>;
  categoryGaps: string[];
  recommendations: string[];
}

interface ResearchResult {
  topics: Array<{
    title: string;
    category: string;
    keywords: { primary: string; secondary: string[]; longTail: string[] };
    searchIntent: string;
    competitorInsights: string;
    suggestedAngle: string;
    estimatedSections: number;
    reasoning: string;
  }>;
}

export function buildStrategistPrompt(
  project: Project,
  audit: AuditResult,
  research: ResearchResult,
): string {
  return `You are a Content Strategist for the "${project.name}" project.

## Your Task

Create a prioritized content plan based on the audit and research data. This plan will be reviewed by a human editor before any articles are produced.

## Audit Summary

- Total content pieces: ${audit.totalContent}
- By category: ${JSON.stringify(audit.byCategory)}
- By language: ${JSON.stringify(audit.byLanguage)}
- Category gaps: ${audit.categoryGaps.join(", ") || "none"}
- Recommendations: ${audit.recommendations.join("; ")}

## Researched Topics

${JSON.stringify(research.topics, null, 2)}

## Instructions

1. Read the project's content types and brand voice using flowboost_read_project_data:
   - projectId: "${project.id}"
   - resource: "content-types", "brand-voice"

2. Prioritize the researched topics based on:
   - **Category balance** - fill gaps first
   - **Search demand** - higher volume topics get priority
   - **Competition** - prefer topics where we can rank
   - **Brand fit** - topics that align with the project mission
   - **Content cluster** - topics that strengthen existing content via internal linking

3. For each topic, assign:
   - **priority** (1 = highest)
   - **id** in format "topic-1", "topic-2", etc.
   - **status** = "proposed"

4. Write the complete content plan as JSON. Use this EXACT structure:

\`\`\`json
{
  "projectId": "${project.id}",
  "createdAt": "${new Date().toISOString()}",
  "updatedAt": "${new Date().toISOString()}",
  "audit": ${JSON.stringify(audit)},
  "topics": [
    {
      "id": "topic-1",
      "status": "proposed",
      "title": "Article Title",
      "category": "category_id",
      "priority": 1,
      "direction": "Suggested angle or creative direction",
      "enrichment": {
        "seo": {
          "keywords": {
            "primary": "main keyword",
            "secondary": ["kw2", "kw3"],
            "longTail": ["long tail 1"]
          },
          "searchIntent": "how-to",
          "competitorInsights": "...",
          "suggestedSections": 5
        },
        "reasoning": "Why this topic at this priority",
        "enrichedAt": "${new Date().toISOString()}",
        "enrichedBy": "pipeline"
      }
    }
  ]
}
\`\`\`

IMPORTANT: Your response must be ONLY the JSON object above. No text before or after. Do not wrap it in markdown code blocks. Do not write it to a file.`;
}
