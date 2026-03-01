import { Terminal, GitBranch, ChevronRight, ChevronDown, FileText, Scroll, Bot } from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProjectsStore } from "@/stores/projectsStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useActiveProjectTabs } from "@/hooks/useActiveProjectTabs";
import { useSessions, useSummaries, useSubagentSessions } from "@/hooks/useClaudeData";
import type { SessionEntry, SummaryFile, SubagentSessionEntry } from "@/lib/tauri";
import { deleteSession } from "@/lib/tauri";
import { SessionContextMenu } from "@/components/sessions/SessionContextMenu";
import { cn } from "@/lib/utils";

export function ProjectSwitcher() {
  const { projects, activeProjectId } = useProjectsStore();
  const queryClient = useQueryClient();
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; session: SessionEntry; isLive: boolean;
  } | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const { openTabs, activeTabId, projectId } = useActiveProjectTabs();
  const openTab = useSessionStore((s) => s.openTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const openSummaryTab = useSessionStore((s) => s.openSummaryTab);
  const openPlanTab = useSessionStore((s) => s.openPlanTab);
  const knownSessions = useSessionStore((s) => s.knownSessions);
  const activeSubagents = useSessionStore((s) => s.activeSubagents);
  const planLinks = useSessionStore((s) => s.planLinks);

  const openStartupFiles = useSettingsStore((s) => s.openStartupFiles);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeProjectPath = activeProject?.path ?? "";
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

  const handleNewSession = () => {
    if (!projectId) return;
    const id = `session-${Date.now()}`;
    openTab(
      { id, title: "New Session", projectDir: activeProject?.path ?? "", spawnedAt: Date.now() },
      projectId
    );
  };

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

  const handleOpenSubagent = (subagent: SubagentSessionEntry) => {
    if (!projectId) return;
    const tabId = `subagent:${subagent.agentId}`;
    const existingTab = openTabs.find((t) => t.id === tabId);
    if (existingTab) {
      setActiveTab(existingTab.id, projectId);
      return;
    }
    const shortId = subagent.agentId.replace(/^agent-/, "").slice(-8);
    const title = subagent.agentType
      ? `${subagent.agentType} (${shortId})`
      : `agent-${shortId}`;
    openTab(
      {
        id: tabId,
        type: "session-view",
        title,
        projectDir: activeProjectPath,
        filePath: subagent.jsonlPath,
      },
      projectId
    );
  };

  const toggleExpanded = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const openSessionIds = openTabs
    .flatMap((t) => [t.resolvedSessionId, t.sessionId])
    .filter(Boolean) as string[];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* New session button */}
      <div className="px-2 py-2 border-b border-[var(--color-border-muted)]">
        <button
          onClick={handleNewSession}
          disabled={!projectId}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs bg-[var(--color-bg-raised)] hover:bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all duration-200 border border-[var(--color-border-muted)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Terminal size={12} />
          New Claude Session
        </button>
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
              <SessionTreeItem
                key={session.sessionId}
                session={session}
                isOpen={openSessionIds.includes(session.sessionId)}
                isLive={isLive}
                subagentCount={subs.length}
                subagentTypes={subs.map((a) => a.agent_type).filter(Boolean) as string[]}
                isExpanded={expandedSessions.has(session.sessionId)}
                onToggle={() => toggleExpanded(session.sessionId)}
                onClick={() => handleOpenSession(session)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, session, isLive });
                }}
                planLinks={planLinks}
                projectDir={activeProjectPath}
                projectId={projectId}
                onOpenPlan={(filename) =>
                  openPlanTab(filename, filename.replace(/\.md$/, ""), projectId)
                }
                onOpenSummary={(summary) =>
                  openSummaryTab(summary.session_id, summary.filename, projectId, projectId)
                }
                onOpenSubagent={handleOpenSubagent}
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

function SessionTreeItem({
  session,
  isOpen,
  isLive,
  subagentCount,
  subagentTypes,
  isExpanded,
  onToggle,
  onClick,
  onContextMenu,
  planLinks,
  projectDir,
  projectId,
  onOpenPlan,
  onOpenSummary,
  onOpenSubagent,
}: {
  session: SessionEntry;
  isOpen: boolean;
  isLive: boolean;
  subagentCount: number;
  subagentTypes: string[];
  isExpanded: boolean;
  onToggle: () => void;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  planLinks: Record<string, string>;
  projectDir: string;
  projectId: string;
  onOpenPlan: (filename: string) => void;
  onOpenSummary: (summary: SummaryFile) => void;
  onOpenSubagent: (subagent: SubagentSessionEntry) => void;
}) {
  const title = session.summary || session.sessionId.slice(0, 8);
  const timeStr = session.modified ? formatRelativeTime(new Date(session.modified)) : "";
  const linkedPlans = Object.entries(planLinks)
    .filter(([, sid]) => sid === session.sessionId)
    .map(([filename]) => filename);

  return (
    <div>
      <div
        className={cn(
          "flex items-start w-full px-1 py-1 transition-all duration-200 mx-1 my-0.5 rounded-lg",
          isOpen
            ? "bg-[var(--color-bg-raised)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)] hover:text-[var(--color-text-primary)]"
        )}
      >
        {/* Expand toggle */}
        <button
          onClick={onToggle}
          className="w-4 h-5 shrink-0 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mt-0.5"
        >
          {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </button>
        {/* Main session button */}
        <button
          onClick={onClick}
          onContextMenu={onContextMenu}
          className="flex flex-col flex-1 min-w-0 text-left px-1"
        >
          <div className="flex items-center gap-1.5">
            <Terminal
              size={10}
              className={isOpen ? "text-[var(--color-accent-primary)]" : "text-[var(--color-text-muted)]"}
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
      </div>
      {isExpanded && (
        <SessionTreeExpanded
          session={session}
          linkedPlans={linkedPlans}
          projectDir={projectDir}
          projectId={projectId}
          onOpenPlan={onOpenPlan}
          onOpenSummary={onOpenSummary}
          onOpenSubagent={onOpenSubagent}
        />
      )}
    </div>
  );
}

function SessionTreeExpanded({
  session,
  linkedPlans,
  projectDir,
  projectId,
  onOpenPlan,
  onOpenSummary,
  onOpenSubagent,
}: {
  session: SessionEntry;
  linkedPlans: string[];
  projectDir: string;
  projectId: string;
  onOpenPlan: (filename: string) => void;
  onOpenSummary: (summary: SummaryFile) => void;
  onOpenSubagent: (subagent: SubagentSessionEntry) => void;
}) {
  // projectId === encodedProjectDir (both are pathToProjectId(project.path))
  const { data: summaries } = useSummaries(projectId, session.sessionId);
  const { data: subagents } = useSubagentSessions(projectDir || null, session.sessionId);

  const hasChildren =
    linkedPlans.length > 0 ||
    (summaries && summaries.length > 0) ||
    (subagents && subagents.length > 0);
  if (!hasChildren) return null;

  return (
    <div className="ml-5 border-l border-[var(--color-border-muted)] pl-1 mb-1">
      {linkedPlans.map((filename) => (
        <PlanTreeNode
          key={filename}
          filename={filename}
          onOpen={() => onOpenPlan(filename)}
        />
      ))}
      {summaries?.map((summary) => (
        <SummaryTreeNode
          key={summary.filename}
          summary={summary}
          onOpen={() => onOpenSummary(summary)}
        />
      ))}
      {subagents?.map((subagent) => (
        <SubagentTreeNode
          key={subagent.agentId}
          subagent={subagent}
          onOpen={() => onOpenSubagent(subagent)}
        />
      ))}
    </div>
  );
}

function PlanTreeNode({
  filename,
  onOpen,
}: {
  filename: string;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-1.5 w-full px-2 py-1 text-left text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)] rounded transition-colors"
    >
      <FileText size={10} className="text-[var(--color-accent-primary)] shrink-0" />
      <span className="truncate">{filename.replace(/\.md$/, "")}</span>
    </button>
  );
}

function SummaryTreeNode({
  summary,
  onOpen,
}: {
  summary: SummaryFile;
  onOpen: () => void;
}) {
  const match = summary.filename.match(/-summary-(\d+)\.md$/);
  const num = match ? parseInt(match[1], 10) : 1;
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-1.5 w-full px-2 py-1 text-left text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)] rounded transition-colors"
      title={summary.preview}
    >
      <Scroll size={10} className="text-[var(--color-text-muted)] shrink-0" />
      <span className="truncate">Summary {num}</span>
    </button>
  );
}

function SubagentTreeNode({
  subagent,
  onOpen,
}: {
  subagent: SubagentSessionEntry;
  onOpen: () => void;
}) {
  const shortId = subagent.agentId.replace(/^agent-/, "").slice(-8);
  const label = subagent.agentType
    ? `${subagent.agentType} · ${shortId}`
    : `agent-${shortId}`;
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-1.5 w-full px-2 py-1 text-left text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)] rounded transition-colors"
      title={subagent.firstPrompt ?? subagent.agentId}
    >
      <Bot size={10} className="text-[var(--color-status-warning)] shrink-0" />
      <span className="truncate flex-1">{label}</span>
      {subagent.messageCount !== undefined && (
        <span className="text-[9px] text-[var(--color-text-muted)] shrink-0">
          {subagent.messageCount}
        </span>
      )}
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
