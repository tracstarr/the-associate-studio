import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Minus, Square, X, ChevronDown, GitBranch, FolderOpen, Plus, RefreshCw, GitMerge, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveProjectTabs } from "@/hooks/useActiveProjectTabs";
import { useProjectsStore } from "@/stores/projectsStore";
import { useGitCurrentBranch, useGitBranches } from "@/hooks/useClaudeData";
import { useQueryClient } from "@tanstack/react-query";
import { useGitAction } from "@/hooks/useGitAction";
import type { Project } from "@/lib/tauri";
import { gitFetch, gitPull, gitCreateBranch, pickFolder as pickFolderFn } from "@/lib/tauri";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useUIStore } from "@/stores/uiStore";

// ─── Avatar color palette (deterministic from project name) ──────────────────

const AVATAR_COLORS = [
  "#e06c75", // red
  "#e5c07b", // yellow
  "#98c379", // green
  "#56b6c2", // cyan
  "#61afef", // blue
  "#c678dd", // purple
  "#d19a66", // orange
  "#abb2bf", // gray
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function avatarInitials(name: string): string {
  const parts = name.replace(/[-_]/g, " ").split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Project Avatar ───────────────────────────────────────────────────────────

function ProjectAvatar({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-sm font-bold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        backgroundColor: avatarColor(name),
        color: "#1a1d23",
      }}
    >
      {avatarInitials(name)}
    </span>
  );
}

// ─── Branch Dropdown ─────────────────────────────────────────────────────────

function BranchDropdown({
  cwd,
  currentBranch,
  onClose,
}: {
  cwd: string;
  currentBranch: string;
  onClose: () => void;
}) {
  const { data: branches } = useGitBranches(cwd);
  const ref = useRef<HTMLDivElement>(null);
  const runGitAction = useGitAction();
  const queryClient = useQueryClient();
  const [showNewBranchInput, setShowNewBranchInput] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchLoading, setNewBranchLoading] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleFetch = async () => {
    onClose();
    await runGitAction("git fetch", () => gitFetch(cwd));
  };

  const handlePull = async () => {
    onClose();
    await runGitAction("git pull", () => gitPull(cwd));
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim() || newBranchLoading) return;
    setNewBranchLoading(true);
    try {
      await runGitAction(
        `git checkout -b ${newBranchName.trim()}`,
        () => gitCreateBranch(cwd, newBranchName.trim(), currentBranch)
      );
      queryClient.invalidateQueries({ queryKey: ["gitBranches", cwd] });
    } finally {
      setNewBranchLoading(false);
      onClose();
    }
  };

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-50 min-w-52 bg-bg-overlay border border-border-default rounded shadow-lg py-1 text-xs"
    >
      {/* Action toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border-default">
        <button
          onClick={handleFetch}
          title="Fetch all remotes"
          className="flex items-center gap-1 px-2 py-1 rounded text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
        >
          <RefreshCw size={11} />
          Fetch
        </button>
        <button
          onClick={handlePull}
          title="Pull current branch"
          className="flex items-center gap-1 px-2 py-1 rounded text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
        >
          <GitMerge size={11} />
          Pull
        </button>
        <button
          onClick={() => setShowNewBranchInput((v) => !v)}
          title="New branch"
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded transition-colors",
            showNewBranchInput
              ? "text-accent-primary bg-accent-primary/10"
              : "text-text-secondary hover:bg-bg-raised hover:text-text-primary"
          )}
        >
          <Plus size={11} />
          Branch
        </button>
      </div>

      {/* New branch input */}
      {showNewBranchInput && (
        <div className="px-2 py-1.5 border-b border-border-default">
          <input
            autoFocus
            type="text"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateBranch();
              if (e.key === "Escape") setShowNewBranchInput(false);
            }}
            placeholder={`from ${currentBranch}`}
            className="w-full bg-bg-surface border border-border-default rounded px-2 py-1 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent-primary"
            disabled={newBranchLoading}
          />
        </div>
      )}

      {/* Branch list */}
      {(branches ?? []).map((b) => (
        <div
          key={b}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 cursor-default",
            b === currentBranch
              ? "text-accent-primary bg-accent-primary/10"
              : "text-text-secondary hover:bg-bg-raised hover:text-text-primary"
          )}
        >
          <GitBranch size={10} className="shrink-0" />
          <span className="truncate">{b}</span>
        </div>
      ))}
      {(branches?.length ?? 0) === 0 && (
        <div className="px-3 py-2 text-text-muted">No branches</div>
      )}
    </div>
  );
}

// ─── Project Dropdown ─────────────────────────────────────────────────────────

function ProjectDropdown({
  projects,
  activeProjectId,
  onSelect,
  onClose,
}: {
  projects: Project[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const pickFolder = useProjectsStore((s) => s.addAndActivateProject);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const open = projects.filter((p) => !p.isWorktree);
  const recent = projects.filter((p) => p.isWorktree);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-50 w-72 bg-bg-overlay border border-border-default rounded shadow-lg py-1 text-xs"
    >
      {/* Actions */}
      <button
        onClick={() => {
          pickFolderFn().then((path) => {
            if (path) {
              pickFolder(path);
              onClose();
            }
          });
        }}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
      >
        <FolderOpen size={11} className="shrink-0" />
        Open…
      </button>
      <button
        className="flex items-center gap-2 w-full px-3 py-1.5 text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors"
        onClick={onClose}
      >
        <Plus size={11} className="shrink-0" />
        New Project…
      </button>

      {/* Open projects */}
      {open.length > 0 && (
        <>
          <div className="px-3 py-1 mt-1 text-[9px] font-semibold tracking-wider text-text-muted uppercase border-t border-border-default">
            Open Projects
          </div>
          {open.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); onClose(); }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 transition-colors text-left",
                p.id === activeProjectId
                  ? "text-accent-primary bg-accent-primary/10"
                  : "text-text-secondary hover:bg-bg-raised hover:text-text-primary"
              )}
            >
              <ProjectAvatar name={p.name} size={14} />
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{p.name}</span>
                <span className="text-[9px] text-text-muted truncate">{p.path}</span>
              </div>
            </button>
          ))}
        </>
      )}

      {/* Recent (worktrees shown as "recent" in this context) */}
      {recent.length > 0 && (
        <>
          <div className="px-3 py-1 mt-1 text-[9px] font-semibold tracking-wider text-text-muted uppercase border-t border-border-default">
            Worktrees
          </div>
          {recent.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); onClose(); }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 transition-colors text-left",
                p.id === activeProjectId
                  ? "text-accent-primary bg-accent-primary/10"
                  : "text-text-secondary hover:bg-bg-raised hover:text-text-primary"
              )}
            >
              <ProjectAvatar name={p.name} size={14} />
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{p.name}</span>
                <span className="text-[9px] text-text-muted truncate">{p.path}</span>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

// ─── TitleBar ─────────────────────────────────────────────────────────────────

function TitleBarComponent() {
  const ui = useUIStore();
  const { openTabs, activeTabId } = useActiveProjectTabs();
  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const setActiveProject = useProjectsStore((s) => s.setActiveProject);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const activeProjectDir = activeProject?.path ?? null;
  const { data: currentBranch } = useGitCurrentBranch(activeProjectDir ?? "");

  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);

  const handleBranchClose = useCallback(() => setBranchDropdownOpen(false), []);
  const handleProjectClose = useCallback(() => setProjectDropdownOpen(false), []);

  // Current tab label for breadcrumb (only shown in the center/drag region)
  const tabLabel = activeTab ? activeTab.title : null;

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch {
      // not in Tauri context
    }
  };

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const isMaximized = await win.isMaximized();
      if (isMaximized) {
        await win.unmaximize();
      } else {
        await win.maximize();
      }
    } catch {
      // not in Tauri context
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch {
      // not in Tauri context
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between",
        "h-9 bg-bg-surface border-b border-border-default",
        "select-none shrink-0"
      )}
      data-tauri-drag-region
    >
      {/* Left: Project chip + Branch chip */}
      <div className="flex items-center gap-1 pl-2 shrink-0">
        {/* Project chip */}
        <div className="relative">
          <button
            onClick={() => {
              setProjectDropdownOpen((o) => !o);
              setBranchDropdownOpen(false);
            }}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
              projectDropdownOpen
                ? "bg-bg-overlay text-text-primary"
                : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary"
            )}
          >
            {activeProject ? (
              <>
                <ProjectAvatar name={activeProject.name} size={14} />
                <span className="font-medium max-w-32 truncate">{activeProject.name}</span>
              </>
            ) : (
              <>
                <div className="w-3.5 h-3.5 rounded-sm bg-accent-primary/60" />
                <span className="font-semibold text-accent-secondary">The Associate Studio</span>
              </>
            )}
            <ChevronDown size={10} className="shrink-0 text-text-muted" />
          </button>
          {projectDropdownOpen && (
            <ProjectDropdown
              projects={projects}
              activeProjectId={activeProjectId}
              onSelect={setActiveProject}
              onClose={handleProjectClose}
            />
          )}
        </div>

        {/* Branch chip */}
        {activeProjectDir && (
          <div className="relative">
            <button
              onClick={() => {
                setBranchDropdownOpen((o) => !o);
                setProjectDropdownOpen(false);
              }}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                branchDropdownOpen
                  ? "bg-bg-overlay text-text-primary"
                  : "text-text-muted hover:bg-bg-overlay hover:text-text-secondary"
              )}
            >
              <GitBranch size={11} className="shrink-0" />
              <span className="max-w-28 truncate">{currentBranch ?? "…"}</span>
              <ChevronDown size={10} className="shrink-0" />
            </button>
            {branchDropdownOpen && (
              <BranchDropdown
                cwd={activeProjectDir}
                currentBranch={currentBranch ?? ""}
                onClose={handleBranchClose}
              />
            )}
          </div>
        )}
      </div>

      {/* Center: draggable + tab label */}
      <div className="flex flex-1 items-center justify-center" data-tauri-drag-region>
        {tabLabel && (
          <span className="text-text-muted text-xs pointer-events-none truncate max-w-64">
            {tabLabel}
          </span>
        )}
      </div>

      {/* Right: Neural Field + NotificationBell + Window controls */}
      <div className="flex items-center h-full shrink-0">
        <div className="flex items-center px-1 gap-1">
          <button
            onClick={() => ui.toggleNeuralField()}
            title="Neural Field (Ctrl+Shift+Space)"
            className="flex items-center justify-center w-7 h-7 rounded text-text-muted hover:text-accent-primary hover:bg-bg-overlay transition-colors"
          >
            <Radar size={14} />
          </button>
          <NotificationBell />
        </div>
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-12 h-full text-text-secondary hover:bg-bg-overlay transition-colors"
          aria-label="Minimize"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-12 h-full text-text-secondary hover:bg-bg-overlay transition-colors"
          aria-label="Maximize"
        >
          <Square size={14} />
        </button>
        <button
          onClick={handleClose}
          className="flex items-center justify-center w-12 h-full text-text-secondary hover:bg-status-error hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export const TitleBar = memo(TitleBarComponent);
