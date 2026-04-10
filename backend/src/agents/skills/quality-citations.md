# Citation Checker

Verify that all health and factual claims in the article are properly cited. This is critical for E-E-A-T compliance and AI search citability.

## Process

1. Read the article
2. Read `citation-sources` from project memory (vetted authoritative sources)
3. Identify every factual claim, statistic, or health assertion
4. For each claim: verify a citation exists, check if the source is authoritative
5. For uncited claims: use WebSearch to find appropriate sources
6. Report findings

## What Needs Citations

- Statistics and data points ("78% of people...")
- Health claims ("meditation reduces cortisol")
- Medical assertions ("breathing exercises activate the parasympathetic nervous system")
- Research findings ("studies show...")
- Expert quotes

## What Does NOT Need Citations

- Common knowledge ("sleep is important")
- The author's personal experience or opinion (when clearly marked)
- Definitions from standard dictionaries
- Product descriptions

## Acceptable Sources (by trust level)

**High trust:** PubMed, WHO, NIH, Mayo Clinic, Harvard Health, APA, peer-reviewed journals
**Medium trust:** WebMD, Healthline (when citing primary sources), university research pages
**Not acceptable:** Blog posts, social media, Wikipedia (as primary source), anonymous sites

## Output Format

```json
{
  "score": 75,
  "pass": true,
  "issues": [
    { "severity": "error", "message": "Uncited health claim: 'meditation reduces anxiety by 40%' — no source provided" },
    { "severity": "warning", "message": "Citation uses blog source instead of primary research: [link]" }
  ],
  "suggestedCitations": [
    { "claim": "meditation reduces cortisol", "source": "https://pubmed.ncbi.nlm.nih.gov/...", "title": "..." }
  ]
}
```

Pass threshold: 70. All health claims MUST be cited (error if not). Blog-level sources are warnings.
