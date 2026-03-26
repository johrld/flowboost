import type { Project, Topic } from "../../models/types.js";

interface SocialPlatformSpec {
  platform: string;
  charLimit: number;
  hashtagLimit: number;
  mediaRequired: boolean;
  formats: string[];
  guidelines: string;
}

const PLATFORM_SPECS: Record<string, SocialPlatformSpec> = {
  linkedin: {
    platform: "LinkedIn",
    charLimit: 3000,
    hashtagLimit: 5,
    mediaRequired: false,
    formats: ["text", "carousel", "poll", "article"],
    guidelines: `
- Professional but approachable tone
- First line is the hook — must grab attention in the feed
- Use line breaks for readability (no walls of text)
- End with a question or CTA to drive engagement
- Hashtags at the very end, separated by a blank line
- No emojis in the first line
- Optimal length: 800-1500 characters for engagement`,
  },
  x: {
    platform: "X (Twitter)",
    charLimit: 280,
    hashtagLimit: 3,
    mediaRequired: false,
    formats: ["tweet", "thread"],
    guidelines: `
- Extremely concise — every word must earn its place
- Lead with the strongest point
- Use numbers and specifics over vague claims
- 1-2 hashtags max (feels spammy otherwise)
- Thread format: first tweet hooks, subsequent tweets deliver value
- No "Thread 🧵" clichés`,
  },
  instagram: {
    platform: "Instagram",
    charLimit: 2200,
    hashtagLimit: 30,
    mediaRequired: true,
    formats: ["post", "carousel", "reel", "story"],
    guidelines: `
- Visual-first: the image/carousel must be compelling standalone
- Caption supports the visual, doesn't repeat it
- First line is the hook (shows in preview before "...more")
- Carousel: 5-10 slides with clear progression
- Hashtags: mix of broad (100K+) and niche (<10K)
- Include a CTA (save, share, comment)`,
  },
  tiktok: {
    platform: "TikTok",
    charLimit: 4000,
    hashtagLimit: 5,
    mediaRequired: true,
    formats: ["video", "photo"],
    guidelines: `
- Hook in first 3 seconds
- Conversational, authentic tone
- Trending sounds/formats when relevant
- Caption is secondary to video content
- 3-5 relevant hashtags`,
  },
};

export function buildSocialWriterPrompt(
  project: Project,
  topic: Topic,
  platform: string,
  briefingContext?: {
    inputs?: string[];
    researchAngle?: string;
    existingArticle?: string;
  },
): string {
  const spec = PLATFORM_SPECS[platform] ?? PLATFORM_SPECS.linkedin;

  const parts: string[] = [
    `You are an expert social media content creator for ${spec.platform}.`,
    "",
    "## Task",
    `Create a ${spec.platform} post about the following topic.`,
    "",
    "## Topic",
    `- **Title:** ${topic.title}`,
    `- **Category:** ${topic.category || "general"}`,
  ];

  if (topic.keywords?.primary) {
    parts.push(`- **Primary Keyword:** ${topic.keywords.primary}`);
  }
  if (topic.suggestedAngle) {
    parts.push(`- **Angle:** ${topic.suggestedAngle}`);
  }

  if (briefingContext?.inputs && briefingContext.inputs.length > 0) {
    parts.push("", "## Briefing Inputs (source material)");
    for (const input of briefingContext.inputs) {
      parts.push(`- ${input.slice(0, 500)}`);
    }
  }

  if (briefingContext?.existingArticle) {
    parts.push("", "## Related Article (use as reference, don't copy)", briefingContext.existingArticle.slice(0, 2000));
  }

  parts.push(
    "",
    `## ${spec.platform} Specifications`,
    `- **Character limit:** ${spec.charLimit}`,
    `- **Hashtag limit:** ${spec.hashtagLimit}`,
    `- **Media required:** ${spec.mediaRequired ? "Yes" : "No"}`,
    `- **Formats:** ${spec.formats.join(", ")}`,
    "",
    `## ${spec.platform} Guidelines`,
    "",
    `Read the detailed ${platform} skill using flowboost_read_project_data:`,
    `  resource: "skill:social/${platform}"`,
    `Follow the tone, structure, and style rules from that skill document.`,
    `If the skill file is not available, write a professional, engaging post following these defaults:`,
    spec.guidelines,
    "",
    "## Brand Voice",
    `- **Language:** ${project.defaultLanguage === "de" ? "German (Du-Ansprache)" : project.defaultLanguage}`,
    "- Follow the project's brand voice guidelines",
    "",
    "## Output Format",
    "Return a JSON object:",
    "```json",
    "{",
    '  "text": "The post text (within character limit)",',
    '  "hashtags": ["tag1", "tag2"],',
    `  "format": "one of: ${spec.formats.join(", ")}",`,
    '  "imagePrompt": "If media is needed: a detailed image generation prompt in English. Otherwise null.",',
    '  "slides": ["Slide 1 text", "Slide 2 text"] // Only for carousel format, otherwise null',
    "}",
    "```",
    "",
    `IMPORTANT: Stay within ${spec.charLimit} characters for the text. Count carefully.`,
  );

  return parts.join("\n");
}
