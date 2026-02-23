import { useState } from "react";
import {
  GitBranch, GitFork, RefreshCw, ChevronRight, ChevronDown,
  Loader2, AlertTriangle, Plus, X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGitStatus, useGitBranches, useGitCurrentBranch, useWorktrees, useWorktreeCopy } from "@/hooks/useClaudeData";
import { useProjectsStore, pathToProjectId } from "@/stores/projectsStore";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { GitFileEntry } from "@/lib/tauri";
import { createWorktree, setWorktreeCopy } from "@/lib/tauri";
import { cn } from "@/lib/utils";

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
  const queryClient = useQueryClient();

  // File section collapse state
  const [stagedOpen, setStaggedOpen] = useState(true);
  const [unstagedOpen, setUnstagedOpen] = useState(true);
  const [untrackedOpen, setUntrackedOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Worktree creation form state
  const [showWorktreeForm, setShowWorktreeForm] = useState(false);
  const [worktreeBranch, setWorktreeBranch] = useState("");
  const [worktreeLoading, setWorktreeLoading] = useState(false);
  const [worktreeError, setWorktreeError] = useState<string | null>(null);

  // Collapsible sections
  const [worktreesOpen, setWorktreesOpen] = useState(true);
  const [copyOpen, setCopyOpen] = useState(true);

  // Copy-on-create inline input state
  const [showCopyInput, setShowCopyInput] = useState(false);
  const [copyInputValue, setCopyInputValue] = useState("");
  const [copyMutating, setCopyMutating] = useState(false);

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

  const handleOpenWorktreeForm = () => {
    setWorktreeBranch(`feature/${currentBranch}-wt`);
    setWorktreeError(null);
    setShowWorktreeForm(true);
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
      // Refresh worktree list
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
      setSelectedDiffFile({
        cwd: activeProjectDir!,
        path: file.path,
        staged: file.section === "Staged",
      });
      setBottomTab("git");
      if (!bottomPanelOpen) toggleBottomPanel();
    }
  };

  const handleAddCopyEntry = async () => {
    const value = copyInputValue.trim();
    if (!value || !activeProjectDir) return;
    const current = copyEntries ?? [];
    if (current.includes(value)) {
      setShowCopyInput(false);
      setCopyInputValue("");
      return;
    }
    setCopyMutating(true);
    try {
      await setWorktreeCopy(activeProjectDir, [...current, value]);
      queryClient.invalidateQueries({ queryKey: ["worktreeCopy", activeProjectDir] });
      setShowCopyInput(false);
      setCopyInputValue("");
    } catch (e) {
      console.error("[worktree-copy] set failed:", e);
    } finally {
      setCopyMutating(false);
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
          onClick={handleOpenWorktreeForm}
          className="text-text-muted hover:text-accent-primary transition-colors"
          title="Create worktree"
        >
          <GitFork size={12} />
        </button>
        <button
          onClick={() => refetch()}
          className="text-text-muted hover:text-text-primary transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      </div>

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
                  {isChildWorktree ? "No files were copied" : "No files — hover a file in the browser to add"}
                </div>
              )}

              {/* Add input — only on main worktree */}
              {!isChildWorktree && (
                showCopyInput ? (
                  <div className="flex items-center gap-1 px-3 py-1">
                    <input
                      type="text"
                      value={copyInputValue}
                      onChange={(e) => setCopyInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddCopyEntry();
                        if (e.key === "Escape") {
                          setShowCopyInput(false);
                          setCopyInputValue("");
                        }
                      }}
                      placeholder="relative path, e.g. .env"
                      className="flex-1 min-w-0 px-1.5 py-0.5 text-[10px] bg-bg-base border border-border-default rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-border-focus"
                      autoFocus
                    />
                    <button
                      onClick={handleAddCopyEntry}
                      disabled={copyMutating || !copyInputValue.trim()}
                      className="px-1.5 py-0.5 text-[10px] bg-accent-primary text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowCopyInput(false);
                        setCopyInputValue("");
                      }}
                      className="text-text-muted hover:text-text-primary transition-colors shrink-0"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCopyInput(true)}
                    className="flex items-center gap-1 px-4 py-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <Plus size={10} />
                    Add path
                  </button>
                )
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
              />
            )}
          </div>
        )}
      </div>
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
}

function FileSection({ title, count, open, onToggle, files, onFileClick, selectedFile }: FileSectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileEntry({ file, onClick, isSelected }: { file: GitFileEntry; onClick: () => void; isSelected: boolean }) {
  const statusColor = getStatusColor(file.statusChar);
  const filename = file.path.split(/[/\\]/).pop() ?? file.path;
  const dir = file.path.includes("/") || file.path.includes("\\")
    ? file.path.substring(0, file.path.lastIndexOf(file.path.includes("/") ? "/" : "\\"))
    : "";

  return (
    <button
      onClick={onClick}
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
