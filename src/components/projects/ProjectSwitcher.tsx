import { FolderOpen, Plus, Terminal, GitBranch, GitFork, Trash2, AlertTriangle, X, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useProjectsStore } from "@/stores/projectsStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useActiveProjectTabs } from "@/hooks/useActiveProjectTabs";
import { useSessions } from "@/hooks/useClaudeData";
import { pickFolder, listOrphanedProjects, deleteProject } from "@/lib/tauri";
import type { Project, SessionEntry } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export function ProjectSwitcher() {
  const { projects, activeProjectId, setActiveProject, addAndActivateProject, removeProject } =
    useProjectsStore();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [orphaned, setOrphaned] = useState<Project[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  useEffect(() => {
    listOrphanedProjects().then(setOrphaned).catch(() => {});
  }, []);
  const { openTabs, activeTabId, projectId } = useActiveProjectTabs();
  const openTab = useSessionStore((s) => s.openTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const knownSessions = useSessionStore((s) => s.knownSessions);
  const activeSubagents = useSessionStore((s) => s.activeSubagents);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const { data: sessions, isLoading } = useSessions(activeProject?.path ?? "");

  // Group worktrees under their parent projects (same parent directory, non-worktree sibling)
  const { mainProjects, worktreesByParentId, standaloneWorktrees } = useMemo(() => {
    const getParentDir = (path: string) =>
      path.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
    const mains = projects.filter((p) => !p.isWorktree);
    const worktrees = projects.filter((p) => p.isWorktree);
    const byParent = new Map<string, typeof projects>();
    const standalone: typeof projects = [];
    for (const wt of worktrees) {
      const wtParentDir = getParentDir(wt.path);
      const parent = mains.find((mp) => getParentDir(mp.path) === wtParentDir);
      if (parent) {
        const list = byParent.get(parent.id) ?? [];
        list.push(wt);
        byParent.set(parent.id, list);
      } else {
        standalone.push(wt);
      }
    }
    return { mainProjects: mains, worktreesByParentId: byParent, standaloneWorktrees: standalone };
  }, [projects]);

  // Auto-open README + CLAUDE.md tabs when the active project changes
  useEffect(() => {
    if (!activeProject || !projectId) return;
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
  }, [activeProjectId]);

  const handlePickFolder = async () => {
    try {
      const path = await pickFolder();
      if (path) addAndActivateProject(path);
    } catch (e) {
      console.error("[projects] pick folder failed:", e);
    }
  };

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
    const existingTab = openTabs.find((t) => t.sessionId === session.sessionId);
    if (existingTab) {
      setActiveTab(existingTab.id, projectId);
      return;
    }
    const title =
      session.summary || session.firstPrompt?.slice(0, 50) || session.sessionId.slice(0, 8);
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

  const openSessionIds = openTabs.map((t) => t.sessionId).filter(Boolean) as string[];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Project header with dropdown */}
      <div ref={dropdownRef} className="relative border-b border-[var(--color-border-default)]">
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-[var(--color-bg-raised)] transition-colors"
        >
          <FolderOpen size={12} className="text-[var(--color-text-muted)] shrink-0" />
          <span className="flex-1 text-left font-medium truncate text-[var(--color-text-primary)]">
            {activeProject?.name ?? "No project"}
          </span>
          <ChevronDown size={12} className={cn("text-[var(--color-text-muted)] transition-transform", dropdownOpen && "rotate-180")} />
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 right-0 top-full z-50 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-lg">
            {/* Main projects, each followed by their nested worktrees */}
            {mainProjects.map((project) => (
              <ProjectDropdownItem
                key={project.id}
                project={project}
                activeProjectId={activeProjectId}
                confirmDeleteId={confirmDeleteId}
                onSelect={() => { setActiveProject(project.id); setDropdownOpen(false); }}
                onDelete={() => setConfirmDeleteId(project.id)}
                onDeleteConfirm={async () => { await removeProject(project.id); setConfirmDeleteId(null); }}
                onDeleteCancel={() => setConfirmDeleteId(null)}
              >
                {(worktreesByParentId.get(project.id) ?? []).map((wt) => (
                  <ProjectDropdownItem
                    key={wt.id}
                    project={wt}
                    activeProjectId={activeProjectId}
                    confirmDeleteId={confirmDeleteId}
                    indent
                    onSelect={() => { setActiveProject(wt.id); setDropdownOpen(false); }}
                    onDelete={() => setConfirmDeleteId(wt.id)}
                    onDeleteConfirm={async () => { await removeProject(wt.id); setConfirmDeleteId(null); }}
                    onDeleteCancel={() => setConfirmDeleteId(null)}
                  />
                ))}
              </ProjectDropdownItem>
            ))}
            {/* Worktrees whose parent isn't in the store — show standalone */}
            {standaloneWorktrees.map((project) => (
              <ProjectDropdownItem
                key={project.id}
                project={project}
                activeProjectId={activeProjectId}
                confirmDeleteId={confirmDeleteId}
                onSelect={() => { setActiveProject(project.id); setDropdownOpen(false); }}
                onDelete={() => setConfirmDeleteId(project.id)}
                onDeleteConfirm={async () => { await removeProject(project.id); setConfirmDeleteId(null); }}
                onDeleteCancel={() => setConfirmDeleteId(null)}
              />
            ))}
            {/* Add project */}
            <button
              onClick={() => {
                handlePickFolder();
                setDropdownOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-raised)] border-t border-[var(--color-border-default)] transition-colors"
            >
              <Plus size={11} />
              Add project
            </button>
          </div>
        )}
      </div>

      {orphaned.length > 0 && (
        <OrphanedStrip
          orphaned={orphaned}
          onDeleted={(id) => setOrphaned((prev) => prev.filter((o) => o.id !== id))}
          onDeletedAll={() => setOrphaned([])}
        />
      )}

      {/* New session button */}
      <div className="px-2 py-2 border-b border-[var(--color-border-default)]">
        <button
          onClick={handleNewSession}
          disabled={!projectId}
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded text-xs bg-[var(--color-bg-raised)] hover:bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors border border-[var(--color-border-default)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Terminal size={12} />
          New Claude Session
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {/* Open new-session tabs (no sessionId yet) */}
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
            const openTab = openTabs.find((t) => t.sessionId === session.sessionId);
            const resolvedId = openTab?.resolvedSessionId;
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

function ProjectDropdownItem({
  project,
  activeProjectId,
  confirmDeleteId,
  indent = false,
  onSelect,
  onDelete,
  onDeleteConfirm,
  onDeleteCancel,
  children,
}: {
  project: import("@/lib/tauri").Project;
  activeProjectId: string | null;
  confirmDeleteId: string | null;
  indent?: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDeleteConfirm: () => Promise<void>;
  onDeleteCancel: () => void;
  children?: React.ReactNode;
}) {
  if (confirmDeleteId === project.id) {
    return (
      <>
        <DeleteConfirm
          key={project.id}
          project={project}
          onConfirm={onDeleteConfirm}
          onCancel={onDeleteCancel}
        />
        {children}
      </>
    );
  }
  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-2 py-1.5 hover:bg-[var(--color-bg-raised)] transition-colors",
          indent ? "pl-6 pr-3" : "px-3"
        )}
      >
        <button onClick={onSelect} className="flex items-center gap-2 flex-1 min-w-0 text-left text-xs">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              project.id === activeProjectId
                ? "bg-[var(--color-accent-primary)]"
                : "bg-transparent"
            )}
          />
          {indent && (
            <GitFork size={10} className="text-[var(--color-accent-secondary)] shrink-0" />
          )}
          <span className="truncate">{project.name}</span>
          {project.sessionCount > 0 && (
            <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
              {project.sessionCount}
            </span>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-status-error)] transition-all shrink-0"
        >
          <Trash2 size={11} />
        </button>
      </div>
      {children}
    </>
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
  const timeStr = session.modified ? formatRelativeTime(new Date(session.modified)) : "";

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
        "flex items-center gap-1.5 w-full px-3 py-2 text-left border-b border-[var(--color-border-default)] transition-colors text-xs",
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

function DeleteConfirm({
  project,
  onConfirm,
  onCancel,
}: {
  project: Project;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="mx-2 my-1 p-2 rounded border border-[var(--color-status-error)] bg-[var(--color-bg-raised)] text-xs">
      <p className="font-medium text-[var(--color-text-primary)] mb-1">
        Delete <span className="text-[var(--color-status-error)]">{project.name}</span>?
      </p>
      <p className="text-[var(--color-text-muted)] mb-2 leading-relaxed">
        Permanently deletes <code className="text-[var(--color-text-secondary)]">~/.claude/projects/{project.id}/</code> — all Claude session transcripts and conversation history for this project ({project.sessionCount} session{project.sessionCount !== 1 ? "s" : ""}). Your actual project files are not affected.
      </p>
      <div className="flex gap-1.5">
        <button
          onClick={async () => {
            setDeleting(true);
            await onConfirm();
          }}
          disabled={deleting}
          className="px-2 py-0.5 rounded bg-[var(--color-status-error)] text-white hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
        <button
          onClick={onCancel}
          disabled={deleting}
          className="px-2 py-0.5 rounded bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function OrphanedStrip({
  orphaned,
  onDeleted,
  onDeletedAll,
}: {
  orphaned: Project[];
  onDeleted: (id: string) => void;
  onDeletedAll: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteOne = async (id: string) => {
    try {
      await deleteProject(id);
      onDeleted(id);
    } catch (e) {
      console.error("[orphaned] delete failed:", e);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      for (const o of orphaned) {
        await deleteProject(o.id);
      }
      onDeletedAll();
    } catch (e) {
      console.error("[orphaned] delete all failed:", e);
      setDeleting(false);
    }
  };

  return (
    <div className="border-t border-b border-[var(--color-border-default)]">
      {!expanded ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5">
          <AlertTriangle size={11} className="text-[var(--color-status-warning)] shrink-0" />
          <span className="text-[10px] text-[var(--color-status-warning)] flex-1">
            {orphaned.length} orphaned
          </span>
          <button
            onClick={() => setExpanded(true)}
            className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            Clean up
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-1.5 px-3 py-1.5">
            <AlertTriangle size={11} className="text-[var(--color-status-warning)] shrink-0" />
            <span className="text-[10px] text-[var(--color-status-warning)] flex-1">
              Orphaned ({orphaned.length})
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <X size={11} />
            </button>
          </div>
          <div>
            {orphaned.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-2 px-3 py-1 text-xs text-[var(--color-text-secondary)]"
              >
                <span className="truncate flex-1">{o.name}</span>
                <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                  {o.sessionCount} session{o.sessionCount !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => handleDeleteOne(o.id)}
                  title="Delete orphaned project"
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-status-error)] transition-colors shrink-0"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="px-3 py-1.5">
            <button
              onClick={handleDeleteAll}
              disabled={deleting}
              className="w-full px-2 py-1 rounded text-[10px] bg-[var(--color-status-error)] text-white hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {deleting ? "Deleting…" : `Delete all ${orphaned.length}`}
            </button>
          </div>
        </div>
      )}
    </div>
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
