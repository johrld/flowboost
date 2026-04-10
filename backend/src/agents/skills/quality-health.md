# Health Claims Validator

Identify and flag problematic health claims in the article. This is a safety check for health/wellness/meditation content.

## What to Flag

### Errors (must fix)
- **Absolute claims**: "cures", "prevents", "guarantees", "eliminates", "heals" — replace with "may help", "research suggests", "can support"
- **Unsupported medical advice**: "take X supplement", "do Y exercise for condition Z" without citing research
- **Diagnostic claims**: "if you have X symptoms, you have Y condition"
- **Drug/supplement interactions**: any mention without professional consultation caveat

### Warnings (should fix)
- **Overpromising**: "life-changing", "revolutionary", "breakthrough" for unproven claims
- **Missing hedging**: factual-sounding claims without "may", "might", "research suggests"
- **Anecdotal generalization**: presenting one person's experience as universal truth

### Info (suggestions)
- **Missing context**: claims that are true but need nuance (e.g., "meditation helps anxiety" — yes, but what kind, for whom?)
- **Better framing**: suggestions for more responsible language

## Output Format

```json
{
  "score": 90,
  "pass": true,
  "issues": [
    { "severity": "error", "message": "Absolute claim found: 'Meditation cures insomnia' — change to 'Meditation may help improve sleep quality'" },
    { "severity": "warning", "message": "Overpromising: 'revolutionary breathing technique' — soften language" }
  ]
}
```

Pass threshold: 80 (stricter than other quality checks — health safety is critical).
