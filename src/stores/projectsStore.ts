import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
import { listProjects, deleteProject, createProject, type Project } from "../lib/tauri";
import { pathToProjectId } from "../lib/utils";
import { debugLog } from "./debugStore";

let recentPersistTimer: ReturnType<typeof setTimeout> | null = null;

function persistRecentIds(ids: string[]) {
  if (recentPersistTimer) clearTimeout(recentPersistTimer);
  recentPersistTimer = setTimeout(async () => {
    try {
      const store = await load("settings.json", { autoSave: false, defaults: {} });
      await store.set("recentProjectIds", ids);
      await store.save();
    } catch { /* not in Tauri context */ }
  }, 100);
}

interface ProjectsStore {
  projects: Project[];
  activeProjectId: string | null;
  isLoading: boolean;
  recentProjectIds: string[];
  loadProjects: () => Promise<void>;
  loadRecentFromDisk: () => Promise<void>;
  setActiveProject: (id: string) => void;
  addAndActivateProject: (path: string) => void;
  removeProject: (id: string) => Promise<void>;
  cycleProject: (direction: 1 | -1) => void;
}

export const useProjectsStore = create<ProjectsStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  isLoading: false,
  recentProjectIds: [],

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

  loadRecentFromDisk: async () => {
    try {
      const store = await load("settings.json", { autoSave: false, defaults: {} });
      const ids = await store.get<string[]>("recentProjectIds");
      if (Array.isArray(ids)) set({ recentProjectIds: ids });
    } catch { /* not in Tauri context */ }
  },

  setActiveProject: (id) => {
    let nextRecent: string[] = [];
    set((s) => {
      const filtered = s.recentProjectIds.filter((r) => r !== id);
      nextRecent = [id, ...filtered].slice(0, 5);
      return { activeProjectId: id, recentProjectIds: nextRecent };
    });
    persistRecentIds(nextRecent);
  },

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
      return { projects, activeProjectId, recentProjectIds: s.recentProjectIds.filter((r) => r !== id) };
    });
    persistRecentIds(useProjectsStore.getState().recentProjectIds);
  },

  cycleProject: (direction) => {
    const { projects, activeProjectId, recentProjectIds } = get();
    if (projects.length === 0) return;
    const existingIds = new Set(projects.map((p) => p.id));
    const validRecent = recentProjectIds.filter((id) => existingIds.has(id));
    const recentSet = new Set(validRecent);
    const notRecent = projects.filter((p) => !recentSet.has(p.id)).map((p) => p.id);
    const ordered = [...validRecent, ...notRecent];
    const currentIdx = ordered.indexOf(activeProjectId ?? "");
    const safeIdx = currentIdx === -1 ? 0 : currentIdx;
    const nextIdx = (safeIdx + direction + ordered.length) % ordered.length;
    set({ activeProjectId: ordered[nextIdx] });
  },

  addAndActivateProject: (path) => {
    // Derive id using same encoding as Rust encode_project_path
    const id = pathToProjectId(path);
    const name = path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;

    // Optimistic UI update — add project if not already present
    set((s) => {
      if (s.projects.some((p) => p.id === id)) return {};
      debugLog("Projects", "Project added", { id, path, name }, "info");
      return { projects: [{ id, path, name, sessionCount: 0 }, ...s.projects] };
    });
    // Records recency + sets activeProjectId
    get().setActiveProject(id);

    // Persist to backend (creates ~/.claude/projects/{encoded}/ + sessions-index.json)
    createProject(path).catch((e) => {
      console.error("[projects] createProject failed:", e);
      debugLog("Projects", "Create project failed", { path, error: String(e) }, "error");
    });
  },
}));
