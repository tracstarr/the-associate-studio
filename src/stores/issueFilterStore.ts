import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";

/** Serializable filter state for a single project. */
export interface ProjectIssueFilters {
  state: "open" | "closed" | "all";
  ghAssignees: string[];
  linearAssignees: string[];
  jiraAssignees: string[];
  labelFilter: string[];
  activeProviders: string[];
  prState: "open" | "closed" | "all";
}

export const DEFAULT_ISSUE_FILTERS: ProjectIssueFilters = {
  state: "open",
  ghAssignees: [],
  linearAssignees: [],
  jiraAssignees: [],
  labelFilter: [],
  activeProviders: [],          // empty = use all configured providers
  prState: "open",
};

interface IssueFilterStore {
  /** Per-project filter state, keyed by project ID. */
  filters: Record<string, ProjectIssueFilters>;

  /** Patch one or more filter fields for a project and persist. */
  setFilters: (projectId: string, patch: Partial<ProjectIssueFilters>) => void;

  /** Load persisted filters from disk. */
  loadFromDisk: () => Promise<void>;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persistFilters(filters: Record<string, ProjectIssueFilters>) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      const store = await load("settings.json", { autoSave: false, defaults: {} });
      await store.set("issueFilters", filters);
      await store.save();
    } catch { /* not in Tauri context */ }
  }, 200);
}

export const useIssueFilterStore = create<IssueFilterStore>((set) => ({
  filters: {},

  setFilters: (projectId, patch) => {
    set((s) => {
      const prev = s.filters[projectId] ?? { ...DEFAULT_ISSUE_FILTERS };
      const next = { ...prev, ...patch };
      const filters = { ...s.filters, [projectId]: next };
      persistFilters(filters);
      return { filters };
    });
  },

  loadFromDisk: async () => {
    try {
      const store = await load("settings.json", { autoSave: false, defaults: {} });
      const saved = await store.get<Record<string, ProjectIssueFilters>>("issueFilters");
      if (saved && typeof saved === "object") {
        set({ filters: saved });
      }
    } catch { /* not in Tauri context */ }
  },
}));
