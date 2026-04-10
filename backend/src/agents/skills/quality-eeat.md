# E-E-A-T Compliance Checker

Verify that the article meets Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) requirements, especially for YMYL (Your Money Your Life) health content.

## Check List

1. **Author attribution** — article has a named author with credentials
2. **Author page link** — front matter includes author that maps to a real author profile
3. **Medical reviewer** — for health content: "Reviewed by [Name], [Credential]" present
4. **Disclaimer** — health disclaimer present at the end
5. **Source attribution** — inline citations link to authoritative sources
6. **Date** — publishDate and lastModified present
7. **Structured data readiness** — content structured for MedicalWebPage/FAQPage schema
8. **Experience signals** — first-person experience, practical examples, not just theory
9. **Expertise signals** — accurate terminology, depth of coverage, nuanced positions

## Output Format

```json
{
  "score": 80,
  "pass": true,
  "issues": [
    { "severity": "error", "message": "No medical reviewer listed — required for health YMYL content" },
    { "severity": "warning", "message": "No health disclaimer found at end of article" },
    { "severity": "info", "message": "Consider adding personal experience examples for E-E-A-T 'Experience' signal" }
  ]
}
```

Pass threshold: 70. Missing author or reviewer for health content is always an error.
