import { create } from "zustand";
import { listProjects, deleteProject, createProject, type Project } from "../lib/tauri";
import { pathToProjectId } from "../lib/utils";
import { debugLog } from "./debugStore";

interface ProjectsStore {
  projects: Project[];
  activeProjectId: string | null;
  isLoading: boolean;
  loadProjects: () => Promise<void>;
  setActiveProject: (id: string) => void;
  addAndActivateProject: (path: string) => void;
  removeProject: (id: string) => Promise<void>;
  cycleProject: (direction: 1 | -1) => void;
}

export const useProjectsStore = create<ProjectsStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  isLoading: false,

  loadProjects: async () => {
    debugLog("Projects", "Loading projects", undefined, "info");
    set({ isLoading: true });
    try {
      const projects = await listProjects();
      const { activeProjectId } = get();
      // Auto-select first project if none selected
      const newActiveId =
        activeProjectId && projects.some((p) => p.id === activeProjectId)
          ? activeProjectId
          : (projects[0]?.id ?? null);
      set({ projects, activeProjectId: newActiveId, isLoading: false });
      debugLog("Projects", "Projects loaded", { count: projects.length, activeId: newActiveId }, "success");
    } catch (e) {
      console.error("[projects] load failed:", e);
      debugLog("Projects", "Load failed", { error: String(e) }, "error");
      set({ isLoading: false });
    }
  },

  setActiveProject: (id) => set({ activeProjectId: id }),

  removeProject: async (id) => {
    debugLog("Projects", "Project removed", { id }, "warn");
    try {
      await deleteProject(id);
    } catch (e) {
      console.error("[projects] removeProject failed:", e);
      debugLog("Projects", "Remove failed", { id, error: String(e) }, "error");
      return;
    }
    set((s) => {
      const projects = s.projects.filter((p) => p.id !== id);
      const activeProjectId =
        s.activeProjectId === id ? (projects[0]?.id ?? null) : s.activeProjectId;
      return { projects, activeProjectId };
    });
  },

  cycleProject: (direction) => {
    const { projects, activeProjectId, setActiveProject } = get();
    if (projects.length === 0) return;
    const currentIdx = projects.findIndex((p) => p.id === activeProjectId);
    const nextIdx = (currentIdx + direction + projects.length) % projects.length;
    setActiveProject(projects[nextIdx].id);
  },

  addAndActivateProject: (path) => {
    // Derive id using same encoding as Rust encode_project_path
    const id = pathToProjectId(path);
    const name = path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;

    // Optimistic UI update
    set((s) => {
      const exists = s.projects.find((p) => p.id === id);
      if (exists) {
        return { activeProjectId: id };
      }
      debugLog("Projects", "Project added", { id, path, name }, "info");
      return {
        projects: [{ id, path, name, sessionCount: 0 }, ...s.projects],
        activeProjectId: id,
      };
    });

    // Persist to backend (creates ~/.claude/projects/{encoded}/ + sessions-index.json)
    createProject(path).catch((e) => {
      console.error("[projects] createProject failed:", e);
      debugLog("Projects", "Create project failed", { path, error: String(e) }, "error");
    });
  },
}));
