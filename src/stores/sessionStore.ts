import { create } from "zustand";
import type { ActiveSubagent } from "../lib/tauri";

export interface SessionTab {
  id: string;
  type?: "terminal" | "plan" | "readme" | "settings" | "diff" | "session-view" | "file";
  projectDir: string;
  sessionId?: string;
  title: string;
  resolvedSessionId?: string;
  spawnedAt?: number;
  filePath?: string; // absolute path for type === "readme" or "file"
  planFilename?: string; // only for type === "plan"
  diffPath?: string; // file path for type === "diff"
  diffStaged?: boolean; // whether to show staged changes
}

interface SessionStore {
  tabsByProject: Record<string, SessionTab[]>;
  activeTabByProject: Record<string, string | null>;
  activeSubagents: Record<string, ActiveSubagent[]>;
  knownSessions: Record<string, boolean>;
  planLinks: Record<string, string>; // plan filename → tab id

  // Per-project tab management (require projectId)
  openTab: (tab: SessionTab, projectId: string) => void;
  closeTab: (tabId: string, projectId: string) => void;
  setActiveTab: (tabId: string, projectId: string) => void;
  openPlanTab: (filename: string, title: string, projectId: string) => void;
  openSettingsTab: (projectId: string) => void;
  resumeTab: (tabId: string, projectId: string) => void;

  // Scan-all variants (watcher doesn't know projectId easily)
  resolveTabSession: (tabId: string, realSessionId: string) => void;
  renameTab: (tabId: string, title: string) => void;

  // Global state (keyed by session ID, not project)
  setSubagents: (sessionId: string, subagents: ActiveSubagent[]) => void;
  markSessionActive: (sessionId: string, isActive: boolean) => void;
  linkPlan: (filename: string, tabId: string) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  tabsByProject: {},
  activeTabByProject: {},
  activeSubagents: {},
  knownSessions: {},
  planLinks: {},

  openTab: (tab, projectId) =>
    set((s) => {
      const tabs = s.tabsByProject[projectId] ?? [];
      const exists = tabs.find((t) => t.id === tab.id);
      if (exists) {
        return {
          activeTabByProject: { ...s.activeTabByProject, [projectId]: tab.id },
        };
      }
      return {
        tabsByProject: {
          ...s.tabsByProject,
          [projectId]: [...tabs, { ...tab, spawnedAt: tab.spawnedAt ?? Date.now() }],
        },
        activeTabByProject: { ...s.activeTabByProject, [projectId]: tab.id },
      };
    }),

  closeTab: (tabId, projectId) =>
    set((s) => {
      const tabs = (s.tabsByProject[projectId] ?? []).filter((t) => t.id !== tabId);
      const currentActive = s.activeTabByProject[projectId];
      const newActiveId =
        currentActive === tabId ? (tabs[tabs.length - 1]?.id ?? null) : currentActive;
      return {
        tabsByProject: { ...s.tabsByProject, [projectId]: tabs },
        activeTabByProject: { ...s.activeTabByProject, [projectId]: newActiveId },
      };
    }),

  setActiveTab: (tabId, projectId) =>
    set((s) => ({
      activeTabByProject: { ...s.activeTabByProject, [projectId]: tabId },
    })),

  openPlanTab: (filename, title, projectId) => {
    const tabId = `plan:${filename}`;
    set((s) => {
      const tabs = s.tabsByProject[projectId] ?? [];
      const exists = tabs.find((t) => t.id === tabId);
      if (exists) return {}; // already open — don't steal focus
      return {
        tabsByProject: {
          ...s.tabsByProject,
          [projectId]: [
            ...tabs,
            { id: tabId, type: "plan" as const, planFilename: filename, title, projectDir: "" },
          ],
        },
        activeTabByProject: { ...s.activeTabByProject, [projectId]: tabId },
      };
    });
  },

  openSettingsTab: (projectId) => {
    const tab: SessionTab = {
      id: "settings",
      type: "settings",
      title: "Settings",
      projectDir: "",
    };
    useSessionStore.getState().openTab(tab, projectId);
  },

  // Scan all projects to find and update the tab (tab IDs are globally unique)
  resolveTabSession: (tabId, realSessionId) =>
    set((s) => {
      const updated: Record<string, SessionTab[]> = {};
      for (const [pid, tabs] of Object.entries(s.tabsByProject)) {
        updated[pid] = tabs.map((t) =>
          t.id === tabId ? { ...t, resolvedSessionId: realSessionId } : t
        );
      }
      return { tabsByProject: updated };
    }),

  renameTab: (tabId, title) =>
    set((s) => {
      const updated: Record<string, SessionTab[]> = {};
      for (const [pid, tabs] of Object.entries(s.tabsByProject)) {
        updated[pid] = tabs.map((t) => (t.id === tabId ? { ...t, title } : t));
      }
      return { tabsByProject: updated };
    }),

  setSubagents: (sessionId, subagents) =>
    set((s) => ({
      activeSubagents: { ...s.activeSubagents, [sessionId]: subagents },
    })),

  markSessionActive: (sessionId, isActive) =>
    set((s) => ({
      knownSessions: { ...s.knownSessions, [sessionId]: isActive },
    })),

  linkPlan: (filename, tabId) =>
    set((s) => ({
      planLinks: { ...s.planLinks, [filename]: tabId },
    })),

  resumeTab: (tabId, projectId) =>
    set((s) => {
      const tabs = s.tabsByProject[projectId] ?? [];
      return {
        tabsByProject: {
          ...s.tabsByProject,
          [projectId]: tabs.map((t) =>
            t.id === tabId ? { ...t, type: undefined } : t
          ),
        },
      };
    }),
}));
