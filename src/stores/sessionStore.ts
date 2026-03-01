import { create } from "zustand";
import type { ActiveSubagent } from "../lib/tauri";
import * as tauri from "../lib/tauri";
import { useNotificationStore } from "./notificationStore";

export interface SessionTab {
  id: string;
  type?: "terminal" | "plan" | "readme" | "settings" | "diff" | "session-view" | "file" | "summary" | "pr-detail" | "extension" | "issue-detail" | "workflow-run";
  projectDir: string;
  sessionId?: string;
  title: string;
  resolvedSessionId?: string;
  spawnedAt?: number;
  filePath?: string; // absolute path for type === "readme" or "file"
  planFilename?: string; // only for type === "plan"
  diffPath?: string; // file path for type === "diff"
  diffStaged?: boolean; // whether to show staged changes
  summaryFilename?: string; // only for type === "summary"
  summaryProjectDir?: string; // encoded project dir for type === "summary"
  prNumber?: number; // only for type === "pr-detail"
  markdownContent?: string; // inline markdown for type === "extension"
  forkSession?: boolean; // when true, spawns with --fork-session flag
  issueKey?: string; // Jira key "PROJ-123", GitHub "#42", Linear identifier; for type === "issue-detail"
  issueSource?: "github" | "linear" | "jira"; // source system; for type === "issue-detail"
  issueUrl?: string; // direct link to open externally; for type === "issue-detail"
  remoteRunId?: number; // GitHub Actions run ID after triggering Remote Run
  remoteRunUrl?: string; // URL to the workflow run on GitHub
  remoteRunStatus?: "queued" | "in_progress" | "completed";
  remoteRunConclusion?: "success" | "failure" | "cancelled" | null;
  workflowRunId?: number; // only for type === "workflow-run"
  workflowRunUrl?: string; // external URL for the workflow run
}

interface SessionStore {
  tabsByProject: Record<string, SessionTab[]>;
  activeTabByProject: Record<string, string | null>;
  activeSubagents: Record<string, ActiveSubagent[]>;
  knownSessions: Record<string, "active" | "idle" | "completed">;
  planLinks: Record<string, string>; // plan filename → session id
  dirtyTabs: Record<string, boolean>;

  // Per-project tab management (require projectId)
  openTab: (tab: SessionTab, projectId: string) => void;
  closeTab: (tabId: string, projectId: string) => void;
  setActiveTab: (tabId: string, projectId: string) => void;
  openPlanTab: (filename: string, title: string, projectId: string) => void;
  openSettingsTab: (projectId: string) => void;
  openSummaryTab: (sessionId: string, filename: string, projectDir: string, projectId: string) => void;
  resumeTab: (tabId: string, projectId: string) => void;
  setTabDirty: (tabId: string, dirty: boolean) => void;
  closeAllTabs: (projectId: string) => void;
  closeOtherTabs: (tabId: string, projectId: string) => void;
  closeTabsToLeft: (tabId: string, projectId: string) => void;
  closeTabsToRight: (tabId: string, projectId: string) => void;
  insertTabBackground: (tab: SessionTab, projectId: string) => void;

  // Scan-all variants (watcher doesn't know projectId easily)
  resolveTabSession: (tabId: string, realSessionId: string) => void;
  renameTab: (tabId: string, title: string) => void;
  updateTabRunInfo: (tabId: string, info: Partial<Pick<SessionTab, "remoteRunId" | "remoteRunUrl" | "remoteRunStatus" | "remoteRunConclusion">>) => void;

  // Global state (keyed by session ID, not project)
  setSubagents: (sessionId: string, subagents: ActiveSubagent[]) => void;
  markSessionStatus: (sessionId: string, status: "active" | "idle" | "completed") => void;
  linkPlan: (filename: string, sessionId: string, projectDir: string) => void;
  relinkPlan: (filename: string, sessionId: string, projectDir: string) => void;
  setPlanLinks: (links: Record<string, string>) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  tabsByProject: {},
  activeTabByProject: {},
  activeSubagents: {},
  knownSessions: {},
  planLinks: {},
  dirtyTabs: {},

  insertTabBackground: (tab, projectId) =>
    set((s) => {
      const tabs = s.tabsByProject[projectId] ?? [];
      if (tabs.find((t) => t.id === tab.id)) return {}; // already open
      return {
        tabsByProject: {
          ...s.tabsByProject,
          [projectId]: [...tabs, { ...tab, spawnedAt: tab.spawnedAt ?? Date.now() }],
        },
        // intentionally omit activeTabByProject — no focus steal
      };
    }),

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

  setActiveTab: (tabId, projectId) => {
    set((s) => ({
      activeTabByProject: { ...s.activeTabByProject, [projectId]: tabId },
    }));
    useNotificationStore.getState().markReadByTabId(tabId);
  },

  openPlanTab: (filename, title, projectId) => {
    const tabId = `plan:${filename}`;
    set((s) => {
      const tabs = s.tabsByProject[projectId] ?? [];
      const exists = tabs.find((t) => t.id === tabId);
      if (exists) return {}; // already open — don't steal focus

      // Auto-link to the currently active terminal session (if any)
      const activeTabId = s.activeTabByProject[projectId];
      const activeTab = tabs.find((t) => t.id === activeTabId);
      let newPlanLinks = s.planLinks;
      if (activeTab && (!activeTab.type || activeTab.type === "terminal")) {
        const sid = activeTab.resolvedSessionId ?? activeTab.sessionId;
        if (sid && !s.planLinks[filename]) {
          newPlanLinks = { ...s.planLinks, [filename]: sid };
          tauri.savePlanLinks(projectId, newPlanLinks).catch(() => { /* ignore */ });
        }
      }

      return {
        tabsByProject: {
          ...s.tabsByProject,
          [projectId]: [
            ...tabs,
            { id: tabId, type: "plan" as const, planFilename: filename, title, projectDir: "" },
          ],
        },
        activeTabByProject: { ...s.activeTabByProject, [projectId]: tabId },
        planLinks: newPlanLinks,
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

  openSummaryTab: (sessionId, filename, projectDir, projectId) => {
    const tabId = `summary:${filename}`;
    // Extract counter from filename for a readable title, e.g. "abc-summary-001.md" → "Summary 1"
    const match = filename.match(/-summary-(\d+)\.md$/);
    const num = match ? parseInt(match[1], 10) : 1;
    const title = `Summary ${num}`;
    set((s) => {
      const tabs = s.tabsByProject[projectId] ?? [];
      if (tabs.find((t) => t.id === tabId)) {
        return { activeTabByProject: { ...s.activeTabByProject, [projectId]: tabId } };
      }
      return {
        tabsByProject: {
          ...s.tabsByProject,
          [projectId]: [
            ...tabs,
            {
              id: tabId,
              type: "summary" as const,
              title,
              projectDir: "",
              sessionId,
              summaryFilename: filename,
              summaryProjectDir: projectDir,
            },
          ],
        },
        activeTabByProject: { ...s.activeTabByProject, [projectId]: tabId },
      };
    });
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

  updateTabRunInfo: (tabId, info) =>
    set((s) => {
      const updated: Record<string, SessionTab[]> = {};
      for (const [pid, tabs] of Object.entries(s.tabsByProject)) {
        updated[pid] = tabs.map((t) => (t.id === tabId ? { ...t, ...info } : t));
      }
      return { tabsByProject: updated };
    }),

  setSubagents: (sessionId, subagents) =>
    set((s) => ({
      activeSubagents: { ...s.activeSubagents, [sessionId]: subagents },
    })),

  markSessionStatus: (sessionId, status) =>
    set((s) => ({
      knownSessions: { ...s.knownSessions, [sessionId]: status },
    })),

  linkPlan: (filename, sessionId, projectDir) =>
    set((s) => {
      const planLinks = { ...s.planLinks, [filename]: sessionId };
      tauri.savePlanLinks(projectDir, planLinks).catch(() => { /* ignore */ });
      return { planLinks };
    }),

  relinkPlan: (filename, sessionId, projectDir) =>
    set((s) => {
      const planLinks = { ...s.planLinks, [filename]: sessionId };
      tauri.savePlanLinks(projectDir, planLinks).catch(() => { /* ignore */ });
      return { planLinks };
    }),

  setPlanLinks: (links) =>
    set(() => ({ planLinks: links })),

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

  setTabDirty: (tabId, dirty) =>
    set((s) => {
      const next = { ...s.dirtyTabs };
      if (dirty) {
        next[tabId] = true;
      } else {
        delete next[tabId];
      }
      return { dirtyTabs: next };
    }),

  closeAllTabs: (projectId) =>
    set((s) => ({
      tabsByProject: { ...s.tabsByProject, [projectId]: [] },
      activeTabByProject: { ...s.activeTabByProject, [projectId]: null },
    })),

  closeOtherTabs: (tabId, projectId) =>
    set((s) => {
      const tab = (s.tabsByProject[projectId] ?? []).find((t) => t.id === tabId);
      const kept = tab ? [tab] : [];
      return {
        tabsByProject: { ...s.tabsByProject, [projectId]: kept },
        activeTabByProject: { ...s.activeTabByProject, [projectId]: tab?.id ?? null },
      };
    }),

  closeTabsToLeft: (tabId, projectId) =>
    set((s) => {
      const tabs = s.tabsByProject[projectId] ?? [];
      const idx = tabs.findIndex((t) => t.id === tabId);
      const kept = idx === -1 ? tabs : tabs.slice(idx);
      const currentActive = s.activeTabByProject[projectId];
      const keptIds = new Set(kept.map((t) => t.id));
      const newActive = keptIds.has(currentActive ?? "") ? currentActive : (kept[0]?.id ?? null);
      return {
        tabsByProject: { ...s.tabsByProject, [projectId]: kept },
        activeTabByProject: { ...s.activeTabByProject, [projectId]: newActive },
      };
    }),

  closeTabsToRight: (tabId, projectId) =>
    set((s) => {
      const tabs = s.tabsByProject[projectId] ?? [];
      const idx = tabs.findIndex((t) => t.id === tabId);
      const kept = idx === -1 ? tabs : tabs.slice(0, idx + 1);
      const currentActive = s.activeTabByProject[projectId];
      const keptIds = new Set(kept.map((t) => t.id));
      const newActive = keptIds.has(currentActive ?? "") ? currentActive : (kept[kept.length - 1]?.id ?? null);
      return {
        tabsByProject: { ...s.tabsByProject, [projectId]: kept },
        activeTabByProject: { ...s.activeTabByProject, [projectId]: newActive },
      };
    }),
}));
