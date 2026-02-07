export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  avatar: string; // emoji for now, later AI-generated images
  color: string; // tailwind color for accents
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
    color: "purple",
    stats: { tasksCompleted: 12, avgDuration: "3 min", lastActive: "2 hours ago" },
  },
  {
    id: "architect",
    name: "Max",
    role: "Outline Architect",
    description: "Creates detailed article structures with section-level outlines, word targets, and SEO placement.",
    avatar: "📐",
    color: "blue",
    stats: { tasksCompleted: 8, avgDuration: "2 min", lastActive: "3 hours ago" },
  },
  {
    id: "writer",
    name: "Lena",
    role: "Content Writer",
    description: "Writes engaging, evidence-based content section by section. Can work in parallel on multiple sections.",
    avatar: "✍️",
    color: "green",
    stats: { tasksCompleted: 42, avgDuration: "4 min", lastActive: "1 hour ago" },
  },
  {
    id: "editor",
    name: "Sophie",
    role: "Chief Editor",
    description: "Assembles sections into a cohesive article, refines transitions, and validates quality metrics.",
    avatar: "📝",
    color: "orange",
    stats: { tasksCompleted: 8, avgDuration: "3 min", lastActive: "3 hours ago" },
  },
  {
    id: "designer",
    name: "Kai",
    role: "Visual Designer",
    description: "Generates hero images and visual assets using Imagen 4 to match article content and brand style.",
    avatar: "🎨",
    color: "pink",
    stats: { tasksCompleted: 7, avgDuration: "1 min", lastActive: "4 hours ago" },
  },
  {
    id: "seo-checker",
    name: "Nora",
    role: "SEO Analyst",
    description: "Performs technical SEO checks: keyword density, meta tags, headings structure, internal linking.",
    avatar: "📊",
    color: "cyan",
    stats: { tasksCompleted: 8, avgDuration: "1 min", lastActive: "3 hours ago" },
  },
  {
    id: "reviewer",
    name: "Tomas",
    role: "Brand Guardian",
    description: "Ensures brand voice compliance, checks forbidden terms, validates tone and writing style.",
    avatar: "🛡️",
    color: "yellow",
    stats: { tasksCompleted: 8, avgDuration: "1 min", lastActive: "3 hours ago" },
  },
  {
    id: "translator",
    name: "Mia",
    role: "Localization Specialist",
    description: "Translates articles from German to English and Spanish while preserving SEO structure and brand voice.",
    avatar: "🌍",
    color: "indigo",
    stats: { tasksCompleted: 14, avgDuration: "5 min", lastActive: "5 hours ago" },
  },
];

// Map pipeline phase to agents involved
export const phaseAgents: Record<string, string[]> = {
  outline: ["architect"],
  writing: ["writer"],
  assembly: ["editor"],
  image: ["designer"],
  quality: ["seo-checker", "reviewer"],
  translation: ["translator"],
};

export function getAgent(id: string): Agent | undefined {
  return agents.find((a) => a.id === id);
}
