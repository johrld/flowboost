#!/usr/bin/env npx tsx
/**
 * Migration: Flat data structure → Nested Customer/Project structure
 *
 * Before:
 *   data/projects/{pid}/
 *   data/articles/{aid}/
 *   data/pipeline-runs/{rid}/
 *
 * After:
 *   data/customers/{cid}/customer.json + brand-voice.md + style-guide.md
 *   data/customers/{cid}/projects/{pid}/
 *   data/customers/{cid}/projects/{pid}/topics/{tid}/topic.json
 *   data/customers/{cid}/projects/{pid}/articles/{aid}/
 *   data/customers/{cid}/projects/{pid}/pipeline-runs/{rid}/
 */
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(import.meta.dirname, "../data");
const CUSTOMER_ID = "default";

console.log("=== FlowBoost: Migrate to Nested Structure ===\n");
console.log(`Data dir: ${dataDir}`);

// ── Preflight checks ──────────────────────────────────────────────
if (fs.existsSync(path.join(dataDir, "customers"))) {
  console.log("\n⚠️  data/customers/ already exists. Migration may have already run.");
  console.log("   Delete data/customers/ manually if you want to re-run.\n");
  process.exit(1);
}

// ── Step 1: Backup ────────────────────────────────────────────────
const backupDir = path.join(dataDir, "..", `data-backup-${Date.now()}`);
console.log(`\n1. Backing up to ${backupDir}`);
fs.mkdirSync(backupDir, { recursive: true });
for (const dir of ["projects", "articles", "pipeline-runs"]) {
  const src = path.join(dataDir, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(backupDir, dir), { recursive: true });
  }
}
console.log("   Done.");

// ── Step 2: Create customer ───────────────────────────────────────
console.log("\n2. Creating default customer");
const customerDir = path.join(dataDir, "customers", CUSTOMER_ID);
fs.mkdirSync(customerDir, { recursive: true });

// Find all projects to extract authors
const projectsDir = path.join(dataDir, "projects");
const projectDirs = fs.existsSync(projectsDir)
  ? fs.readdirSync(projectsDir, { withFileTypes: true }).filter((d) => d.isDirectory())
  : [];

let authors: unknown[] = [];
for (const pd of projectDirs) {
  const projectJson = path.join(projectsDir, pd.name, "project.json");
  if (fs.existsSync(projectJson)) {
    const project = JSON.parse(fs.readFileSync(projectJson, "utf-8"));
    if (project.authors?.length) {
      authors = project.authors;
      break;
    }
  }
}

const customer = {
  id: CUSTOMER_ID,
  name: "Default",
  slug: "default",
  plan: "pro",
  authors,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(customerDir, "customer.json"), JSON.stringify(customer, null, 2));
console.log(`   Created customer.json with ${authors.length} authors`);

// ── Step 3: Move brand-voice + style-guide to customer level ──────
console.log("\n3. Moving brand-voice.md + style-guide.md to customer level");
for (const pd of projectDirs) {
  for (const file of ["brand-voice.md", "style-guide.md"]) {
    const src = path.join(projectsDir, pd.name, file);
    const dest = path.join(customerDir, file);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
      console.log(`   ${file}: moved to customer level`);
    }
  }
}

// ── Step 4: Move projects ─────────────────────────────────────────
console.log("\n4. Moving projects to nested structure");
const customerProjectsDir = path.join(customerDir, "projects");
fs.mkdirSync(customerProjectsDir, { recursive: true });

for (const pd of projectDirs) {
  const src = path.join(projectsDir, pd.name);
  const dest = path.join(customerProjectsDir, pd.name);
  fs.cpSync(src, dest, { recursive: true });

  // Update project.json: add customerId, remove authors
  const projectJsonPath = path.join(dest, "project.json");
  if (fs.existsSync(projectJsonPath)) {
    const project = JSON.parse(fs.readFileSync(projectJsonPath, "utf-8"));
    project.customerId = CUSTOMER_ID;
    delete project.authors;
    fs.writeFileSync(projectJsonPath, JSON.stringify(project, null, 2));
  }

  console.log(`   Project ${pd.name}: moved + updated`);
}

// ── Step 5: Extract topics from content-plan.json ─────────────────
console.log("\n5. Extracting topics from content-plan.json");
let topicCount = 0;
for (const pd of projectDirs) {
  const contentPlanPath = path.join(customerProjectsDir, pd.name, "content-plan.json");
  if (!fs.existsSync(contentPlanPath)) continue;

  const plan = JSON.parse(fs.readFileSync(contentPlanPath, "utf-8"));
  const topics = plan.topics ?? [];

  if (topics.length > 0) {
    const topicsDir = path.join(customerProjectsDir, pd.name, "topics");
    for (const topic of topics) {
      const topicDir = path.join(topicsDir, topic.id);
      fs.mkdirSync(topicDir, { recursive: true });
      fs.writeFileSync(path.join(topicDir, "topic.json"), JSON.stringify(topic, null, 2));
      topicCount++;
    }

    // Remove topics from content-plan, keep audit data
    delete plan.topics;
    plan.updatedAt = new Date().toISOString();
    fs.writeFileSync(contentPlanPath, JSON.stringify(plan, null, 2));
  }

  console.log(`   Project ${pd.name}: ${topics.length} topics extracted`);
}

// ── Step 6: Move articles ─────────────────────────────────────────
console.log("\n6. Moving articles");
const articlesDir = path.join(dataDir, "articles");
let articleCount = 0;
if (fs.existsSync(articlesDir)) {
  const articleDirs = fs.readdirSync(articlesDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const ad of articleDirs) {
    const articleJsonPath = path.join(articlesDir, ad.name, "article.json");
    if (!fs.existsSync(articleJsonPath)) continue;

    const article = JSON.parse(fs.readFileSync(articleJsonPath, "utf-8"));
    const projectId = article.projectId;

    const destDir = path.join(customerProjectsDir, projectId, "articles", ad.name);
    fs.cpSync(path.join(articlesDir, ad.name), destDir, { recursive: true });

    // Add customerId
    article.customerId = CUSTOMER_ID;
    fs.writeFileSync(path.join(destDir, "article.json"), JSON.stringify(article, null, 2));
    articleCount++;

    console.log(`   Article ${ad.name} → project ${projectId}`);
  }
}

// ── Step 7: Move pipeline-runs ────────────────────────────────────
console.log("\n7. Moving pipeline-runs");
const runsDir = path.join(dataDir, "pipeline-runs");
let runCount = 0;
if (fs.existsSync(runsDir)) {
  const runDirs = fs.readdirSync(runsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const rd of runDirs) {
    const runJsonPath = path.join(runsDir, rd.name, "run.json");
    if (!fs.existsSync(runJsonPath)) continue;

    const run = JSON.parse(fs.readFileSync(runJsonPath, "utf-8"));
    const projectId = run.projectId;

    const destDir = path.join(customerProjectsDir, projectId, "pipeline-runs", rd.name);
    fs.cpSync(path.join(runsDir, rd.name), destDir, { recursive: true });

    // Add customerId
    run.customerId = CUSTOMER_ID;
    fs.writeFileSync(path.join(destDir, "run.json"), JSON.stringify(run, null, 2));
    runCount++;

    console.log(`   Run ${rd.name} → project ${projectId}`);
  }
}

// ── Step 8: Clean up old directories ──────────────────────────────
console.log("\n8. Cleaning up old directories");
for (const dir of ["projects", "articles", "pipeline-runs"]) {
  const oldDir = path.join(dataDir, dir);
  if (fs.existsSync(oldDir)) {
    fs.rmSync(oldDir, { recursive: true });
    console.log(`   Removed data/${dir}/`);
  }
}

// ── Summary ───────────────────────────────────────────────────────
console.log("\n=== Migration Complete ===");
console.log(`  Customer:      ${CUSTOMER_ID}`);
console.log(`  Projects:      ${projectDirs.length}`);
console.log(`  Topics:        ${topicCount}`);
console.log(`  Articles:      ${articleCount}`);
console.log(`  Pipeline Runs: ${runCount}`);
console.log(`  Backup:        ${backupDir}`);
console.log();
