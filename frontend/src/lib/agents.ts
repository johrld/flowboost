export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  avatar: string; // emoji fallback
  image: string; // round avatar image path
  imageSquare: string; // square avatar for cards
  color: string; // tailwind color for accents
  phases: string[]; // pipeline phases this agent handles
  stats: {
    tasksCompleted: number;
    avgDuration: string;
    lastActive: string;
  };
}

export const agents: Agent[] = [
  {
    id: "researcher",
    name: "Aria",
    role: "Content Strategist",
    description: "Discovers high-potential topics through keyword research, competition analysis, and trend monitoring.",
    avatar: "🔍",
    image: "/images/agents/researcher-round.png",
    imageSquare: "/images/agents/researcher-square.png",
    color: "green",
    phases: ["audit", "research", "strategy"],
    stats: { tasksCompleted: 12, avgDuration: "3 min", lastActive: "2 hours ago" },
  },
  {
    id: "architect",
    name: "Max",
    role: "Outline Architect",
    description: "Creates detailed article structures with section-level outlines, word targets, and SEO placement.",
    avatar: "📐",
    image: "/images/agents/architect-round.png",
    imageSquare: "/images/agents/architect-square.png",
    color: "blue",
    phases: ["outline"],
    stats: { tasksCompleted: 8, avgDuration: "2 min", lastActive: "3 hours ago" },
  },
  {
    id: "writer",
    name: "Lena",
    role: "Content Writer",
    description: "Writes engaging, evidence-based content section by section. Can work in parallel on multiple sections.",
    avatar: "✍️",
    image: "/images/agents/writer-round.png",
    imageSquare: "/images/agents/writer-square.png",
    color: "amber",
    phases: ["writing"],
    stats: { tasksCompleted: 42, avgDuration: "4 min", lastActive: "1 hour ago" },
  },
  {
    id: "editor",
    name: "Sophie",
    role: "Chief Editor",
    description: "Assembles sections into a cohesive article, refines transitions, and validates quality metrics.",
    avatar: "📝",
    image: "/images/agents/editor-round.png",
    imageSquare: "/images/agents/editor-square.png",
    color: "purple",
    phases: ["assembly"],
    stats: { tasksCompleted: 8, avgDuration: "3 min", lastActive: "3 hours ago" },
  },
  {
    id: "designer",
    name: "Kai",
    role: "Visual Designer",
    description: "Generates hero images and visual assets using Imagen 4 to match article content and brand style.",
    avatar: "🎨",
    image: "/images/agents/designer-round.png",
    imageSquare: "/images/agents/designer-square.png",
    color: "emerald",
    phases: ["image"],
    stats: { tasksCompleted: 7, avgDuration: "1 min", lastActive: "4 hours ago" },
  },
  {
    id: "seo-checker",
    name: "Nora",
    role: "SEO Analyst",
    description: "Performs technical SEO checks: keyword density, meta tags, headings structure, internal linking.",
    avatar: "📊",
    image: "/images/agents/seo-checker-round.png",
    imageSquare: "/images/agents/seo-checker-square.png",
    color: "cyan",
    phases: ["quality"],
    stats: { tasksCompleted: 8, avgDuration: "1 min", lastActive: "3 hours ago" },
  },
  {
    id: "reviewer",
    name: "Tomas",
    role: "Brand Guardian",
    description: "Ensures brand voice compliance, checks forbidden terms, validates tone and writing style.",
    avatar: "🛡️",
    image: "/images/agents/reviewer-round.png",
    imageSquare: "/images/agents/reviewer-square.png",
    color: "orange",
    phases: ["quality"],
    stats: { tasksCompleted: 8, avgDuration: "1 min", lastActive: "3 hours ago" },
  },
  {
    id: "translator",
    name: "Mia",
    role: "Localization Specialist",
    description: "Translates articles from German to English and Spanish while preserving SEO structure and brand voice.",
    avatar: "🌍",
    image: "/images/agents/translator-round.png",
    imageSquare: "/images/agents/translator-square.png",
    color: "violet",
    phases: ["translation"],
    stats: { tasksCompleted: 14, avgDuration: "5 min", lastActive: "5 hours ago" },
  },
];

// Map pipeline phase to agents involved
export const phaseAgents: Record<string, string[]> = {
  // Strategy phases
  audit: ["researcher"],
  research: ["researcher"],
  strategy: ["researcher"],
  // Production phases
  outline: ["architect"],
  writing: ["writer"],
  assembly: ["editor"],
  image: ["designer"],
  quality: ["seo-checker", "reviewer"],
  translation: ["translator"],
};

export const phaseLabels: Record<string, string> = {
  // Strategy phases
  audit: "Content Audit",
  research: "Research",
  strategy: "Strategy",
  // Production phases
  outline: "Outline",
  writing: "Writing",
  assembly: "Assembly",
  image: "Image",
  quality: "Quality",
  translation: "Translation",
};

export function getAgent(id: string): Agent | undefined {
  return agents.find((a) => a.id === id);
}
