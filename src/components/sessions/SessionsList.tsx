// SessionsList is no longer rendered directly — replaced by ProjectSwitcher.
// Kept for reference; uses updated store API.
import { Terminal, GitBranch } from "lucide-react";
import { useSessions } from "../../hooks/useClaudeData";
import { useSessionStore } from "../../stores/sessionStore";
import { useProjectsStore } from "../../stores/projectsStore";
import { useActiveProjectTabs } from "../../hooks/useActiveProjectTabs";
import type { SessionEntry } from "../../lib/tauri";
import { cn } from "@/lib/utils";

export function SessionsList() {
  const { openTabs, activeTabId, projectId } = useActiveProjectTabs();
  const openTab = useSessionStore((s) => s.openTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const knownSessions = useSessionStore((s) => s.knownSessions);
  const activeSubagents = useSessionStore((s) => s.activeSubagents);
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );

  const { data: sessions, isLoading } = useSessions(activeProject?.path ?? "");

  const openSessionIds = openTabs
    .map((t) => t.sessionId)
    .filter(Boolean) as string[];

  const handleOpenSession = (session: SessionEntry) => {
    if (!projectId) return;
    const existingTab = openTabs.find((t) => t.sessionId === session.sessionId);
    if (existingTab) {
      setActiveTab(existingTab.id, projectId);
      return;
    }
    const title =
      session.summary ||
      session.firstPrompt?.slice(0, 50) ||
      session.sessionId.slice(0, 8);
    openTab(
      {
        id: `session-${session.sessionId}`,
        title,
        projectDir: activeProject?.path ?? "",
        sessionId: session.sessionId,
        spawnedAt: Date.now(),
      },
      projectId
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* New session button */}
      <div className="px-2 py-2 border-b border-[var(--color-border-default)]">
        <button
          onClick={() => {
            if (!projectId) return;
            const id = `session-${Date.now()}`;
            openTab(
              { id, title: "New Session", projectDir: activeProject?.path ?? "", spawnedAt: Date.now() },
              projectId
            );
          }}
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded text-xs bg-[var(--color-bg-raised)] hover:bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors border border-[var(--color-border-default)]"
        >
          <Terminal size={12} />
          New Claude Session
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {openTabs
          .filter((t) => !t.sessionId)
          .map((tab) => {
            const isLive = tab.resolvedSessionId
              ? knownSessions[tab.resolvedSessionId] === true
              : false;
            const subs = tab.resolvedSessionId
              ? (activeSubagents[tab.resolvedSessionId] ?? [])
              : [];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id, projectId)}
                className={cn(
                  "flex items-center gap-1.5 w-full px-3 py-2 text-left border-b border-[var(--color-border-default)] transition-colors text-xs",
                  activeTabId === tab.id
                    ? "bg-[var(--color-bg-raised)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)]"
                )}
              >
                <Terminal size={10} className="text-[var(--color-text-muted)]" />
                <span className="truncate flex-1">{tab.title}</span>
                {isLive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-success)] animate-pulse" />
                )}
                {subs.length > 0 && (
                  <span className="text-[9px] text-[var(--color-status-warning)] font-medium">
                    {subs.length}
                  </span>
                )}
              </button>
            );
          })}
        {isLoading && (
          <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
            Loading sessions...
          </div>
        )}
        {sessions
          ?.filter((s) => !s.isSidechain)
          .map((session) => {
            const tab = openTabs.find((t) => t.sessionId === session.sessionId);
            const resolvedId = tab?.resolvedSessionId;
            const isLive = resolvedId ? knownSessions[resolvedId] === true : false;
            const subs = resolvedId ? (activeSubagents[resolvedId] ?? []) : [];
            return (
              <SessionItem
                key={session.sessionId}
                session={session}
                isOpen={openSessionIds.includes(session.sessionId)}
                isLive={isLive}
                subagentCount={subs.length}
                subagentTypes={subs.map((a) => a.agent_type).filter(Boolean) as string[]}
                onClick={() => handleOpenSession(session)}
              />
            );
          })}
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
}: {
  session: SessionEntry;
  isOpen: boolean;
  isLive: boolean;
  subagentCount: number;
  subagentTypes: string[];
  onClick: () => void;
}) {
  const title =
    session.summary ||
    session.firstPrompt?.slice(0, 50) ||
    session.sessionId.slice(0, 8);
  const timeStr = session.modified
    ? formatRelativeTime(new Date(session.modified))
    : "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col w-full px-3 py-2 text-left border-b border-[var(--color-border-default)] transition-colors",
        isOpen
          ? "bg-[var(--color-bg-raised)] text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)] hover:text-[var(--color-text-primary)]"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Terminal
          size={10}
          className={isOpen ? "text-[var(--color-accent-primary)]" : "text-[var(--color-text-muted)]"}
        />
        <span className="text-xs truncate flex-1">{title}</span>
        <div className="flex items-center gap-1 shrink-0">
          {isLive && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-success)] animate-pulse shrink-0" />
          )}
          {subagentCount > 0 && (
            <span className="text-[9px] text-[var(--color-status-warning)] font-medium leading-none" title={subagentTypes.join(" * ")}>
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

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
