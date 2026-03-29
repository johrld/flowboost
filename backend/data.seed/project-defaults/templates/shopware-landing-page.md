# Shopware Landing Page Template

Reference for writing CMS Erlebniswelt slot content.
The actual layout structure comes from the imported Shopware layout.
Each slot has `exampleContent` showing what currently lives there — use it to understand the purpose.

## Slot Type Examples

### Text Slot (Hero / first section)
Write a compelling H1 headline with the primary keyword.
Follow with a subline that elaborates the benefit.
Include a clear call-to-action.

### Text Slot (Content section)
H2 headline targeting a secondary keyword.
3-5 paragraphs of benefit-driven content.
Internal links to relevant products where natural.

### Multi-Column Text Slots
Each column covers one distinct point.
Keep columns balanced in length.
Benefit-focused H3 headlines.

### Image Slot
Provide a generation prompt describing the desired image.
Example: "Professional product photography of [topic],
clean background, editorial style, no text overlays."

### Product Slot
List relevant product IDs or describe selection criteria.
Products should match the page topic.

### FAQ Slot (if present)
8-12 questions users actually ask.
40-60 word answers each.
Include primary keyword in at least one question.

## Using exampleContent

Every slot may have `exampleContent` — the current HTML content from the live Shopware page.
Read it to understand:
- What TYPE of content this slot displays (headline, features, FAQ, testimonials, CTA)
- What STRUCTURE the client uses (H1+P, H3 list, accordion, card layout)
- What TONE the client prefers (formal, casual, technical)

Then write NEW content that serves the same purpose but for the requested topic.
