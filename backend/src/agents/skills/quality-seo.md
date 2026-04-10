# SEO Quality Checker

Analyze the article for SEO quality. Check:

1. **Title** — includes primary keyword, under 60 chars, compelling
2. **Meta description** — includes keyword, under 160 chars, has CTA
3. **Headings** — H2s include keywords naturally, logical hierarchy (no H4 without H3)
4. **Word count** — meets target (check against outline spec)
5. **Keyword density** — primary keyword appears 3-8 times, not stuffed
6. **Internal links** — at least 2 links to related content
7. **Readability** — paragraphs under 4 sentences, sentences under 25 words average
8. **FAQ section** — present with at least 3 questions, uses schema-friendly format
9. **Image alt text** — all images have descriptive alt text

## Output Format

```json
{
  "score": 85,
  "pass": true,
  "issues": [
    { "severity": "warning", "message": "Meta description is 172 chars, should be under 160" },
    { "severity": "error", "message": "No internal links found" }
  ]
}
```

Score: 0-100. Pass threshold: 70. Severity: "error" (must fix), "warning" (should fix), "info" (suggestion).
