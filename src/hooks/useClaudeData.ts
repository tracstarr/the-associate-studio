import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import * as tauri from "../lib/tauri";
import { getActiveSessions } from "../lib/tauri";
import type { HookEvent } from "../lib/tauri";
import { pathToProjectId } from "../lib/utils";
import { useSessionStore } from "../stores/sessionStore";
import { useProjectsStore } from "../stores/projectsStore";
import { useNotificationStore } from "../stores/notificationStore";
import { debugLog } from "../stores/debugStore";

// ---- Summary Hooks ----

export function useSummaries(projectDir: string, sessionId: string) {
  return useQuery({
    queryKey: ["summaries", projectDir, sessionId],
    queryFn: () => tauri.loadSummaries(projectDir, sessionId),
    enabled: !!projectDir && !!sessionId,
    staleTime: 30_000,
  });
}

// ---- Session Hooks ----

export function useSessions(projectDir: string) {
  return useQuery({
    queryKey: ["sessions", projectDir],
    queryFn: () => tauri.loadSessions(projectDir),
    enabled: !!projectDir,
    staleTime: 10_000,
  });
}

export function useTranscript(sessionPath: string, offset: number) {
  return useQuery({
    queryKey: ["transcript", sessionPath, offset],
    queryFn: () => tauri.loadTranscript(sessionPath, offset),
    enabled: !!sessionPath,
    staleTime: 5_000,
  });
}

// ---- Team Hooks ----

export function useTeams(projectCwd?: string) {
  return useQuery({
    queryKey: ["teams", projectCwd],
    queryFn: () => tauri.loadTeams(projectCwd),
    enabled: projectCwd === undefined || !!projectCwd,
    staleTime: 10_000,
  });
}

// ---- Task Hooks ----

export function useTasks(teamName: string) {
  return useQuery({
    queryKey: ["tasks", teamName],
    queryFn: () => tauri.loadTasks(teamName),
    enabled: !!teamName,
    staleTime: 5_000,
  });
}

// ---- Inbox Hooks ----

export function useInbox(teamName: string, agentName: string) {
  return useQuery({
    queryKey: ["inbox", teamName, agentName],
    queryFn: () => tauri.loadInbox(teamName, agentName),
    enabled: !!teamName && !!agentName,
    staleTime: 5_000,
  });
}

// ---- Todo Hooks ----

export function useTodos() {
  return useQuery({
    queryKey: ["todos"],
    queryFn: () => tauri.loadTodos(),
    staleTime: 10_000,
  });
}

// ---- Plan Hooks ----

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: () => tauri.loadPlans(),
    staleTime: 10_000,
  });
}

// ---- Git Hooks ----

export function useGitStatus(cwd: string) {
  return useQuery({
    queryKey: ["git-status", cwd],
    queryFn: () => tauri.gitStatus(cwd),
    enabled: !!cwd,
    staleTime: 5_000,
  });
}

export function useGitDiff(cwd: string, path: string, staged: boolean) {
  return useQuery({
    queryKey: ["git-diff", cwd, path, staged],
    queryFn: () => tauri.gitDiff(cwd, path, staged),
    enabled: !!cwd && !!path,
    staleTime: 5_000,
  });
}

export function useGitBranches(cwd: string) {
  return useQuery({
    queryKey: ["git-branches", cwd],
    queryFn: () => tauri.gitBranches(cwd),
    enabled: !!cwd,
    staleTime: 10_000,
  });
}

export function useGitCurrentBranch(cwd: string) {
  return useQuery({
    queryKey: ["git-current-branch", cwd],
    queryFn: () => tauri.gitCurrentBranch(cwd),
    enabled: !!cwd,
    staleTime: 5_000,
  });
}

export function useGitLog(cwd: string, limit = 100) {
  return useQuery({
    queryKey: ["git-log", cwd, limit],
    queryFn: () => tauri.gitLog(cwd, limit),
    enabled: !!cwd,
    staleTime: 10_000,
  });
}

export function useGitRemoteBranches(cwd: string) {
  return useQuery({
    queryKey: ["git-remote-branches", cwd],
    queryFn: () => tauri.gitRemoteBranches(cwd),
    enabled: !!cwd,
    staleTime: 30_000,
  });
}

export function useWorktrees(projectPath: string) {
  return useQuery({
    queryKey: ["worktrees", projectPath],
    queryFn: () => tauri.listWorktrees(projectPath),
    enabled: !!projectPath,
    staleTime: 30_000,
  });
}

export function useWorktreeCopy(projectPath: string) {
  return useQuery({
    queryKey: ["worktreeCopy", projectPath],
    queryFn: () => tauri.getWorktreeCopy(projectPath),
    enabled: !!projectPath,
    staleTime: 30_000,
  });
}

// ---- PR / Issues Hooks ----

export function usePRs(cwd: string | null, state = "open") {
  return useQuery({
    queryKey: ["prs", cwd, state],
    queryFn: () => tauri.listPRs(cwd!, state),
    enabled: !!cwd,
    staleTime: 60_000,
    retry: false,
  });
}

export function useIssues(cwd: string | null, state = "open") {
  return useQuery({
    queryKey: ["issues", cwd, state],
    queryFn: () => tauri.listIssues(cwd!, state),
    enabled: !!cwd,
    staleTime: 60_000,
    retry: false,
  });
}

// ---- File Watcher Hook ----


export function useClaudeWatcher() {
  const queryClient = useQueryClient();

  // Use refs for all reactive state so listeners never need to be torn down/rebuilt
  const tabsByProjectRef = useRef(useSessionStore.getState().tabsByProject);
  const activeSubagentsRef = useRef(useSessionStore.getState().activeSubagents);
  const activeProjectIdRef = useRef(useProjectsStore.getState().activeProjectId);

  // Keep refs in sync via subscriptions (no effect deps needed)
  useEffect(() => {
    const unsubSession = useSessionStore.subscribe((s) => {
      tabsByProjectRef.current = s.tabsByProject;
      activeSubagentsRef.current = s.activeSubagents;
    });
    const unsubProjects = useProjectsStore.subscribe((s) => {
      activeProjectIdRef.current = s.activeProjectId;
    });
    return () => { unsubSession(); unsubProjects(); };
  }, []);

  useEffect(() => {
    getActiveSessions().then((sessions) => {
      debugLog("Hooks", "Initial sessions", { count: sessions.length }, "info");
      const store = useSessionStore.getState();
      for (const session of sessions) {
        const status = session.status ?? (session.is_active ? "active" : "idle");
        store.markSessionStatus(session.session_id, status);
        if (session.subagents.length > 0) {
          store.setSubagents(session.session_id, session.subagents);
        }
        if (session.cwd) {
          const normCwd = session.cwd.replace(/\\/g, "/").toLowerCase();
          const projectId = pathToProjectId(session.cwd);
          const projectTabs = tabsByProjectRef.current[projectId] ?? [];
          const tab = projectTabs.find(
            (t) =>
              (!t.type || t.type === "terminal") &&
              !t.resolvedSessionId &&
              (t.sessionId === session.session_id ||
                t.projectDir.replace(/\\/g, "/").toLowerCase() === normCwd)
          );
          if (tab) {
            store.resolveTabSession(tab.id, session.session_id);
            if (!tab.sessionId && tab.title === "New Session") {
              store.renameTab(tab.id, session.session_id.slice(0, 8));
            }
          }
        }
      }
    }).catch((err) => { console.error('[useClaudeWatcher] getActiveSessions failed:', err); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unlisteners: Promise<() => void>[] = [];

    unlisteners.push(
      listen<HookEvent>("hook-event", ({ payload: event }) => {
        const store = useSessionStore.getState();
        const allTabsByProject = tabsByProjectRef.current;
        switch (event.hook_event_name) {
          case "SessionStart": {
            debugLog("Hooks", "SessionStart", { session_id: event.session_id, cwd: event.cwd }, "info");
            store.markSessionStatus(event.session_id, "active");
            // Hanging session cleanup: if not a resume, mark other sessions in same project as completed
            if (event.source !== "resume") {
              const projectId = pathToProjectId(event.cwd ?? "");
              const projectTabs = tabsByProjectRef.current[projectId] ?? [];
              const otherIds = projectTabs
                .flatMap((t) => [t.resolvedSessionId, t.sessionId])
                .filter((id): id is string => !!id && id !== event.session_id);
              const { knownSessions } = useSessionStore.getState();
              for (const id of otherIds) {
                if (knownSessions[id] && knownSessions[id] !== "completed") {
                  store.markSessionStatus(id, "completed");
                }
              }
            }
            const normCwd = (event.cwd ?? "").replace(/\\/g, "/").toLowerCase();
            const projectId = pathToProjectId(event.cwd ?? "");
            const projectTabs = allTabsByProject[projectId] ?? [];
            const now = Date.now();
            const tab = projectTabs
              .filter(
                (t) =>
                  (!t.type || t.type === "terminal") &&
                  !t.resolvedSessionId &&
                  t.projectDir.replace(/\\/g, "/").toLowerCase() === normCwd &&
                  (t.spawnedAt === undefined || now - t.spawnedAt < 30_000)
              )
              .sort((a, b) => (b.spawnedAt ?? 0) - (a.spawnedAt ?? 0))[0];
            if (tab) {
              store.resolveTabSession(tab.id, event.session_id);
              if (!tab.sessionId && tab.title === "New Session") {
                store.renameTab(tab.id, event.session_id.slice(0, 8));
              }
            }
            // Also check if a resume tab exists (has sessionId but not yet resolved)
            const resumeTab = projectTabs.find(
              (t) => !t.resolvedSessionId && t.sessionId === event.session_id
            );
            if (resumeTab) {
              store.resolveTabSession(resumeTab.id, event.session_id);
            }
            // Close any session-view tab for this session (resumed externally)
            for (const [pid, tabs] of Object.entries(allTabsByProject)) {
              const svTab = tabs.find(
                (t) => t.type === "session-view" && t.sessionId === event.session_id
              );
              if (svTab) {
                store.closeTab(svTab.id, pid);
              }
            }
            queryClient.invalidateQueries({ queryKey: ["sessions"] });
            break;
          }
          case "SessionEnd":
            debugLog("Hooks", "SessionEnd", { session_id: event.session_id }, "info");
            store.markSessionStatus(event.session_id, "completed");
            // Close the terminal tab for this session (/exit was called)
            for (const [pid, tabs] of Object.entries(allTabsByProject)) {
              const termTab = tabs.find(
                (t) =>
                  (!t.type || t.type === "terminal") &&
                  t.resolvedSessionId === event.session_id
              );
              if (termTab) {
                store.closeTab(termTab.id, pid);
              }
            }
            break;
          case "Stop":
            debugLog("Hooks", "Stop", { session_id: event.session_id }, "warn");
            store.markSessionStatus(event.session_id, "idle");
            break;
          case "SubagentStart": {
            debugLog("Hooks", "SubagentStart", { session_id: event.session_id, agent_id: event.agent_id, agent_type: event.agent_type }, "info");
            if (event.agent_id) {
              const current = activeSubagentsRef.current[event.session_id] ?? [];
              if (!current.some((a) => a.agent_id === event.agent_id)) {
                store.setSubagents(event.session_id, [
                  ...current,
                  {
                    agent_id: event.agent_id,
                    agent_type: event.agent_type,
                    started_at: undefined,
                  },
                ]);
              }
            }
            break;
          }
          case "SubagentStop": {
            debugLog("Hooks", "SubagentStop", { session_id: event.session_id, agent_id: event.agent_id }, "info");
            if (event.agent_id) {
              const current = activeSubagentsRef.current[event.session_id] ?? [];
              store.setSubagents(
                event.session_id,
                current.filter((a) => a.agent_id !== event.agent_id)
              );
            }
            break;
          }
        }
      })
    );

    unlisteners.push(
      listen("inbox-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["inbox"] });
      })
    );
    unlisteners.push(
      listen("team-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["teams"] });
      })
    );
    unlisteners.push(
      listen("task-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      })
    );
    unlisteners.push(
      listen("transcript-updated", () => {
        queryClient.invalidateQueries({ queryKey: ["transcript"] });
      })
    );
    unlisteners.push(
      listen("session-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      })
    );
    unlisteners.push(
      listen("todos-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["todos"] });
      })
    );
    unlisteners.push(
      listen("plans-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["plans"] });
      })
    );
    unlisteners.push(
      listen<{ tab_id: string; filename: string }>("plan-linked", ({ payload }) => {
        const s = useSessionStore.getState();
        s.linkPlan(payload.filename, payload.tab_id);
        // Derive a readable title from the filename (strip extension)
        const title = payload.filename.replace(/\.md$/, "");
        const pid = activeProjectIdRef.current ?? "";
        if (pid) s.openPlanTab(payload.filename, title, pid);
      })
    );

    // Claude CLI question detected — notify user
    unlisteners.push(
      listen<{ tab_id: string; question: string }>("claude-question", ({ payload }) => {
        const { tabsByProject } = useSessionStore.getState();
        for (const [projectId, tabs] of Object.entries(tabsByProject)) {
          const tab = tabs.find((t) => t.id === payload.tab_id);
          if (tab) {
            useNotificationStore.getState().addNotification({
              tabId: payload.tab_id,
              projectId,
              sessionTitle: tab.title ?? "Session",
              question: payload.question,
            });
            break;
          }
        }
      })
    );

    // Session completion summary saved
    unlisteners.push(
      listen<{ session_id: string; project_path: string; project_dir: string; filename: string; preview: string }>(
        "session-summary",
        ({ payload }) => {
          debugLog("Hooks", "SessionSummary", { session_id: payload.session_id, filename: payload.filename }, "info");
          queryClient.invalidateQueries({ queryKey: ["summaries"] });
          const projectId = pathToProjectId(payload.project_path);
          // Find the session title from open tabs or fall back to session ID prefix
          const { tabsByProject } = useSessionStore.getState();
          const projectTabs = tabsByProject[projectId] ?? [];
          const sessionTab = projectTabs.find(
            (t) =>
              t.sessionId === payload.session_id ||
              t.resolvedSessionId === payload.session_id
          );
          const sessionTitle = sessionTab?.title ?? payload.session_id.slice(0, 8);
          useNotificationStore.getState().addCompletionNotification({
            sessionId: payload.session_id,
            projectId,
            sessionTitle,
            filename: payload.filename,
            preview: payload.preview,
          });
        }
      )
    );

    return () => {
      unlisteners.forEach((unlisten) => {
        unlisten.then((f) => f());
      });
    };
  }, [queryClient]); // eslint-disable-line react-hooks/exhaustive-deps
}
