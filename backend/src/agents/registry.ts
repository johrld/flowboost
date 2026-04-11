import type { AgentDefinition } from "../models/types.js";

/**
 * Agent Registry — all FlowBoost agents defined in code.
 *
 * Agent behavior comes from skill files (Markdown), not from this registry.
 * This registry defines: model, tools, capabilities, and scheduling.
 */

const FLOWBOOST_MCP_TOOLS = [
  "mcp__flowboost__flowboost_read_content_index",
  "mcp__flowboost__flowboost_read_project_data",
  "mcp__flowboost__flowboost_read_memory",
  "mcp__flowboost__flowboost_write_memory",
  "mcp__flowboost__flowboost_read_article",
  "mcp__flowboost__flowboost_validate_article",
  "mcp__flowboost__flowboost_validate_section",
  "mcp__flowboost__flowboost_validate_social_post",
  "mcp__flowboost__flowboost_validate_newsletter",
  "mcp__flowboost__flowboost_assemble_article",
  "mcp__flowboost__flowboost_generate_image",
  "mcp__flowboost__flowboost_query_competitor_blog",
];

export const AGENTS: Record<string, AgentDefinition> = {
  // ── Strategic ─────────────────────────────────────────────
  cmo: {
    name: "cmo",
    role: "Chief Marketing Officer",
    model: "sonnet",
    maxTurns: 10,
    skills: ["flowboost-api", "cmo"],
    tools: [...FLOWBOOST_MCP_TOOLS, "WebSearch", "WebFetch"],
    useMcpTools: true,
    canDelegate: true,
    canApprove: true,
  },

  // ── Research ──────────────────────────────────────────────
  research: {
    name: "research",
    role: "Content Researcher",
    model: "sonnet",
    maxTurns: 20,
    skills: ["flowboost-api", "research"],
    tools: [...FLOWBOOST_MCP_TOOLS, "WebSearch", "WebFetch"],
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
  },

  // ── Article Production ────────────────────────────────────
  "outline-architect": {
    name: "outline-architect",
    role: "Article Outline Architect",
    model: "sonnet",
    maxTurns: 5,
    skills: ["flowboost-api", "outline-architect"],
    tools: FLOWBOOST_MCP_TOOLS,
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
  },

  "section-writer": {
    name: "section-writer",
    role: "Section Writer",
    model: "sonnet",
    maxTurns: 5,
    skills: ["flowboost-api", "section-writer"],
    tools: ["mcp__flowboost__flowboost_validate_section", "mcp__flowboost__flowboost_read_project_data"],
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
  },

  "content-editor": {
    name: "content-editor",
    role: "Content Editor & Assembler",
    model: "sonnet",
    maxTurns: 5,
    skills: ["flowboost-api", "content-editor"],
    tools: [
      "mcp__flowboost__flowboost_assemble_article",
      "mcp__flowboost__flowboost_validate_article",
      "mcp__flowboost__flowboost_read_project_data",
    ],
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
  },

  // ── Quality ───────────────────────────────────────────────
  "quality-seo": {
    name: "quality-seo",
    role: "SEO Quality Checker",
    model: "haiku",
    maxTurns: 3,
    skills: ["quality-seo"],
    tools: ["mcp__flowboost__flowboost_read_project_data", "mcp__flowboost__flowboost_read_content_index"],
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
  },

  "quality-citations": {
    name: "quality-citations",
    role: "Citation Checker",
    model: "sonnet",
    maxTurns: 15,
    skills: ["quality-citations"],
    tools: [...FLOWBOOST_MCP_TOOLS, "WebSearch", "WebFetch"],
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
  },

  "quality-eeat": {
    name: "quality-eeat",
    role: "E-E-A-T Compliance Checker",
    model: "haiku",
    maxTurns: 3,
    skills: ["quality-eeat"],
    tools: ["mcp__flowboost__flowboost_read_project_data", "mcp__flowboost__flowboost_read_memory"],
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
  },

  "quality-health": {
    name: "quality-health",
    role: "Health Claims Validator",
    model: "sonnet",
    maxTurns: 5,
    skills: ["quality-health"],
    tools: [],
    useMcpTools: false,
    canDelegate: false,
    canApprove: false,
  },

  // ── Social & Newsletter ───────────────────────────────────
  "social-writer": {
    name: "social-writer",
    role: "Social Media Writer",
    model: "sonnet",
    maxTurns: 3,
    skills: ["flowboost-api", "social-writer"],
    tools: ["mcp__flowboost__flowboost_validate_social_post", "mcp__flowboost__flowboost_read_project_data"],
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
  },

  "newsletter-writer": {
    name: "newsletter-writer",
    role: "Newsletter Writer",
    model: "sonnet",
    maxTurns: 3,
    skills: ["flowboost-api", "newsletter-writer"],
    tools: ["mcp__flowboost__flowboost_validate_newsletter", "mcp__flowboost__flowboost_read_project_data"],
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
  },

  // ── Translation & Image ───────────────────────────────────
  translator: {
    name: "translator",
    role: "Translator",
    model: "sonnet",
    maxTurns: 3,
    skills: ["flowboost-api"],
    tools: ["mcp__flowboost__flowboost_read_project_data"],
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
  },

  "image-generator": {
    name: "image-generator",
    role: "Image Generator",
    model: "haiku",
    maxTurns: 3,
    skills: [],
    tools: ["mcp__flowboost__flowboost_generate_image"],
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
  },

  // ── Background Monitors ───────────────────────────────────
  "monitor-competitors": {
    name: "monitor-competitors",
    role: "Competitor Monitor",
    model: "haiku",
    maxTurns: 20,
    skills: ["monitor-competitor"],
    tools: [...FLOWBOOST_MCP_TOOLS, "WebSearch", "WebFetch"],
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
    heartbeat: { enabled: true, schedule: "0 9 * * 1" }, // Monday 9am
  },

  "monitor-trends": {
    name: "monitor-trends",
    role: "Trend Scanner",
    model: "haiku",
    maxTurns: 15,
    skills: ["monitor-trends"],
    tools: [...FLOWBOOST_MCP_TOOLS, "WebSearch", "WebFetch"],
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
    heartbeat: { enabled: true, schedule: "0 9 * * 3" }, // Wednesday 9am
  },

  "monitor-content": {
    name: "monitor-content",
    role: "Content Index Watcher",
    model: "haiku",
    maxTurns: 10,
    skills: ["monitor-content"],
    tools: FLOWBOOST_MCP_TOOLS,
    useMcpTools: true,
    canDelegate: false,
    canApprove: false,
    heartbeat: { enabled: true, schedule: "0 6 * * *" }, // Daily 6am
  },
};

export function getAgent(name: string): AgentDefinition | undefined {
  return AGENTS[name];
}

export function listAgents(): AgentDefinition[] {
  return Object.values(AGENTS);
}

export function getMonitorAgents(): AgentDefinition[] {
  return listAgents().filter((a) => a.heartbeat?.enabled);
}
