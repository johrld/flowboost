import type {
  ContentGapMatrix,
  ContentGapCluster,
  CompetitorTopicCoverage,
  CompetitorIndex,
  CompetitorIndexEntry,
  CompetitorBlogIndex,
} from "../models/types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("gap-analyzer");

type Depth = "deep" | "moderate" | "thin" | "none";

function computeDepth(count: number): Depth {
  if (count >= 5) return "deep";
  if (count >= 2) return "moderate";
  if (count >= 1) return "thin";
  return "none";
}

/**
 * Compute the content gap matrix from our content index and competitor coverage data.
 * Pure code — no LLM calls.
 */
export function computeGapMatrix(
  projectId: string,
  ourArticlesByCluster: Record<string, number>,
  competitorCoverages: Array<{ slug: string; coverage: CompetitorTopicCoverage }>,
): ContentGapMatrix {
  // Collect all known clusters
  const allClusters = new Set<string>();
  for (const cluster of Object.keys(ourArticlesByCluster)) {
    allClusters.add(cluster);
  }
  for (const { coverage } of competitorCoverages) {
    for (const c of coverage.clusters) {
      allClusters.add(c.cluster);
    }
  }

  const clusters: ContentGapCluster[] = [];
  let weLead = 0;
  let weLag = 0;
  let mutualGaps = 0;
  let saturated = 0;

  for (const cluster of allClusters) {
    const ourCount = ourArticlesByCluster[cluster] ?? 0;
    const ourDepth = computeDepth(ourCount);

    const competitors: Record<string, { count: number; depth: Depth }> = {};
    let maxCompetitorCount = 0;
    let competitorsWithContent = 0;

    for (const { slug, coverage } of competitorCoverages) {
      const entry = coverage.clusters.find((c) => c.cluster === cluster);
      const count = entry?.articleCount ?? 0;
      competitors[slug] = { count, depth: computeDepth(count) };
      if (count > maxCompetitorCount) maxCompetitorCount = count;
      if (count > 0) competitorsWithContent++;
    }

    // Determine gap type
    let gapType: ContentGapCluster["gapType"];
    if (ourCount === 0 && maxCompetitorCount === 0) {
      gapType = "mutual_gap";
      mutualGaps++;
    } else if (ourCount > 0 && maxCompetitorCount === 0) {
      gapType = "our_exclusive";
    } else if (ourCount >= maxCompetitorCount && ourCount > 0) {
      gapType = "we_lead";
      weLead++;
    } else if (ourCount > 0 && ourCount < maxCompetitorCount) {
      // Check if saturated (we have content but everyone does deeply)
      if (ourDepth === "deep" && competitorsWithContent === competitorCoverages.length) {
        gapType = "saturated";
        saturated++;
      } else {
        gapType = "we_lag";
        weLag++;
      }
    } else {
      // ourCount === 0, competitors have content
      gapType = "we_lag";
      weLag++;
    }

    // Priority
    let priority: "high" | "medium" | "low";
    if (gapType === "we_lag" && competitorsWithContent >= 2) {
      priority = "high"; // Multiple competitors cover it, we don't
    } else if (gapType === "we_lag") {
      priority = "medium";
    } else if (gapType === "mutual_gap") {
      priority = "low"; // No one covers it — might be low value
    } else {
      priority = "low";
    }

    // Recommendation
    let recommendation = "";
    if (gapType === "we_lag" && ourCount === 0) {
      const names = Object.entries(competitors)
        .filter(([, v]) => v.count > 0)
        .map(([k, v]) => `${k} (${v.count})`)
        .join(", ");
      recommendation = `Missing topic: ${names} cover this, we don't. Create content.`;
    } else if (gapType === "we_lag") {
      const leader = Object.entries(competitors).sort(([, a], [, b]) => b.count - a.count)[0];
      recommendation = `${leader[0]} leads with ${leader[1].count} articles, we have ${ourCount}. Expand coverage.`;
    } else if (gapType === "we_lead") {
      recommendation = `We lead with ${ourCount} articles. Maintain and deepen.`;
    } else if (gapType === "our_exclusive") {
      recommendation = `Only we cover this (${ourCount} articles). Strengthen as differentiator.`;
    } else if (gapType === "mutual_gap") {
      recommendation = `No one covers this yet. Evaluate if it has search demand — potential first mover opportunity.`;
    } else {
      recommendation = `Saturated topic — all competitors cover deeply. Focus on differentiation, not volume.`;
    }

    clusters.push({ cluster, ourCount, ourDepth, competitors, gapType, priority, recommendation });
  }

  // Sort: high priority first, then by competitor coverage
  clusters.sort((a, b) => {
    const prio = { high: 0, medium: 1, low: 2 };
    if (prio[a.priority] !== prio[b.priority]) return prio[a.priority] - prio[b.priority];
    const maxA = Math.max(...Object.values(a.competitors).map((c) => c.count));
    const maxB = Math.max(...Object.values(b.competitors).map((c) => c.count));
    return maxB - maxA;
  });

  log.info(
    { totalClusters: clusters.length, weLead, weLag, mutualGaps, saturated },
    "gap matrix computed",
  );

  return {
    projectId,
    updatedAt: new Date().toISOString(),
    clusters,
    summary: { totalClusters: clusters.length, weLead, weLag, mutualGaps, saturated },
  };
}

/**
 * Compute topic coverage from a blog index.
 */
export function computeTopicCoverage(
  competitorSlug: string,
  blogIndex: CompetitorBlogIndex,
): CompetitorTopicCoverage {
  const clusterMap = new Map<string, { count: number; latestDate: string | null }>();

  for (const article of blogIndex.articles) {
    const cluster = article.topicCluster ?? "uncategorized";
    const existing = clusterMap.get(cluster) ?? { count: 0, latestDate: null };
    existing.count++;
    if (article.publishedAt && (!existing.latestDate || article.publishedAt > existing.latestDate)) {
      existing.latestDate = article.publishedAt;
    }
    clusterMap.set(cluster, existing);
  }

  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const clusters = [...clusterMap.entries()]
    .filter(([name]) => name !== "uncategorized")
    .map(([cluster, data]) => ({
      cluster,
      articleCount: data.count,
      depth: computeDepth(data.count) as "deep" | "moderate" | "thin",
      latestArticleAt: data.latestDate,
      trend: (data.latestDate && data.latestDate > threeMonthsAgo
        ? "growing"
        : data.latestDate && data.latestDate > sixMonthsAgo
          ? "stable"
          : "dormant") as "growing" | "stable" | "dormant",
    }))
    .sort((a, b) => b.articleCount - a.articleCount);

  // Find clusters covered by others but not this competitor (filled later by caller)
  return {
    competitorSlug,
    updatedAt: new Date().toISOString(),
    clusters,
    uncoveredClusters: [],
  };
}

/**
 * Generate the cross-competitor _index.json summary.
 */
export function computeCompetitorIndex(
  projectId: string,
  blogIndexes: Array<{ slug: string; name: string; domain: string; blogUrl: string; sitemapUrl: string | null; index: CompetitorBlogIndex }>,
  gapMatrix: ContentGapMatrix,
  ourArticleCount: number,
): CompetitorIndex {
  const competitors: CompetitorIndexEntry[] = blogIndexes.map(({ slug, name, domain, blogUrl, sitemapUrl, index }) => {
    // Top clusters by article count
    const clusterCounts = new Map<string, number>();
    for (const a of index.articles) {
      if (a.topicCluster) {
        clusterCounts.set(a.topicCluster, (clusterCounts.get(a.topicCluster) ?? 0) + 1);
      }
    }
    const topClusters = [...clusterCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c);

    // Recent articles
    const recentArticles = index.articles
      .filter((a) => a.discoveredAt)
      .sort((a, b) => (b.discoveredAt ?? "").localeCompare(a.discoveredAt ?? ""));
    const newSinceLastScan = recentArticles.filter((a) => {
      const discovered = new Date(a.discoveredAt);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return discovered > weekAgo;
    }).length;

    const recentHighlight = recentArticles[0]
      ? `Latest: "${recentArticles[0].title}"`
      : "No recent activity";

    return {
      slug,
      name,
      domain,
      blogUrl,
      sitemapUrl,
      totalArticles: index.totalArticles,
      lastScanAt: index.lastCrawlAt,
      newSinceLastScan,
      topClusters,
      recentHighlight,
    };
  });

  const topGaps = gapMatrix.clusters
    .filter((c) => c.gapType === "we_lag" && c.ourCount === 0)
    .slice(0, 5)
    .map((c) => c.cluster);

  const topOpportunities = gapMatrix.clusters
    .filter((c) => c.priority === "high")
    .slice(0, 5)
    .map((c) => `${c.cluster}: ${c.recommendation}`);

  return {
    projectId,
    updatedAt: new Date().toISOString(),
    competitors,
    ourTotalArticles: ourArticleCount,
    topGaps,
    topOpportunities,
  };
}
