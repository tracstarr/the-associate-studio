import { create } from "zustand";
import { getProjectSettings, setProjectSettings } from "@/lib/tauri";

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
  /** Per-project filter state, keyed by project path. */
  filters: Record<string, ProjectIssueFilters>;

  /** Patch one or more filter fields for a project and persist. */
  setFilters: (projectPath: string, patch: Partial<ProjectIssueFilters>) => void;

  /** Load persisted filters for a specific project from its ide-settings.json. */
  loadFiltersForProject: (projectPath: string) => Promise<void>;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const useIssueFilterStore = create<IssueFilterStore>((set) => ({
  filters: {},

  setFilters: (projectPath, patch) => {
    set((s) => {
      const next = { ...(s.filters[projectPath] ?? DEFAULT_ISSUE_FILTERS), ...patch };
      const filters = { ...s.filters, [projectPath]: next };
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(async () => {
        try {
          const existing = await getProjectSettings(projectPath);
          await setProjectSettings(projectPath, { ...existing, issueFilters: next });
        } catch { /* not in Tauri context */ }
      }, 200);
      return { filters };
    });
  },

  loadFiltersForProject: async (projectPath) => {
    try {
      const settings = await getProjectSettings(projectPath);
      if (settings.issueFilters) {
        set((s) => ({
          filters: {
            ...s.filters,
            [projectPath]: { ...DEFAULT_ISSUE_FILTERS, ...settings.issueFilters },
          },
        }));
      }
    } catch { /* not in Tauri context */ }
  },
}));
