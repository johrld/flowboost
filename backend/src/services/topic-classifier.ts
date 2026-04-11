import { createLogger } from "../utils/logger.js";

const log = createLogger("topic-classifier");

/**
 * Default topic clusters for meditation/wellness.
 * Each cluster has keywords that trigger classification.
 */
const DEFAULT_CLUSTERS: Record<string, string[]> = {
  "meditation": ["meditation", "meditate", "mindfulness meditation", "guided meditation", "vipassana", "zen", "transcendental"],
  "breathing-techniques": ["breathing", "breathwork", "breath", "box breathing", "4-7-8", "pranayama", "diaphragmatic", "wim hof"],
  "sleep": ["sleep", "insomnia", "bedtime", "nap", "rest", "sleep hygiene", "sleep meditation", "sleep story"],
  "stress": ["stress", "burnout", "overwhelm", "tension", "cortisol", "relaxation", "relax", "unwind"],
  "anxiety": ["anxiety", "anxious", "panic", "worry", "nervous", "fear", "calm down", "calming"],
  "mindfulness": ["mindful", "mindfulness", "present moment", "awareness", "attention", "conscious"],
  "focus-productivity": ["focus", "concentration", "productivity", "attention", "mental clarity", "performance", "work"],
  "body-wellness": ["body scan", "yoga", "muscle relaxation", "progressive muscle", "PMR", "stretching", "posture"],
  "emotional-health": ["emotion", "mood", "happiness", "gratitude", "self-compassion", "loving-kindness", "metta", "resilience"],
  "relationships": ["relationship", "compassion", "empathy", "communication", "forgiveness", "kindness"],
  "beginners": ["beginner", "getting started", "how to start", "introduction", "basics", "first time", "101"],
  "science-research": ["study", "research", "science", "neuroscience", "brain", "evidence", "clinical"],
  "depression": ["depression", "depressed", "sadness", "grief", "loss", "therapy"],
  "pain-management": ["pain", "chronic pain", "headache", "migraine", "back pain"],
  "children-family": ["kids", "children", "family", "parenting", "teen", "school"],
  "workplace": ["office", "workplace", "meeting", "team", "leadership", "corporate"],
};

/**
 * Classify an article title into a topic cluster using keyword matching.
 * Returns the cluster name or null if no match found (needs agent classification).
 */
export function classifyByKeyword(title: string, h2Headings: string[] = []): string | null {
  const text = [title, ...h2Headings].join(" ").toLowerCase();

  const scores: Array<{ cluster: string; score: number }> = [];

  for (const [cluster, keywords] of Object.entries(DEFAULT_CLUSTERS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        // Longer keywords get higher scores (more specific)
        score += kw.length;
      }
    }
    if (score > 0) {
      scores.push({ cluster, score });
    }
  }

  if (scores.length === 0) return null;

  // Return the highest-scoring cluster
  scores.sort((a, b) => b.score - a.score);
  return scores[0].cluster;
}

/**
 * Classify a batch of articles.
 * Returns classified articles and unclassified ones (for agent fallback).
 */
export function classifyBatch(
  articles: Array<{ url: string; title: string; h2Headings?: string[] }>,
): {
  classified: Array<{ url: string; title: string; topicCluster: string }>;
  unclassified: Array<{ url: string; title: string }>;
} {
  const classified: Array<{ url: string; title: string; topicCluster: string }> = [];
  const unclassified: Array<{ url: string; title: string }> = [];

  for (const article of articles) {
    const cluster = classifyByKeyword(article.title, article.h2Headings);
    if (cluster) {
      classified.push({ url: article.url, title: article.title, topicCluster: cluster });
    } else {
      unclassified.push({ url: article.url, title: article.title });
    }
  }

  log.info(
    { total: articles.length, classified: classified.length, unclassified: unclassified.length },
    "batch classification done",
  );

  return { classified, unclassified };
}

/**
 * Get the list of known cluster names.
 */
export function getKnownClusters(): string[] {
  return Object.keys(DEFAULT_CLUSTERS);
}
