import type { Project, Topic } from "../../models/types.js";

export function buildOutlineArchitectPrompt(
  project: Project,
  topic: Topic,
  scratchpadDir: string,
): string {
  const categories = project.categories.map((c) => `${c.id}: ${c.labels.en ?? c.labels.de}`).join(", ");

  return `You are an Outline Architect for the "${project.name}" project.

## Your Task

Create a detailed section-level outline for the following article topic. The outline defines the exact structure that parallel Section Writers will follow.

## Topic Brief

- **Title**: ${topic.title}
- **Category**: ${topic.category}
- **Primary Keyword**: ${topic.keywords.primary}
- **Secondary Keywords**: ${topic.keywords.secondary.join(", ")}
- **Long-tail Keywords**: ${topic.keywords.longTail.join(", ")}
- **Search Intent**: ${topic.searchIntent}
- **Suggested Angle**: ${topic.suggestedAngle}
- **Estimated Sections**: ${topic.estimatedSections}

## Project Context

- **Project**: ${project.name}
- **Default Language**: ${project.defaultLanguage}
- **Categories**: ${categories}

## Instructions

1. Read the project's content types, brand voice, and blog post template using flowboost_read_project_data:
   - projectId: "${project.id}"
   - resource: "content-types", "brand-voice", "template:blog-post"

2. Read all section specs to understand the types:
   - resource: "section-spec:introduction", "section-spec:h2-section", "section-spec:conclusion", "section-spec:faq", "section-spec:meta"

3. Design the article outline with these sections:

   a) **meta** section: Frontmatter fields (title, description, author, category, tags, keywords, etc.)
   b) **introduction** section: H1 + Answer Capsule + opening paragraphs
   c) **h2_section** sections (${topic.estimatedSections - 2} sections): Main body content
   d) **conclusion** section: Summary + CTA
   e) **faq** section: 3-5 FAQ items for frontmatter

4. For each H2 section, specify:
   - A compelling H2 heading (with keyword variant)
   - Target word count (250-400 words)
   - Minimum paragraphs (3-4)
   - Keywords to include
   - Optional H3 subsections
   - Optional internal link suggestion
   - Content direction (what to cover)

5. Output the outline as JSON with this EXACT structure:

\`\`\`json
{
  "topic": {
    "title": "${topic.title}",
    "category": "${topic.category}",
    "primaryKeyword": "${topic.keywords.primary}",
    "secondaryKeywords": ${JSON.stringify(topic.keywords.secondary)},
    "longTailKeywords": ${JSON.stringify(topic.keywords.longTail)},
    "searchIntent": "${topic.searchIntent}",
    "suggestedAngle": "${topic.suggestedAngle}"
  },
  "sections": [
    {
      "id": "meta",
      "type": "meta",
      "outputFile": "meta.yaml",
      "frontmatter": {
        "slug": "url-slug-in-default-language",
        "category": "${topic.category}",
        "author": "breathe-team",
        "tags": ["tag1", "tag2"],
        "keywords": ["primary", "secondary"],
        "translationKey": "english-slug",
        "translations": { "en": "english-slug", "es": "spanish-slug" }
      }
    },
    {
      "id": "intro",
      "type": "introduction",
      "outputFile": "intro.md",
      "h1": "H1 Title with Primary Keyword",
      "answerCapsuleDirection": "What to answer in 2-3 sentences",
      "hookStrategy": "statistic|empathy|question|contrast"
    },
    {
      "id": "section-1",
      "type": "h2_section",
      "outputFile": "section-1.md",
      "h2": "H2 Heading with Keyword Variant",
      "targetWords": 300,
      "minParagraphs": 3,
      "keywordsToInclude": ["keyword1", "keyword2"],
      "contentDirection": "What this section should cover",
      "h3s": ["Optional H3 1", "Optional H3 2"],
      "internalLink": { "anchor": "Link Text", "href": "/de/blog/slug" }
    },
    {
      "id": "conclusion",
      "type": "conclusion",
      "outputFile": "conclusion.md",
      "keyTakeaways": ["Point 1", "Point 2", "Point 3"],
      "ctaType": "app_download"
    },
    {
      "id": "faq",
      "type": "faq",
      "outputFile": "faq.yaml",
      "faqSpecs": [
        { "question": "Draft question?", "direction": "What the answer should cover" }
      ]
    }
  ],
  "totalTargetWords": 1400,
  "internalLinks": [
    { "anchor": "Link Text", "href": "/de/blog/slug", "placedInSection": "section-2" }
  ]
}
\`\`\`

6. Write the outline JSON to: ${scratchpadDir}/outline.json

Output ONLY the JSON outline. No explanations.`;
}
