import { useState, useEffect } from "react";
import {
  GitBranch, GitFork, RefreshCw, ChevronRight, ChevronDown,
  Loader2, AlertTriangle, X, GitCommitHorizontal, Upload, GitPullRequest, FolderSearch,
  GitMerge, Plus,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGitStatus, useGitBranches, useGitCurrentBranch, useWorktrees, useWorktreeCopy } from "@/hooks/useClaudeData";
import { useProjectsStore } from "@/stores/projectsStore";
import { pathToProjectId } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useOutputStore } from "@/stores/outputStore";
import { useGitAction } from "@/hooks/useGitAction";
import type { GitFileEntry, FileEntry } from "@/lib/tauri";
import { createWorktree, setWorktreeCopy, claudeGitAction, listDir, gitPull, gitCreateBranch } from "@/lib/tauri";
import { UntrackedContextMenu } from "./UntrackedContextMenu";
import { cn } from "@/lib/utils";
import { FileTreeNode } from "@/components/files/FileTreeNode";

export function GitStatusPanel() {
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const addAndActivateProject = useProjectsStore((s) => s.addAndActivateProject);
  const setActiveProject = useProjectsStore((s) => s.setActiveProject);
  const openTab = useSessionStore((s) => s.openTab);
  const setSelectedDiffFile = useUIStore((s) => s.setSelectedDiffFile);
  const setBottomTab = useUIStore((s) => s.setBottomTab);
  const bottomPanelOpen = useUIStore((s) => s.bottomPanelOpen);
  const toggleBottomPanel = useUIStore((s) => s.toggleBottomPanel);
  const addMessage = useOutputStore((s) => s.addMessage);
  const queryClient = useQueryClient();
  const runGitAction = useGitAction();

  // File section collapse state
  const [stagedOpen, setStaggedOpen] = useState(true);
  const [unstagedOpen, setUnstagedOpen] = useState(true);
  const [untrackedOpen, setUntrackedOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Untracked context menu state
  const [fileContextMenu, setFileContextMenu] = useState<{
    x: number;
    y: number;
    file: GitFileEntry | null;
  } | null>(null);

  // Worktree creation form state
  const [showWorktreeForm, setShowWorktreeForm] = useState(false);
  const [worktreeBranch, setWorktreeBranch] = useState("");
  const [worktreeLoading, setWorktreeLoading] = useState(false);
  const [worktreeError, setWorktreeError] = useState<string | null>(null);

  // New branch form state
  const [showNewBranchForm, setShowNewBranchForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchLoading, setNewBranchLoading] = useState(false);
  const [newBranchError, setNewBranchError] = useState<string | null>(null);

  // Collapsible sections
  const [worktreesOpen, setWorktreesOpen] = useState(true);
  const [copyOpen, setCopyOpen] = useState(true);

  // Quick git action state
  const [gitActionLoading, setGitActionLoading] = useState<string | null>(null);
  const [gitActionResult, setGitActionResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // File picker state for Copy on create
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [pickerRootEntries, setPickerRootEntries] = useState<FileEntry[]>([]);
  const [pickerExpandedDirs, setPickerExpandedDirs] = useState<Set<string>>(new Set());
  const [pickerDirContents, setPickerDirContents] = useState<Record<string, FileEntry[]>>({});
  const [pickerLoading, setPickerLoading] = useState(false);

  // Reset picker when project changes
  useEffect(() => {
    setShowFilePicker(false);
    setPickerRootEntries([]);
    setPickerExpandedDirs(new Set());
    setPickerDirContents({});
  }, [activeProjectDir]);

  const { data: gitStatus, isLoading, refetch } = useGitStatus(activeProjectDir ?? "");
  const { data: branches } = useGitBranches(activeProjectDir ?? "");
  const { data: currentBranchData } = useGitCurrentBranch(activeProjectDir ?? "");
  const { data: worktrees } = useWorktrees(activeProjectDir ?? "");
  const { data: copyEntries } = useWorktreeCopy(activeProjectDir ?? "");

  const currentBranch = currentBranchData ?? branches?.[0] ?? "main";

  // Find the currently active worktree entry to highlight it
  const activeWorktreePath = activeProjectDir ?? "";

  // True when the active project is a non-main (child) worktree
  const isChildWorktree = worktrees
    ? worktrees.some(
        (wt) =>
          (wt.path === activeWorktreePath ||
            wt.path.replace(/\\/g, "/") === activeWorktreePath.replace(/\\/g, "/")) &&
          !wt.isMain
      )
    : false;

  const handleGitAction = async (action: "commit" | "commit_push" | "commit_push_pr") => {
    if (!activeProjectDir || gitActionLoading) return;
    setGitActionLoading(action);
    setGitActionResult(null);
    const label = action === "commit" ? "git commit" : action === "commit_push" ? "git commit+push" : "git commit+push+pr";
    addMessage("info", `Running: ${label}…`, label);
    setBottomTab("output");
    if (!bottomPanelOpen) toggleBottomPanel();
    try {
      const result = await claudeGitAction(activeProjectDir, action);
      setGitActionResult({ ok: true, msg: result || "Done" });
      addMessage("success", result || "Done", label);
      queryClient.invalidateQueries({ queryKey: ["git-status", activeProjectDir] });
    } catch (e) {
      setGitActionResult({ ok: false, msg: String(e) });
      addMessage("error", String(e), label);
    } finally {
      setGitActionLoading(null);
    }
  };

  const handlePull = async () => {
    if (!activeProjectDir) return;
    await runGitAction("git pull", () => gitPull(activeProjectDir));
    queryClient.invalidateQueries({ queryKey: ["git-status", activeProjectDir] });
    queryClient.invalidateQueries({ queryKey: ["gitCurrentBranch", activeProjectDir] });
  };

  const handleOpenNewBranchForm = () => {
    setNewBranchName("");
    setNewBranchError(null);
    setShowNewBranchForm(true);
    setShowWorktreeForm(false);
  };

  const handleCreateNewBranch = async () => {
    if (!activeProjectDir || !newBranchName.trim()) return;
    setNewBranchLoading(true);
    setNewBranchError(null);
    try {
      await runGitAction(
        `git create branch ${newBranchName.trim()}`,
        () => gitCreateBranch(activeProjectDir, newBranchName.trim(), currentBranch)
      );
      queryClient.invalidateQueries({ queryKey: ["gitBranches", activeProjectDir] });
      queryClient.invalidateQueries({ queryKey: ["gitCurrentBranch", activeProjectDir] });
      setShowNewBranchForm(false);
    } catch (e) {
      setNewBranchError(String(e));
    } finally {
      setNewBranchLoading(false);
    }
  };

  const handleOpenWorktreeForm = () => {
    setWorktreeBranch(`feature/${currentBranch}-wt`);
    setWorktreeError(null);
    setShowWorktreeForm(true);
    setShowNewBranchForm(false);
  };

  const handleCreateWorktree = async () => {
    if (!activeProjectDir || !worktreeBranch.trim()) return;
    setWorktreeLoading(true);
    setWorktreeError(null);
    try {
      const worktreePath = await createWorktree(activeProjectDir, worktreeBranch.trim());
      const newProjectId = pathToProjectId(worktreePath);
      addAndActivateProject(worktreePath);
      openTab(
        {
          id: `session-${Date.now()}`,
          title: "New Session",
          projectDir: worktreePath,
          spawnedAt: Date.now(),
        },
        newProjectId
      );
      setShowWorktreeForm(false);
      queryClient.invalidateQueries({ queryKey: ["worktrees", activeProjectDir] });
    } catch (e) {
      setWorktreeError(String(e));
    } finally {
      setWorktreeLoading(false);
    }
  };

  const handleSwitchToWorktree = (worktreePath: string) => {
    const projectId = pathToProjectId(worktreePath);
    addAndActivateProject(worktreePath);
    setActiveProject(projectId);
  };

  const handleFileClick = (file: GitFileEntry) => {
    setSelectedFile(file.path);

    if (activeProjectId && activeProjectDir) {
      const staged = file.section === "Staged";
      const filename = file.path.split(/[/\\]/).pop() ?? file.path;
      const prefix = staged ? "\u2295" : "\u00B1";
      const tabId = `diff:${file.path}:${staged ? "staged" : "unstaged"}`;
      openTab(
        {
          id: tabId,
          type: "diff",
          title: `${prefix} ${filename}`,
          diffPath: file.path,
          diffStaged: staged,
          projectDir: activeProjectDir,
        },
        activeProjectId
      );
    } else {
      if (!activeProjectDir) return;
      setSelectedDiffFile({
        cwd: activeProjectDir,
        path: file.path,
        staged: file.section === "Staged",
      });
      setBottomTab("git");
      if (!bottomPanelOpen) toggleBottomPanel();
    }
  };

  const handleAddCopyEntry = async (relativePath: string) => {
    if (!relativePath || !activeProjectDir) return;
    const current = copyEntries ?? [];
    if (current.includes(relativePath)) return;
    try {
      await setWorktreeCopy(activeProjectDir, [...current, relativePath]);
      queryClient.invalidateQueries({ queryKey: ["worktreeCopy", activeProjectDir] });
    } catch (e) {
      console.error("[worktree-copy] set failed:", e);
    }
  };

  const handlePickerAddFile = async (absolutePath: string) => {
    if (!activeProjectDir) return;
    const sep = absolutePath.includes("\\") ? "\\" : "/";
    const projectRoot = activeProjectDir.replace(/\\/g, sep);
    const normalized = absolutePath.replace(/\\/g, sep);
    const relativePath = normalized.startsWith(projectRoot)
      ? normalized.slice(projectRoot.length).replace(/^[/\\]/, "")
      : absolutePath;
    await handleAddCopyEntry(relativePath);
  };

  const handlePickerToggle = async (path: string) => {
    setPickerExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
    if (!pickerDirContents[path]) {
      try {
        const entries = await listDir(path);
        setPickerDirContents((prev) => ({ ...prev, [path]: entries }));
      } catch (e) {
        console.error("[picker] load dir failed:", e);
      }
    }
  };

  const handleOpenPicker = async () => {
    setShowFilePicker(true);
    if (pickerRootEntries.length === 0 && activeProjectDir) {
      setPickerLoading(true);
      try {
        const entries = await listDir(activeProjectDir);
        setPickerRootEntries(entries);
      } catch (e) {
        console.error("[picker] load root failed:", e);
      } finally {
        setPickerLoading(false);
      }
    }
  };

  const handleRemoveCopyEntry = async (entry: string) => {
    if (!activeProjectDir) return;
    const updated = (copyEntries ?? []).filter((e) => e !== entry);
    try {
      await setWorktreeCopy(activeProjectDir, updated);
      queryClient.invalidateQueries({ queryKey: ["worktreeCopy", activeProjectDir] });
    } catch (e) {
      console.error("[worktree-copy] remove failed:", e);
    }
  };

  const renderPickerEntries = (entries: FileEntry[], depth: number) => {
    return entries.map((entry) => (
      <div key={entry.path}>
        <FileTreeNode
          entry={entry}
          depth={depth}
          expanded={pickerExpandedDirs.has(entry.path)}
          onFileClick={() => handlePickerAddFile(entry.path)}
          onToggle={handlePickerToggle}
          onAddToCopyList={handlePickerAddFile}
        />
        {entry.is_dir && pickerExpandedDirs.has(entry.path) && pickerDirContents[entry.path] && (
          <div>{renderPickerEntries(pickerDirContents[entry.path], depth + 1)}</div>
        )}
      </div>
    ));
  };

  if (!activeProjectDir) {
    return (
      <div className="p-3 text-xs text-text-muted text-center">
        Open a project to see git status
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-3 text-xs text-text-muted">Loading...</div>;
  }

  const staged = gitStatus?.staged ?? [];
  const unstaged = gitStatus?.unstaged ?? [];
  const untracked = gitStatus?.untracked ?? [];
  const totalChanges = staged.length + unstaged.length + untracked.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Branch header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default">
        <GitBranch size={12} className="text-accent-primary shrink-0" />
        <span className="text-xs text-text-primary font-medium truncate flex-1">
          {currentBranch}
        </span>
        <button
          onClick={handlePull}
          className="text-text-muted hover:text-accent-primary transition-colors"
          title="Pull"
        >
          <GitMerge size={12} />
        </button>
        <button
          onClick={handleOpenNewBranchForm}
          className="text-text-muted hover:text-accent-primary transition-colors"
          title="New branch"
        >
          <Plus size={12} />
        </button>
        <button
          onClick={() => refetch()}
          className="text-text-muted hover:text-text-primary transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Quick commit actions */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border-default">
        {[
          { action: "commit" as const, label: "Commit", icon: GitCommitHorizontal },
          { action: "commit_push" as const, label: "+ Push", icon: Upload },
          { action: "commit_push_pr" as const, label: "+ PR", icon: GitPullRequest },
        ].map(({ action, label, icon: Icon }) => (
          <button
            key={action}
            onClick={() => handleGitAction(action)}
            disabled={!!gitActionLoading}
            title={action === "commit" ? "Commit all changes" : action === "commit_push" ? "Commit & push" : "Commit, push & create PR"}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border border-border-default text-text-muted hover:text-text-primary hover:border-border-focus disabled:opacity-50 transition-colors"
          >
            {gitActionLoading === action
              ? <Loader2 size={9} className="animate-spin" />
              : <Icon size={9} />}
            {label}
          </button>
        ))}
      </div>

      {/* Result message */}
      {gitActionResult && (
        <div className={cn(
          "px-3 py-1 text-[10px] border-b border-border-default",
          gitActionResult.ok ? "text-status-success" : "text-status-error"
        )}>
          {gitActionResult.msg.split("\n").slice(-3).join(" · ")}
          <button
            onClick={() => setGitActionResult(null)}
            className="ml-2 text-text-muted hover:text-text-primary"
          >
            ×
          </button>
        </div>
      )}

      {/* Inline new branch form */}
      {showNewBranchForm && (
        <div className="px-3 py-2 border-b border-border-default flex flex-col gap-1.5">
          <div className="text-[10px] text-text-muted">
            New branch from <span className="text-text-primary font-medium">{currentBranch}</span>:
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateNewBranch();
                if (e.key === "Escape") setShowNewBranchForm(false);
              }}
              placeholder="branch name"
              className="flex-1 min-w-0 px-2 py-1 text-xs bg-bg-base border border-border-default rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-border-focus"
              autoFocus
            />
            <button
              onClick={handleCreateNewBranch}
              disabled={newBranchLoading || !newBranchName.trim()}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-primary text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
            >
              {newBranchLoading ? <Loader2 size={10} className="animate-spin" /> : null}
              Create
            </button>
            <button
              onClick={() => setShowNewBranchForm(false)}
              className="px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors shrink-0"
            >
              Cancel
            </button>
          </div>
          {newBranchError && (
            <p className="text-[10px] text-status-error">{newBranchError}</p>
          )}
        </div>
      )}

      {/* Inline worktree creation form */}
      {showWorktreeForm && (
        <div className="px-3 py-2 border-b border-border-default flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={worktreeBranch}
              onChange={(e) => setWorktreeBranch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateWorktree();
                if (e.key === "Escape") setShowWorktreeForm(false);
              }}
              placeholder="branch name"
              className="flex-1 min-w-0 px-2 py-1 text-xs bg-bg-base border border-border-default rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-border-focus"
              autoFocus
            />
            <button
              onClick={handleCreateWorktree}
              disabled={worktreeLoading || !worktreeBranch.trim()}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-primary text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
            >
              {worktreeLoading ? <Loader2 size={10} className="animate-spin" /> : null}
              Create
            </button>
            <button
              onClick={() => setShowWorktreeForm(false)}
              className="px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors shrink-0"
            >
              Cancel
            </button>
          </div>
          {worktreeError && (
            <p className="text-[10px] text-status-error">{worktreeError}</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* ── Worktrees section ── */}
        {worktrees && worktrees.length > 0 && (
          <div className="border-b border-border-default">
            <button
              onClick={() => setWorktreesOpen((o) => !o)}
              className="flex items-center gap-1 w-full px-3 py-1.5 text-[10px] font-semibold tracking-wider text-text-muted hover:text-text-secondary uppercase"
            >
              {worktreesOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              Worktrees
              <span className="ml-auto font-normal normal-case">{worktrees.length}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenWorktreeForm(); }}
                className="ml-1 text-text-muted hover:text-accent-primary transition-colors"
                title="Create worktree"
              >
                <GitFork size={10} />
              </button>
            </button>
            {worktreesOpen && (
              <div className="pb-1">
                {worktrees.map((wt) => {
                  const isActive = wt.path === activeWorktreePath ||
                    wt.path.replace(/\\/g, "/") === activeWorktreePath.replace(/\\/g, "/");
                  return (
                    <div
                      key={wt.path}
                      className={cn(
                        "flex items-center gap-2 px-4 py-1 text-xs",
                        isActive ? "text-accent-primary" : "text-text-secondary"
                      )}
                    >
                      <GitFork size={10} className="shrink-0 text-text-muted" />
                      <span className={cn("truncate flex-1 font-medium", isActive && "text-accent-primary")}>
                        {wt.branch || wt.head}
                        {wt.isMain && (
                          <span className="ml-1 text-[9px] text-text-muted font-normal">(main)</span>
                        )}
                      </span>
                      {wt.isPrunable && (
                        <span title="Prunable — worktree directory may be missing" className="shrink-0">
                          <AlertTriangle size={10} className="text-status-warning" />
                        </span>
                      )}
                      {!isActive && (
                        <button
                          onClick={() => handleSwitchToWorktree(wt.path)}
                          className="shrink-0 text-text-muted hover:text-accent-primary transition-colors"
                          title={`Switch to ${wt.path}`}
                        >
                          <ChevronRight size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Copy on create (main) / Copied files (worktree) ── */}
        <div className="border-b border-border-default">
          <button
            onClick={() => setCopyOpen((o) => !o)}
            className="flex items-center gap-1 w-full px-3 py-1.5 text-[10px] font-semibold tracking-wider text-text-muted hover:text-text-secondary uppercase"
          >
            {copyOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {isChildWorktree ? "Copied files" : "Copy on create"}
            {copyEntries && copyEntries.length > 0 && (
              <span className="ml-auto font-normal normal-case">{copyEntries.length}</span>
            )}
          </button>
          {copyOpen && (
            <div className="pb-1">
              {copyEntries && copyEntries.length > 0 ? (
                copyEntries.map((entry) => (
                  <div
                    key={entry}
                    className="flex items-center gap-2 px-4 py-0.5 text-xs text-text-secondary group"
                  >
                    <span className="truncate flex-1 font-mono text-[10px]">{entry}</span>
                    {!isChildWorktree && (
                      <button
                        onClick={() => handleRemoveCopyEntry(entry)}
                        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-status-error transition-all shrink-0"
                        title="Remove"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-4 py-1 text-[10px] text-text-muted">
                  {isChildWorktree ? "No files were copied" : "No files — use Browse files to add"}
                </div>
              )}

              {/* Browse files picker — only on main worktree */}
              {!isChildWorktree && (
                <>
                  <button
                    onClick={showFilePicker ? () => setShowFilePicker(false) : handleOpenPicker}
                    className="flex items-center gap-1 px-4 py-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <FolderSearch size={10} />
                    {showFilePicker ? "Close picker" : "Browse files"}
                  </button>
                  {showFilePicker && (
                    <div className="border-t border-border-default max-h-[180px] overflow-y-auto">
                      {pickerLoading ? (
                        <div className="px-4 py-1 text-[10px] text-text-muted">Loading...</div>
                      ) : pickerRootEntries.length === 0 ? (
                        <div className="px-4 py-1 text-[10px] text-text-muted">No files found</div>
                      ) : (
                        renderPickerEntries(pickerRootEntries, 0)
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Changed files ── */}
        {totalChanges === 0 ? (
          <div className="p-3 text-xs text-text-muted text-center">
            No changes
          </div>
        ) : (
          <div>
            {staged.length > 0 && (
              <FileSection
                title="Staged"
                count={staged.length}
                open={stagedOpen}
                onToggle={() => setStaggedOpen(!stagedOpen)}
                files={staged}
                onFileClick={handleFileClick}
                selectedFile={selectedFile}
              />
            )}
            {unstaged.length > 0 && (
              <FileSection
                title="Changes"
                count={unstaged.length}
                open={unstagedOpen}
                onToggle={() => setUnstagedOpen(!unstagedOpen)}
                files={unstaged}
                onFileClick={handleFileClick}
                selectedFile={selectedFile}
              />
            )}
            {untracked.length > 0 && (
              <FileSection
                title="Untracked"
                count={untracked.length}
                open={untrackedOpen}
                onToggle={() => setUntrackedOpen(!untrackedOpen)}
                files={untracked}
                onFileClick={handleFileClick}
                selectedFile={selectedFile}
                onHeaderContextMenu={(e) => {
                  e.preventDefault();
                  setFileContextMenu({ x: e.clientX, y: e.clientY, file: null });
                }}
                onFileContextMenu={(e, file) => {
                  e.preventDefault();
                  setFileContextMenu({ x: e.clientX, y: e.clientY, file });
                }}
              />
            )}
          </div>
        )}
      </div>
      {fileContextMenu && (
        <UntrackedContextMenu
          x={fileContextMenu.x}
          y={fileContextMenu.y}
          cwd={activeProjectDir}
          file={fileContextMenu.file}
          onClose={() => setFileContextMenu(null)}
        />
      )}
    </div>
  );
}

interface FileSectionProps {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  files: GitFileEntry[];
  onFileClick: (file: GitFileEntry) => void;
  selectedFile: string | null;
  onHeaderContextMenu?: (e: React.MouseEvent) => void;
  onFileContextMenu?: (e: React.MouseEvent, file: GitFileEntry) => void;
}

function FileSection({ title, count, open, onToggle, files, onFileClick, selectedFile, onHeaderContextMenu, onFileContextMenu }: FileSectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        onContextMenu={onHeaderContextMenu}
        className="flex items-center gap-1 w-full px-3 py-1.5 text-[10px] font-semibold tracking-wider text-text-muted hover:text-text-secondary uppercase"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {title}
        <span className="ml-auto font-normal normal-case">{count}</span>
      </button>
      {open && (
        <div>
          {files.map((file) => (
            <FileEntry
              key={file.path}
              file={file}
              onClick={() => onFileClick(file)}
              isSelected={selectedFile === file.path}
              onContextMenu={onFileContextMenu ? (e) => onFileContextMenu(e, file) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileEntry({ file, onClick, isSelected, onContextMenu }: { file: GitFileEntry; onClick: () => void; isSelected: boolean; onContextMenu?: (e: React.MouseEvent) => void }) {
  const statusColor = getStatusColor(file.statusChar);
  const filename = file.path.split(/[/\\]/).pop() ?? file.path;
  const dir = file.path.includes("/") || file.path.includes("\\")
    ? file.path.substring(0, file.path.lastIndexOf(file.path.includes("/") ? "/" : "\\"))
    : "";

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "flex items-center gap-2 w-full px-4 py-1 text-xs text-left transition-colors",
        isSelected
          ? "bg-bg-raised text-text-primary"
          : "text-text-secondary hover:bg-bg-raised hover:text-text-primary"
      )}
    >
      <span className={cn("font-mono shrink-0 w-3", statusColor)}>
        {file.statusChar}
      </span>
      <span className="truncate flex-1">{filename}</span>
      {dir && (
        <span className="text-text-muted text-[10px] truncate max-w-20 shrink-0">
          {dir}
        </span>
      )}
    </button>
  );
}

function getStatusColor(char: string): string {
  switch (char) {
    case "M": return "text-yellow-400";
    case "A": return "text-status-success";
    case "D": return "text-status-error";
    case "R": return "text-blue-400";
    case "?": return "text-text-muted";
    default: return "text-text-secondary";
  }
}
