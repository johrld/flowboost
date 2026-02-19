"use client";

import { Badge } from "@/components/ui/badge";
import { agents, phaseLabels } from "@/lib/agents";

const bgColorMap: Record<string, string> = {
  green: "bg-green-100 dark:bg-green-900/30",
  blue: "bg-blue-100 dark:bg-blue-900/30",
  amber: "bg-amber-100 dark:bg-amber-900/30",
  purple: "bg-purple-100 dark:bg-purple-900/30",
  emerald: "bg-emerald-100 dark:bg-emerald-900/30",
  cyan: "bg-cyan-100 dark:bg-cyan-900/30",
  orange: "bg-orange-100 dark:bg-orange-900/30",
  violet: "bg-violet-100 dark:bg-violet-900/30",
};

const badgeColorMap: Record<string, string> = {
  green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",
  orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  violet: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
};

export default function TeamPage() {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Your AI Team</h1>
        <p className="text-muted-foreground text-sm">
          8 specialized agents that research, write, edit, and publish your content
        </p>
      </div>

      {/* Pipeline Flow */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {["Research", "Outline", "Writing", "Assembly", "Image", "Quality", "Translation"].map(
          (step, i, arr) => (
            <div key={step} className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-medium bg-muted px-2.5 py-1 rounded-full">
                {step}
              </span>
              {i < arr.length - 1 && (
                <span className="text-muted-foreground text-xs">→</span>
              )}
            </div>
          )
        )}
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-4 gap-3 max-w-3xl">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Avatar Image */}
            <div className={`${bgColorMap[agent.color] ?? "bg-muted"}`}>
              <img
                src={agent.imageSquare}
                alt={agent.name}
                className="w-full h-auto"
              />
            </div>

            {/* Info */}
            <div className="p-2.5 space-y-1.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{agent.role}</p>
                <p className="text-sm font-bold">{agent.name}</p>
              </div>

              {/* Phase Badges */}
              <div className="flex flex-wrap gap-1">
                {agent.phases.map((phase) => (
                  <Badge
                    key={phase}
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 ${badgeColorMap[agent.color] ?? ""}`}
                  >
                    {phaseLabels[phase] ?? phase}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
