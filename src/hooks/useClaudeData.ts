import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import * as tauri from "../lib/tauri";
import { getActiveSessions } from "../lib/tauri";
import type { HookEvent } from "../lib/tauri";
import { pathToProjectId } from "../lib/utils";
import { useSessionStore } from "../stores/sessionStore";
import { useProjectsStore } from "../stores/projectsStore";
import { useNotificationStore } from "../stores/notificationStore";

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

export function useSendInboxMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      teamName: string;
      agentName: string;
      from: string;
      text: string;
      color?: string;
    }) =>
      tauri.sendInboxMessage(
        params.teamName,
        params.agentName,
        params.from,
        params.text,
        params.color
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["inbox", variables.teamName, variables.agentName],
      });
    },
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
  const resolveTabSession = useSessionStore((s) => s.resolveTabSession);
  const renameTab = useSessionStore((s) => s.renameTab);
  const setSubagents = useSessionStore((s) => s.setSubagents);
  const markSessionActive = useSessionStore((s) => s.markSessionActive);
  const linkPlan = useSessionStore((s) => s.linkPlan);
  const openPlanTab = useSessionStore((s) => s.openPlanTab);
  const tabsByProject = useSessionStore((s) => s.tabsByProject);
  const activeSubagents = useSessionStore((s) => s.activeSubagents);
  const tabsByProjectRef = useRef(tabsByProject);
  tabsByProjectRef.current = tabsByProject;
  const activeSubagentsRef = useRef(activeSubagents);
  activeSubagentsRef.current = activeSubagents;

  // Active project for openPlanTab — read from projects store via ref
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;

  useEffect(() => {
    getActiveSessions().then((sessions) => {
      for (const session of sessions) {
        markSessionActive(session.session_id, session.is_active);
        if (session.subagents.length > 0) {
          setSubagents(session.session_id, session.subagents);
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
            resolveTabSession(tab.id, session.session_id);
            if (!tab.sessionId && tab.title === "New Session") {
              renameTab(tab.id, session.session_id.slice(0, 8));
            }
          }
        }
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unlisteners: Promise<() => void>[] = [];

    unlisteners.push(
      listen<HookEvent>("hook-event", ({ payload: event }) => {
        const allTabsByProject = tabsByProjectRef.current;
        switch (event.hook_event_name) {
          case "SessionStart": {
            markSessionActive(event.session_id, true);
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
              resolveTabSession(tab.id, event.session_id);
              if (!tab.sessionId && tab.title === "New Session") {
                renameTab(tab.id, event.session_id.slice(0, 8));
              }
            }
            // Also check if a resume tab exists (has sessionId but not yet resolved)
            const resumeTab = projectTabs.find(
              (t) => !t.resolvedSessionId && t.sessionId === event.session_id
            );
            if (resumeTab) {
              resolveTabSession(resumeTab.id, event.session_id);
            }
            // Close any session-view tab for this session (resumed externally)
            for (const [pid, tabs] of Object.entries(allTabsByProject)) {
              const svTab = tabs.find(
                (t) => t.type === "session-view" && t.sessionId === event.session_id
              );
              if (svTab) {
                useSessionStore.getState().closeTab(svTab.id, pid);
              }
            }
            break;
          }
          case "SessionEnd":
            markSessionActive(event.session_id, false);
            // Close the terminal tab for this session (/exit was called)
            for (const [pid, tabs] of Object.entries(allTabsByProject)) {
              const termTab = tabs.find(
                (t) =>
                  (!t.type || t.type === "terminal") &&
                  t.resolvedSessionId === event.session_id
              );
              if (termTab) {
                useSessionStore.getState().closeTab(termTab.id, pid);
              }
            }
            break;
          case "Stop":
            markSessionActive(event.session_id, false);
            break;
          case "SubagentStart": {
            if (event.agent_id) {
              const current = activeSubagentsRef.current[event.session_id] ?? [];
              if (!current.some((a) => a.agent_id === event.agent_id)) {
                setSubagents(event.session_id, [
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
            if (event.agent_id) {
              const current = activeSubagentsRef.current[event.session_id] ?? [];
              setSubagents(
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
        linkPlan(payload.filename, payload.tab_id);
        // Derive a readable title from the filename (strip extension)
        const title = payload.filename.replace(/\.md$/, "");
        const pid = activeProjectIdRef.current ?? "";
        if (pid) openPlanTab(payload.filename, title, pid);
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

    return () => {
      unlisteners.forEach((unlisten) => {
        unlisten.then((f) => f());
      });
    };
  }, [queryClient, resolveTabSession, renameTab, setSubagents, markSessionActive, linkPlan, openPlanTab, activeProjectId]);
}
