import { Terminal, GitBranch, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProjectsStore } from "@/stores/projectsStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useActiveProjectTabs } from "@/hooks/useActiveProjectTabs";
import { useSessions } from "@/hooks/useClaudeData";
import type { SessionEntry } from "@/lib/tauri";
import { deleteSession } from "@/lib/tauri";
import { SessionContextMenu } from "@/components/sessions/SessionContextMenu";
import { cn } from "@/lib/utils";

export function ProjectSwitcher() {
  const { projects, activeProjectId } = useProjectsStore();
  const queryClient = useQueryClient();
  const [namingSession, setNamingSession] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; session: SessionEntry; isLive: boolean;
  } | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { openTabs, activeTabId, projectId } = useActiveProjectTabs();
  const openTab = useSessionStore((s) => s.openTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const knownSessions = useSessionStore((s) => s.knownSessions);
  const activeSubagents = useSessionStore((s) => s.activeSubagents);

  const openStartupFiles = useSettingsStore((s) => s.openStartupFiles);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const { data: sessions, isLoading } = useSessions(activeProject?.path ?? "");

  // Auto-open README + CLAUDE.md tabs when the active project changes (opt-in)
  useEffect(() => {
    if (!activeProject || !projectId || !openStartupFiles) return;
    openTab(
      {
        id: `claude:${projectId}`,
        type: "readme",
        title: "CLAUDE.md",
        filePath: activeProject.path + "/CLAUDE.md",
        projectDir: activeProject.path,
      },
      projectId
    );
    openTab(
      {
        id: `readme:${projectId}`,
        type: "readme",
        title: "README.md",
        filePath: activeProject.path + "/README.md",
        projectDir: activeProject.path,
      },
      projectId
    );
  }, [activeProjectId, openStartupFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewSession = (title = "New Session") => {
    if (!projectId) return;
    const id = `session-${Date.now()}`;
    openTab(
      { id, title, projectDir: activeProject?.path ?? "", spawnedAt: Date.now() },
      projectId
    );
  };

  const handleStartNaming = () => {
    if (!projectId) return;
    setSessionName("");
    setNamingSession(true);
  };

  const handleConfirmName = () => {
    handleNewSession(sessionName.trim() || "New Session");
    setNamingSession(false);
    setSessionName("");
  };

  const handleCancelName = () => {
    setNamingSession(false);
    setSessionName("");
  };

  useEffect(() => {
    if (namingSession) nameInputRef.current?.focus();
  }, [namingSession]);

  const handleOpenSession = (session: SessionEntry) => {
    if (!projectId) return;
    const existingTab = openTabs.find(
      (t) => t.resolvedSessionId === session.sessionId || t.sessionId === session.sessionId
    );
    if (existingTab) {
      setActiveTab(existingTab.id, projectId);
      return;
    }
    const title = session.summary || session.sessionId.slice(0, 8);
    openTab(
      {
        id: `session-${session.sessionId}`,
        type: "session-view",
        title,
        projectDir: activeProject?.path ?? "",
        sessionId: session.sessionId,
        spawnedAt: Date.now(),
      },
      projectId
    );
  };

  const handleResumeDirectly = (session: SessionEntry) => {
    if (!projectId) return;
    const existing = openTabs.find(
      (t) => t.resolvedSessionId === session.sessionId || t.sessionId === session.sessionId
    );
    if (existing) { setActiveTab(existing.id, projectId); return; }
    openTab(
      {
        id: `session-${session.sessionId}`,
        title: session.summary || session.sessionId.slice(0, 8),
        projectDir: activeProject?.path ?? "",
        sessionId: session.sessionId,
        spawnedAt: Date.now(),
      },
      projectId
    );
  };

  const handleForkSession = (session: SessionEntry) => {
    if (!projectId) return;
    openTab(
      {
        id: `session-${Date.now()}`,
        title: `Fork: ${session.summary || session.sessionId.slice(0, 8)}`,
        projectDir: activeProject?.path ?? "",
        sessionId: session.sessionId,
        forkSession: true,
        spawnedAt: Date.now(),
      },
      projectId
    );
  };

  const handleDeleteSession = async (session: SessionEntry) => {
    if (!activeProject) return;
    await deleteSession(activeProject.path, session.sessionId);
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    setContextMenu(null);
  };

  const openSessionIds = openTabs
    .flatMap((t) => [t.resolvedSessionId, t.sessionId])
    .filter(Boolean) as string[];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* New session button / inline naming form */}
      <div className="px-2 py-2 border-b border-[var(--color-border-muted)]">
        {namingSession ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleConfirmName(); }}
            className="flex gap-1"
          >
            <input
              ref={nameInputRef}
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") handleCancelName(); }}
              placeholder="Session name…"
              className="flex-1 min-w-0 px-2 py-1 rounded text-xs bg-[var(--color-bg-input)] border border-[var(--color-accent-primary)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
            />
            <button
              type="submit"
              className="px-2 py-1 rounded-lg text-xs bg-[var(--color-accent-primary)] text-white hover:opacity-90 transition-opacity"
            >
              Start
            </button>
            <button
              type="button"
              onClick={handleCancelName}
              className="px-1.5 py-1 rounded text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <X size={11} />
            </button>
          </form>
        ) : (
          <button
            onClick={handleStartNaming}
            disabled={!projectId}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs bg-[var(--color-bg-raised)] hover:bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all duration-200 border border-[var(--color-border-muted)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Terminal size={12} />
            New Claude Session
          </button>
        )}
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {/* Resolved tabs not yet written to disk (hook fired, sessions-index.json not ready yet) */}
        {openTabs
          .filter((t) => {
            if (!(!t.type || t.type === "terminal")) return false;
            if (!t.resolvedSessionId) return false;
            if (knownSessions[t.resolvedSessionId] === undefined) return false;
            return !(sessions?.some((s) => s.sessionId === t.resolvedSessionId) ?? false);
          })
          .map((tab) => {
            const isLive = knownSessions[tab.resolvedSessionId!] === "active";
            const subs = activeSubagents[tab.resolvedSessionId!] ?? [];
            return (
              <NewSessionTabItem
                key={tab.id}
                tab={tab}
                isActive={activeTabId === tab.id}
                isLive={isLive}
                subagentCount={subs.length}
                subagentTypes={subs.map((a) => a.agent_type).filter(Boolean) as string[]}
                onClick={() => setActiveTab(tab.id, projectId)}
              />
            );
          })}

        {isLoading && (
          <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
            Loading sessions...
          </div>
        )}
        {!isLoading && (!sessions || sessions.length === 0) && activeProject && (
          <div className="px-3 py-4 text-xs text-[var(--color-text-muted)] text-center">
            No sessions yet
          </div>
        )}
        {sessions
          ?.filter((s) => !s.isSidechain)
          .map((session) => {
            const isLive = knownSessions[session.sessionId] === "active";
            const subs = activeSubagents[session.sessionId] ?? [];
            return (
              <SessionItem
                key={session.sessionId}
                session={session}
                isOpen={openSessionIds.includes(session.sessionId)}
                isLive={isLive}
                subagentCount={subs.length}
                subagentTypes={subs.map((a) => a.agent_type).filter(Boolean) as string[]}
                onClick={() => handleOpenSession(session)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, session, isLive });
                }}
              />
            );
          })}
        {contextMenu && (
          <SessionContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            isOpen={openSessionIds.includes(contextMenu.session.sessionId)}
            isLive={contextMenu.isLive}
            onClose={() => setContextMenu(null)}
            onResume={() => { setContextMenu(null); handleResumeDirectly(contextMenu.session); }}
            onFork={() => { setContextMenu(null); handleForkSession(contextMenu.session); }}
            onDelete={() => handleDeleteSession(contextMenu.session)}
          />
        )}
      </div>
    </div>
  );
}

function SessionItem({
  session,
  isOpen,
  isLive,
  subagentCount,
  subagentTypes,
  onClick,
  onContextMenu,
}: {
  session: SessionEntry;
  isOpen: boolean;
  isLive: boolean;
  subagentCount: number;
  subagentTypes: string[];
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const title = session.summary || session.sessionId.slice(0, 8);
  const timeStr = session.modified ? formatRelativeTime(new Date(session.modified)) : "";

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "flex flex-col w-full px-3 py-2.5 text-left transition-all duration-200 mx-1 my-0.5 rounded-lg",
        isOpen
          ? "bg-[var(--color-bg-raised)] text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)] hover:text-[var(--color-text-primary)]"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Terminal
          size={10}
          className={
            isOpen
              ? "text-[var(--color-accent-primary)]"
              : "text-[var(--color-text-muted)]"
          }
        />
        <span className="text-xs truncate flex-1">{title}</span>
        <div className="flex items-center gap-1 shrink-0">
          {isLive && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-success)] animate-pulse shrink-0"
              title="Session active"
            />
          )}
          {subagentCount > 0 && (
            <span
              className="text-[9px] text-[var(--color-status-warning)] font-medium leading-none"
              title={subagentTypes.join(" * ")}
            >
              {subagentCount}
            </span>
          )}
          {isOpen && !isLive && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-primary)] shrink-0" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-0.5 ml-4">
        {session.gitBranch && (
          <span className="flex items-center gap-0.5 text-[10px] text-[var(--color-text-muted)]">
            <GitBranch size={8} />
            {session.gitBranch}
          </span>
        )}
        {timeStr && (
          <span className="text-[10px] text-[var(--color-text-muted)]">{timeStr}</span>
        )}
      </div>
    </button>
  );
}

function NewSessionTabItem({
  tab,
  isActive,
  isLive,
  subagentCount,
  subagentTypes,
  onClick,
}: {
  tab: { id: string; title: string };
  isActive: boolean;
  isLive: boolean;
  subagentCount: number;
  subagentTypes: string[];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 w-full px-3 py-2 text-left transition-colors text-xs mx-1 my-0.5 rounded-lg",
        isActive
          ? "bg-[var(--color-bg-raised)] text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)]"
      )}
    >
      <Terminal
        size={10}
        className={isActive ? "text-[var(--color-accent-primary)]" : "text-[var(--color-text-muted)]"}
      />
      <span className="truncate flex-1">{tab.title}</span>
      <div className="flex items-center gap-1 shrink-0">
        {isLive && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-success)] animate-pulse"
            title="Session active"
          />
        )}
        {subagentCount > 0 && (
          <span
            className="text-[9px] text-[var(--color-status-warning)] font-medium"
            title={subagentTypes.join(" * ")}
          >
            {subagentCount}
          </span>
        )}
      </div>
    </button>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
