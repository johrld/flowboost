"use client";

import { Button } from "@/components/ui/button";
import { agents } from "@/lib/agents";
import { Settings, Activity } from "lucide-react";

const colorMap: Record<string, string> = {
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  pink: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

export default function TeamPage() {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-muted-foreground">
          Your AI editorial team — each agent specializes in a part of the content pipeline
        </p>
      </div>

      {/* Pipeline Flow */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {["Researcher", "Architect", "Writer", "Editor", "Designer", "SEO", "Reviewer", "Translator"].map(
          (step, i, arr) => (
            <div key={step} className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium bg-muted px-2.5 py-1 rounded-full">
                {step}
              </span>
              {i < arr.length - 1 && (
                <span className="text-muted-foreground">→</span>
              )}
            </div>
          )
        )}
      </div>

      {/* Agent List */}
      <div className="rounded-lg border overflow-hidden">
        {/* Header Row */}
        <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
          <div className="w-10"></div>
          <div className="w-32">Agent</div>
          <div className="flex-1">Description</div>
          <div className="w-20 text-center hidden md:block">Tasks</div>
          <div className="w-20 text-center hidden md:block">Avg. time</div>
          <div className="w-28 hidden lg:block">Last active</div>
          <div className="w-20"></div>
        </div>

        {agents.map((agent, idx) => (
          <div
            key={agent.id}
            className={`flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors ${
              idx < agents.length - 1 ? "border-b" : ""
            }`}
          >
            {/* Avatar */}
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full text-lg shrink-0 ${
                colorMap[agent.color] ?? "bg-muted"
              }`}
            >
              {agent.avatar}
            </div>

            {/* Name + Role */}
            <div className="w-32 shrink-0">
              <p className="text-sm font-medium">{agent.name}</p>
              <p className="text-xs text-muted-foreground">{agent.role}</p>
            </div>

            {/* Description */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">
                {agent.description}
              </p>
            </div>

            {/* Stats */}
            <div className="w-20 text-center hidden md:block">
              <p className="text-sm font-semibold">{agent.stats.tasksCompleted}</p>
            </div>
            <div className="w-20 text-center hidden md:block">
              <p className="text-xs text-muted-foreground">{agent.stats.avgDuration}</p>
            </div>
            <div className="w-28 hidden lg:block">
              <p className="text-xs text-muted-foreground">{agent.stats.lastActive}</p>
            </div>

            {/* Actions */}
            <div className="w-20 flex gap-1 shrink-0 justify-end">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Activity className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
