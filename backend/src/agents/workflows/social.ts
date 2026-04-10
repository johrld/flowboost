import { createLogger } from "../../utils/logger.js";
import { PipelineContext } from "../../pipeline/context.js";
import { JobStore } from "../../models/job.js";
import { executeJob, loadMemoryContext } from "../executor.js";
import { extractJson } from "../../pipeline/extract-json.js";
import type { Job, ContentItem, ContentItemStatus } from "../../models/types.js";

const log = createLogger("workflow:social");

/**
 * Social Post Workflow (Job-based).
 *
 * Creates a social post for a specific platform, optionally derived from an existing article.
 */
export async function runSocialWorkflow(
  ctx: PipelineContext,
  jobs: JobStore,
  opts: {
    platform: string; // "linkedin" | "instagram" | "x" | "tiktok"
    sourceContentId?: string; // If deriving from an existing article
  },
): Promise<ContentItem> {
  const { project, topic } = ctx;
  if (!topic) throw new Error("Social workflow requires a topic");

  const now = () => new Date().toISOString();

  log.info({ topic: topic.title, platform: opts.platform, runId: ctx.run.id }, "starting social workflow");
  ctx.updateRun({ status: "running", startedAt: now() });

  // Load source article if provided
  let sourceArticle = "";
  if (opts.sourceContentId) {
    sourceArticle = ctx.stores.content.readTextFile(opts.sourceContentId, "v1.md") ?? "";
  }

  const flowContext = ctx.buildFullFlowContext({ includeChat: false });
  const memoryContext = loadMemoryContext(ctx.projectDir);

  // ── Create and execute social writer job ──────────────────
  ctx.startPhase("writing");
  const socialJob = jobs.create({
    customerId: ctx.customerId,
    projectId: project.id,
    type: "write_social",
    flowId: topic.id,
    contentId: opts.sourceContentId,
    assigneeAgent: "social-writer",
    status: "queued",
    title: `${opts.platform} post: ${topic.title}`,
    description: `Write a ${opts.platform} post${opts.sourceContentId ? " based on existing article" : ""}`,
    input: {
      platform: opts.platform,
      topicTitle: topic.title,
      briefing: topic.briefing ?? "",
      sourceArticle: sourceArticle.slice(0, 5000), // Truncate for prompt
    },
    comments: [],
    createdAt: now(),
    runId: ctx.run.id,
  }) as Job;

  jobs.transition(socialJob.id, "in_progress");
  let postData: Record<string, unknown>;
  try {
    const result = await executeJob(ctx, socialJob, { memoryContext, additionalContext: flowContext });
    postData = extractJson(result.text) ?? { text: result.text };
    jobs.transition(socialJob.id, "done", postData);
    ctx.completePhase("writing");
  } catch (err) {
    jobs.transition(socialJob.id, "failed");
    ctx.failPhase("writing", String(err));
    throw new Error(`Social writing failed: ${err}`);
  }

  // ── Create Content Item ───────────────────────────────────
  const contentNow = now();
  let contentItem: ContentItem;
  const preCreated = ctx.run.contentId ? ctx.stores.content.get(ctx.run.contentId) : null;

  if (preCreated) {
    contentItem = preCreated;
    ctx.stores.content.update(contentItem.id, {
      status: "draft" as ContentItemStatus,
      updatedAt: contentNow,
    });
  } else {
    contentItem = ctx.stores.content.create({
      customerId: ctx.customerId,
      projectId: project.id,
      type: "social_post" as ContentItem["type"],
      status: "draft" as ContentItemStatus,
      title: topic.title,
      category: opts.platform,
      flowId: topic.id,
      originFlowId: topic.id,
      topicId: topic.id,
      createdAt: contentNow,
      updatedAt: contentNow,
    }) as ContentItem;
  }

  // Save post data as JSON
  ctx.stores.content.writeFile(contentItem.id, "v1.json", postData);

  ctx.updateRun({ status: "completed", completedAt: contentNow, contentId: contentItem.id });

  log.info({ contentId: contentItem.id, platform: opts.platform }, "social workflow completed");
  return contentItem;
}
