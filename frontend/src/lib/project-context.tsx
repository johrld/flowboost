"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getCustomers, getProjects } from "./api";
import type { Project, Category, Author } from "./types";

interface ProjectContextValue {
  customerId: string;
  projectId: string;
  project: Project | null;
  projects: Project[];
  categories: Category[];
  authors: Author[];
  setActiveProject: (project: Project) => void;
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
  loading: true,
});

export function useProject() {
  return useContext(ProjectContext);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [customerId, setCustomerId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomers()
      .then((customers) => {
        if (customers.length > 0) {
          const cid = customers[0].id;
          setCustomerId(cid);
          return getProjects(cid).then((p) => {
            setProjects(p);
            if (p.length > 0) setProject(p[0]);
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setActiveProject = useCallback((p: Project) => {
    setProject(p);
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        customerId,
        projectId: project?.id ?? "",
        project,
        projects,
        categories: project?.categories ?? [],
        authors: [],
        setActiveProject,
        loading,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
