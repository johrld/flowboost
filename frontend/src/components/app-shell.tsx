"use client";

import { useProject } from "@/lib/project-context";
import { Sidebar } from "@/components/sidebar";
import { CreateProjectWizard } from "@/components/create-project-wizard";
import { Loader2 } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, needsOnboarding } = useProject();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <CreateProjectWizard
        open={true}
        onOpenChange={() => {}}
        fullscreen
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
