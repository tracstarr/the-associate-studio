import { create } from "zustand";
import { listProjects, deleteProject, type Project } from "../lib/tauri";

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
    } catch (e) {
      console.error("[projects] load failed:", e);
      set({ isLoading: false });
    }
  },

  setActiveProject: (id) => set({ activeProjectId: id }),

  removeProject: async (id) => {
    await deleteProject(id);
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
    set((s) => {
      const exists = s.projects.find((p) => p.id === id);
      if (exists) {
        return { activeProjectId: id };
      }
      return {
        projects: [{ id, path, name, sessionCount: 0 }, ...s.projects],
        activeProjectId: id,
      };
    });
  },
}));

/// Mirror of Rust encode_project_path:
/// C:\dev\ide → C--dev-ide
/// C:/dev/ide → C--dev-ide
export function pathToProjectId(path: string): string {
  let s = path.replace(/\//g, "\\"); // normalize to backslashes
  s = s.replace(/:\\/g, "--");       // :\ → --
  s = s.replace(/\\/g, "-");         // remaining \ → -
  return s.replace(/-+$/, "");       // strip trailing slashes (encoded as -)
}
