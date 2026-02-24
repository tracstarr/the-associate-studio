import { memo, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Minus, Square, X, ChevronDown, ChevronRight, GitBranch, FolderOpen, Folder, Plus, RefreshCw, GitMerge, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveProjectTabs } from "@/hooks/useActiveProjectTabs";
import { useProjectsStore } from "@/stores/projectsStore";
import { useGitCurrentBranch, useGitBranches, useGitRemoteBranches } from "@/hooks/useClaudeData";
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
      className="inline-flex items-center justify-center rounded-md font-bold shrink-0"
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

// ─── Branch Tree Utilities ───────────────────────────────────────────────────

interface BranchTreeNode {
  name: string;
  fullPath: string;
  children: Map<string, BranchTreeNode>;
}

function buildBranchTree(branches: string[]): BranchTreeNode {
  const root: BranchTreeNode = { name: "", fullPath: "", children: new Map() };
  for (const branch of branches) {
    const parts = branch.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          fullPath: parts.slice(0, i + 1).join("/"),
          children: new Map(),
        });
      }
      node = node.children.get(part)!;
    }
  }
  return root;
}

function BranchTreeNodeRow({
  node,
  currentBranch,
  depth,
  expandedFolders,
  toggleFolder,
}: {
  node: BranchTreeNode;
  currentBranch: string;
  depth: number;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
}) {
  const isLeaf = node.children.size === 0;
  const isExpanded = expandedFolders.has(node.fullPath);

  if (isLeaf) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 py-1 cursor-default",
          node.fullPath === currentBranch
            ? "text-accent-primary bg-accent-primary/10"
            : "text-text-secondary hover:bg-bg-raised hover:text-text-primary"
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <GitBranch size={10} className="shrink-0" />
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
    const aIsFolder = a.children.size > 0;
    const bIsFolder = b.children.size > 0;
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <button
        onClick={() => toggleFolder(node.fullPath)}
        className="flex items-center gap-1.5 py-1 w-full text-left text-text-muted hover:bg-bg-raised hover:text-text-secondary transition-colors"
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {isExpanded ? (
          <ChevronDown size={10} className="shrink-0" />
        ) : (
          <ChevronRight size={10} className="shrink-0" />
        )}
        <Folder size={10} className="shrink-0" />
        <span className="truncate">{node.name}</span>
        <span className="text-text-muted text-[9px] ml-auto pr-2">{countLeaves(node)}</span>
      </button>
      {isExpanded &&
        sortedChildren.map((child) => (
          <BranchTreeNodeRow
            key={child.fullPath}
            node={child}
            currentBranch={currentBranch}
            depth={depth + 1}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
          />
        ))}
    </>
  );
}

function countLeaves(node: BranchTreeNode): number {
  if (node.children.size === 0) return 1;
  let count = 0;
  for (const child of node.children.values()) {
    count += countLeaves(child);
  }
  return count;
}

// ─── Branch Dropdown ─────────────────────────────────────────────────────────

function BranchDropdown({
  cwd,
  currentBranch,
  onClose,
  toggleRef,
}: {
  cwd: string;
  currentBranch: string;
  onClose: () => void;
  toggleRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { data: branches } = useGitBranches(cwd);
  const { data: remoteBranches } = useGitRemoteBranches(cwd);
  const ref = useRef<HTMLDivElement>(null);
  const runGitAction = useGitAction();
  const queryClient = useQueryClient();
  const [showNewBranchInput, setShowNewBranchInput] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchLoading, setNewBranchLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Auto-expand the folder containing the current branch
    const expanded = new Set<string>();
    if (currentBranch) {
      const parts = currentBranch.split("/");
      for (let i = 1; i < parts.length; i++) {
        expanded.add(parts.slice(0, i).join("/"));
      }
    }
    return expanded;
  });

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const localBranchSet = useMemo(
    () => new Set(branches ?? []),
    [branches]
  );

  const remoteOnlyBranches = useMemo(() => {
    if (!remoteBranches) return [];
    return remoteBranches.filter((rb) => !localBranchSet.has(rb.branch));
  }, [remoteBranches, localBranchSet]);

  const localTree = useMemo(
    () => buildBranchTree(branches ?? []),
    [branches]
  );

  const remoteTree = useMemo(
    () => buildBranchTree(remoteOnlyBranches.map((rb) => rb.fullRef)),
    [remoteOnlyBranches]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (toggleRef.current?.contains(target)) return;
      if (ref.current && !ref.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, toggleRef]);

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

  const sortedLocalChildren = Array.from(localTree.children.values()).sort((a, b) => {
    const aIsFolder = a.children.size > 0;
    const bIsFolder = b.children.size > 0;
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const sortedRemoteChildren = Array.from(remoteTree.children.values()).sort((a, b) => {
    const aIsFolder = a.children.size > 0;
    const bIsFolder = b.children.size > 0;
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      ref={ref}
      className="panel-card-overlay absolute left-0 top-full mt-2 z-50 min-w-60 max-w-80 py-1.5 text-xs"
    >
      {/* Action toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border-muted mx-1">
        <button
          onClick={handleFetch}
          title="Fetch all remotes"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-all duration-200"
        >
          <RefreshCw size={11} />
          Fetch
        </button>
        <button
          onClick={handlePull}
          title="Pull current branch"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-all duration-200"
        >
          <GitMerge size={11} />
          Pull
        </button>
        <button
          onClick={() => setShowNewBranchInput((v) => !v)}
          title="New branch"
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all duration-200",
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
        <div className="px-2.5 py-2 border-b border-border-muted mx-1">
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
            className="w-full bg-bg-input border border-border-muted rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent-primary transition-colors"
            disabled={newBranchLoading}
          />
        </div>
      )}

      {/* Scrollable branch tree */}
      <div className="max-h-72 overflow-y-auto">
        {/* Local branches */}
        <div className="px-3 py-1 mt-0.5 text-[9px] font-semibold tracking-wider text-text-muted uppercase">
          Local
        </div>
        {sortedLocalChildren.length > 0 ? (
          sortedLocalChildren.map((child) =>
            child.children.size > 0 ? (
              <BranchTreeNodeRow
                key={child.fullPath}
                node={child}
                currentBranch={currentBranch}
                depth={0}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
              />
            ) : (
              <div
                key={child.fullPath}
                className={cn(
                  "flex items-center gap-1.5 py-1 mx-1 rounded-lg cursor-default transition-all duration-150",
                  child.fullPath === currentBranch
                    ? "text-accent-primary bg-accent-primary/10"
                    : "text-text-secondary hover:bg-bg-raised hover:text-text-primary"
                )}
                style={{ paddingLeft: 8 }}
              >
                <GitBranch size={10} className="shrink-0" />
                <span className="truncate">{child.name}</span>
              </div>
            )
          )
        ) : (
          <div className="px-3 py-1.5 text-text-muted">No local branches</div>
        )}

        {/* Remote-only branches */}
        {sortedRemoteChildren.length > 0 && (
          <>
            <div className="px-3 py-1 mt-1 text-[9px] font-semibold tracking-wider text-text-muted uppercase border-t border-border-muted">
              Remote
            </div>
            {sortedRemoteChildren.map((child) =>
              child.children.size > 0 ? (
                <BranchTreeNodeRow
                  key={`remote-${child.fullPath}`}
                  node={child}
                  currentBranch={currentBranch}
                  depth={0}
                  expandedFolders={expandedFolders}
                  toggleFolder={toggleFolder}
                />
              ) : (
                <div
                  key={`remote-${child.fullPath}`}
                  className="flex items-center gap-1.5 py-1 mx-1 rounded-lg cursor-default text-text-muted hover:bg-bg-raised hover:text-text-secondary transition-all duration-150"
                  style={{ paddingLeft: 8 }}
                >
                  <GitBranch size={10} className="shrink-0" />
                  <span className="truncate">{child.name}</span>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Project Dropdown ─────────────────────────────────────────────────────────

function ProjectDropdown({
  projects,
  activeProjectId,
  onSelect,
  onClose,
  toggleRef,
}: {
  projects: Project[];
  activeProjectId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  toggleRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const pickFolder = useProjectsStore((s) => s.addAndActivateProject);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (toggleRef.current?.contains(target)) return;
      if (ref.current && !ref.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, toggleRef]);

  const open = projects.filter((p) => !p.isWorktree);
  const recent = projects.filter((p) => p.isWorktree);

  return (
    <div
      ref={ref}
      className="panel-card-overlay absolute left-0 top-full mt-2 z-50 w-72 py-1.5 text-xs"
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
        className="flex items-center gap-2 w-full px-3 py-2 mx-0 rounded-lg text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-all duration-200"
      >
        <FolderOpen size={11} className="shrink-0" />
        Open…
      </button>
      <button
        onClick={() => {
          pickFolderFn().then((path) => {
            if (path) {
              pickFolder(path);
              onClose();
            }
          });
        }}
        className="flex items-center gap-2 w-full px-3 py-2 mx-0 rounded-lg text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-all duration-200"
      >
        <Plus size={11} className="shrink-0" />
        New Project…
      </button>

      {/* Open projects */}
      {open.length > 0 && (
        <>
          <div className="px-3 py-1.5 mt-1 text-[9px] font-semibold tracking-wider text-text-muted uppercase border-t border-border-muted mx-2">
            Open Projects
          </div>
          {open.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); onClose(); }}
              className={cn(
                "flex items-center gap-2 w-[calc(100%-8px)] mx-1 px-3 py-2 rounded-lg transition-all duration-200 text-left",
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
          <div className="px-3 py-1.5 mt-1 text-[9px] font-semibold tracking-wider text-text-muted uppercase border-t border-border-muted mx-2">
            Worktrees
          </div>
          {recent.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); onClose(); }}
              className={cn(
                "flex items-center gap-2 w-[calc(100%-8px)] mx-1 px-3 py-2 rounded-lg transition-all duration-200 text-left",
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
  const projectBtnRef = useRef<HTMLButtonElement>(null);
  const branchBtnRef = useRef<HTMLButtonElement>(null);

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
        "h-10 bg-bg-surface",
        "select-none shrink-0"
      )}
      data-tauri-drag-region
    >
      {/* Left: Project chip + Branch chip */}
      <div className="flex items-center gap-1.5 pl-3 shrink-0">
        {/* Project chip */}
        <div className="relative">
          <button
            ref={projectBtnRef}
            onClick={() => {
              setProjectDropdownOpen((o) => !o);
              setBranchDropdownOpen(false);
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200",
              projectDropdownOpen
                ? "bg-bg-overlay text-text-primary"
                : "text-text-secondary hover:bg-bg-raised hover:text-text-primary"
            )}
          >
            {activeProject ? (
              <>
                <ProjectAvatar name={activeProject.name} size={14} />
                <span className="font-medium max-w-32 truncate">{activeProject.name}</span>
              </>
            ) : (
              <>
                <div className="w-3.5 h-3.5 rounded-md bg-accent-primary/60" />
                <span className="font-semibold text-accent-primary">The Associate Studio</span>
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
              toggleRef={projectBtnRef}
            />
          )}
        </div>

        {/* Branch chip */}
        {activeProjectDir && (
          <div className="relative">
            <button
              ref={branchBtnRef}
              onClick={() => {
                setBranchDropdownOpen((o) => !o);
                setProjectDropdownOpen(false);
              }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200",
                branchDropdownOpen
                  ? "bg-bg-overlay text-text-primary"
                  : "text-text-muted hover:bg-bg-raised hover:text-text-secondary"
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
                toggleRef={branchBtnRef}
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
            className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-accent-primary hover:bg-bg-raised transition-all duration-200"
          >
            <Radar size={14} />
          </button>
          <NotificationBell />
        </div>
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-12 h-full text-text-muted hover:bg-bg-raised hover:text-text-primary transition-all duration-200"
          aria-label="Minimize"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-12 h-full text-text-muted hover:bg-bg-raised hover:text-text-primary transition-all duration-200"
          aria-label="Maximize"
        >
          <Square size={14} />
        </button>
        <button
          onClick={handleClose}
          className="flex items-center justify-center w-12 h-full text-text-muted hover:bg-status-error hover:text-white transition-all duration-200 rounded-tr-xl"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export const TitleBar = memo(TitleBarComponent);
