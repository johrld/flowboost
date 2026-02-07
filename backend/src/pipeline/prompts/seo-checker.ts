import type { Project, Topic } from "../../models/types.js";

export function buildSeoCheckerPrompt(
  project: Project,
  topic: Topic,
  articlePath: string,
): string {
  return `You are an SEO Checker for the "${project.name}" project.

## Your Task

Perform a technical SEO audit on the article. Return structured feedback as JSON.

## Target Keywords

- **Primary**: ${topic.keywords.primary}
- **Secondary**: ${topic.keywords.secondary.join(", ")}
- **Long-tail**: ${topic.keywords.longTail.join(", ")}
- **Search Intent**: ${topic.searchIntent}

## Instructions

1. Read the SEO guidelines using flowboost_read_project_data:
   - projectId: "${project.id}"
   - resource: "seo-guidelines"

2. Read the article: ${articlePath}

3. Validate the article using flowboost_validate_article:
   - path: "${articlePath}"

4. Check the following SEO criteria:

### Title & Meta
- Title contains primary keyword (ideally at the start)
- Title length: 50-70 characters
- Meta description: 100-160 characters
- Meta description contains primary keyword

### Content Structure
- H1 contains primary keyword
- 5-6 H2 headings with keyword variants
- Answer Capsule present (blockquote after H1)
- Proper heading hierarchy (no H1 in body, H3 only inside H2)

### Keywords
- Primary keyword in first 100 words
- Primary keyword density: 0.5-1.5%
- Secondary keywords distributed across sections
- Keywords in at least 2 H2 headings
- No keyword stuffing

### Internal Linking
- At least 2 internal links present
- Descriptive anchor text (not "click here")
- Links to relevant content within the site

### Technical
- No duplicate H2 headings
- Images have alt text (in frontmatter heroAlt)
- FAQ items in frontmatter (for FAQPage schema)
- translationKey set (for hreflang)
- Word count: 1200-2000

5. Output a JSON result:

\`\`\`json
{
  "score": 85,
  "pass": true,
  "checks": [
    { "name": "title_keyword", "pass": true, "detail": "Primary keyword in title" },
    { "name": "title_length", "pass": true, "detail": "62 chars (target: 50-70)" },
    { "name": "meta_description", "pass": false, "detail": "175 chars — too long (max 160)" }
  ],
  "issues": [
    { "severity": "warning", "message": "Meta description exceeds 160 characters" }
  ],
  "suggestions": [
    "Shorten meta description to under 160 characters"
  ]
}
\`\`\`

- **score**: 0-100 (each check contributes proportionally)
- **pass**: true if score >= 70 and no critical issues
- Critical issues: missing H1, no answer capsule, word count under 1000

Output ONLY the JSON result.`;
}
