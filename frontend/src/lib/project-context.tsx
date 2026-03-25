"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getCustomers, getProjects } from "./api";
import type { Customer, Project, Category, Author } from "./types";

interface ProjectContextValue {
  customerId: string;
  projectId: string;
  project: Project | null;
  projects: Project[];
  categories: Category[];
  authors: Author[];
  setActiveProject: (project: Project) => void;
  refreshProjects: () => Promise<void>;
  needsOnboarding: boolean;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextValue>({
  customerId: "",
  projectId: "",
  project: null,
  projects: [],
  categories: [],
  authors: [],
  setActiveProject: () => {},
  refreshProjects: async () => {},
  needsOnboarding: false,
  loading: true,
});

export function useProject() {
  return useContext(ProjectContext);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const customers = await getCustomers();
      if (customers.length > 0) {
        setCustomer(customers[0]);
        const cid = customers[0].id;
        setCustomerId(cid);
        const p = await getProjects(cid);
        setProjects(p);
        if (p.length > 0) setProject((prev) => prev && p.find((x) => x.id === prev.id) ? prev : p[0]);
      }
    } catch {
      // API not available yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setActiveProject = useCallback((p: Project) => {
    setProject(p);
  }, []);

  const refreshProjects = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const needsOnboarding = !loading && projects.length === 0;

  return (
    <ProjectContext.Provider
      value={{
        customerId,
        projectId: project?.id ?? "",
        project,
        projects,
        categories: project?.categories ?? [],
        authors: customer?.authors ?? [],
        setActiveProject,
        refreshProjects,
        needsOnboarding,
        loading,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
