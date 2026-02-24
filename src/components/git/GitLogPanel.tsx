import { useState } from "react";
import { ChevronDown, ChevronRight, GitBranch, GitFork, Pin, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGitBranches, useGitCurrentBranch, useGitLog, useGitRemoteBranches } from "@/hooks/useClaudeData";
import { useProjectsStore } from "@/stores/projectsStore";
import { useGitAction } from "@/hooks/useGitAction";
import { gitCreateBranch } from "@/lib/tauri";
import { BranchContextMenu } from "@/components/git/BranchContextMenu";
import { cn } from "@/lib/utils";
import type { CommitInfo } from "@/lib/tauri";

// ─── Branch tree helpers ──────────────────────────────────────────────────────

function groupByPrefix(branches: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = { "": [] };
  for (const b of branches) {
    const slash = b.indexOf("/");
    if (slash !== -1) {
      const prefix = b.slice(0, slash);
      (groups[prefix] ??= []).push(b);
    } else {
      groups[""].push(b);
    }
  }
  return groups;
}

// ─── Ref badge ────────────────────────────────────────────────────────────────

function RefBadge({ label }: { label: string }) {
  const isRemote = label.includes("/");
  return (
    <span
      className={cn(
        "inline-flex items-center px-1 py-0 rounded text-[9px] font-mono leading-4 shrink-0",
        isRemote
          ? "bg-blue-900/60 text-blue-300 border border-blue-700/40"
          : "bg-green-900/60 text-green-300 border border-green-700/40"
      )}
    >
      {label}
    </span>
  );
}

// ─── Commit row ───────────────────────────────────────────────────────────────

function CommitRow({
  commit,
  selected,
  onClick,
}: {
  commit: CommitInfo;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-start gap-2 w-full px-3 py-1.5 text-left transition-colors group",
        selected
          ? "bg-bg-raised text-text-primary"
          : "text-text-secondary hover:bg-bg-raised hover:text-text-primary"
      )}
    >
      <span className="text-accent-primary shrink-0 mt-0.5 text-[10px]">●</span>
      <span className="font-mono text-[10px] text-text-muted shrink-0 w-14">{commit.hash}</span>
      <span className="flex-1 text-xs truncate">{commit.message}</span>
      {commit.refs.length > 0 && (
        <span className="flex gap-1 flex-wrap shrink-0 max-w-40">
          {commit.refs.slice(0, 3).map((r) => (
            <RefBadge key={r} label={r} />
          ))}
        </span>
      )}
      <span className="text-[10px] text-text-muted shrink-0 w-20 text-right truncate">
        {commit.author}
      </span>
      <span className="text-[10px] text-text-muted shrink-0 w-20 text-right truncate">
        {commit.date}
      </span>
    </button>
  );
}

// ─── Branch tree ─────────────────────────────────────────────────────────────

function BranchTree({
  cwd,
  localBranches,
  currentBranch,
  onBranchContextMenu,
}: {
  cwd: string;
  localBranches: string[];
  currentBranch: string;
  onBranchContextMenu: (e: React.MouseEvent, branchName: string) => void;
}) {
  const [localOpen, setLocalOpen] = useState(true);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const { data: remoteBranches } = useGitRemoteBranches(cwd);

  const grouped = groupByPrefix(localBranches);
  const flat = grouped[""] ?? [];
  const prefixed = Object.entries(grouped).filter(([k]) => k !== "");

  const remoteGroups: Record<string, string[]> = {};
  for (const rb of remoteBranches ?? []) {
    (remoteGroups[rb.remote] ??= []).push(rb.branch);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto text-xs">
      {/* HEAD */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-border-muted bg-accent-primary/10 cursor-context-menu"
        onContextMenu={(e) => onBranchContextMenu(e, currentBranch)}
      >
        <GitBranch size={11} className="text-accent-primary shrink-0" />
        <span className="text-accent-primary font-semibold truncate">{currentBranch}</span>
        <span className="text-[9px] text-text-muted ml-auto shrink-0">HEAD</span>
      </div>

      {/* Local branches */}
      <div>
        <button
          onClick={() => setLocalOpen((o) => !o)}
          className="flex items-center gap-1 w-full px-3 py-1.5 text-[10px] font-semibold tracking-wider text-text-muted hover:text-text-secondary uppercase"
        >
          {localOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          Local
          <span className="ml-auto font-normal normal-case">{localBranches.length}</span>
        </button>
        {localOpen && (
          <div>
            {flat.map((b) => (
              <BranchRow
                key={b}
                name={b}
                isCurrent={b === currentBranch}
                onContextMenu={onBranchContextMenu}
              />
            ))}
            {prefixed.map(([prefix, branches]) => (
              <PrefixGroup
                key={prefix}
                prefix={prefix}
                branches={branches}
                currentBranch={currentBranch}
                onContextMenu={onBranchContextMenu}
              />
            ))}
          </div>
        )}
      </div>

      {/* Remote branches */}
      {(remoteBranches?.length ?? 0) > 0 && (
        <div className="border-t border-border-muted">
          <button
            onClick={() => setRemoteOpen((o) => !o)}
            className="flex items-center gap-1 w-full px-3 py-1.5 text-[10px] font-semibold tracking-wider text-text-muted hover:text-text-secondary uppercase"
          >
            {remoteOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Remote
            <span className="ml-auto font-normal normal-case">{remoteBranches?.length}</span>
          </button>
          {remoteOpen &&
            Object.entries(remoteGroups).map(([remote, branches]) => (
              <RemoteGroup
                key={remote}
                remote={remote}
                branches={branches}
                onContextMenu={onBranchContextMenu}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function BranchRow({
  name,
  isCurrent,
  onContextMenu,
}: {
  name: string;
  isCurrent: boolean;
  onContextMenu: (e: React.MouseEvent, branchName: string) => void;
}) {
  const display = name.includes("/") ? name.split("/").pop() ?? name : name;
  return (
    <div
      className={cn(
        "flex items-center gap-2 pl-5 pr-3 py-0.5 cursor-context-menu",
        isCurrent ? "text-accent-primary" : "text-text-secondary hover:text-text-primary"
      )}
      onContextMenu={(e) => onContextMenu(e, name)}
    >
      <GitBranch size={9} className="shrink-0 text-text-muted" />
      <span className="truncate flex-1 text-[11px]">{display}</span>
      {isCurrent && <Pin size={9} className="shrink-0 text-accent-primary" />}
    </div>
  );
}

function PrefixGroup({
  prefix,
  branches,
  currentBranch,
  onContextMenu,
}: {
  prefix: string;
  branches: string[];
  currentBranch: string;
  onContextMenu: (e: React.MouseEvent, branchName: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 pl-4 pr-3 py-0.5 w-full text-[10px] text-text-muted hover:text-text-secondary"
      >
        <GitFork size={9} className="shrink-0" />
        <span className="truncate">{prefix}/</span>
        {open ? <ChevronDown size={8} className="ml-auto" /> : <ChevronRight size={8} className="ml-auto" />}
      </button>
      {open &&
        branches.map((b) => (
          <div
            key={b}
            className={cn(
              "flex items-center gap-2 pl-8 pr-3 py-0.5 text-[11px] cursor-context-menu",
              b === currentBranch ? "text-accent-primary" : "text-text-secondary hover:text-text-primary"
            )}
            onContextMenu={(e) => onContextMenu(e, b)}
          >
            <span className="truncate flex-1">{b.slice(prefix.length + 1)}</span>
            {b === currentBranch && <Pin size={9} className="shrink-0 text-accent-primary" />}
          </div>
        ))}
    </div>
  );
}

function RemoteGroup({
  remote,
  branches,
  onContextMenu,
}: {
  remote: string;
  branches: string[];
  onContextMenu: (e: React.MouseEvent, branchName: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 pl-4 pr-3 py-0.5 w-full text-[10px] text-text-muted hover:text-text-secondary"
      >
        <GitFork size={9} className="shrink-0" />
        <span className="truncate">{remote}</span>
        {open ? <ChevronDown size={8} className="ml-auto" /> : <ChevronRight size={8} className="ml-auto" />}
      </button>
      {open &&
        branches.map((b) => (
          <div
            key={b}
            className="flex items-center gap-2 pl-8 pr-3 py-0.5 text-[11px] text-text-secondary hover:text-text-primary cursor-context-menu"
            onContextMenu={(e) => onContextMenu(e, b)}
          >
            <span className="truncate">{b}</span>
          </div>
        ))}
    </div>
  );
}

// ─── GitLogPanel ──────────────────────────────────────────────────────────────

export function GitLogPanel() {
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const cwd = activeProjectDir ?? "";

  const queryClient = useQueryClient();
  const { data: localBranches } = useGitBranches(cwd);
  const { data: currentBranchData } = useGitCurrentBranch(cwd);
  const { data: commits, isLoading } = useGitLog(cwd);
  const runGitAction = useGitAction();

  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; branch: string } | null>(null);
  const [newBranchFrom, setNewBranchFrom] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchLoading, setNewBranchLoading] = useState(false);
  const [newBranchError, setNewBranchError] = useState<string | null>(null);

  const currentBranch = currentBranchData ?? localBranches?.[0] ?? "main";

  const handleBranchContextMenu = (e: React.MouseEvent, branchName: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, branch: branchName });
  };

  const handleContextMenuAction = (action: "new-branch", branch: string) => {
    if (action === "new-branch") {
      setNewBranchFrom(branch);
      setNewBranchName("");
      setNewBranchError(null);
    }
  };

  const handleCreateNewBranch = async () => {
    if (!cwd || !newBranchName.trim() || !newBranchFrom) return;
    setNewBranchLoading(true);
    setNewBranchError(null);
    try {
      await runGitAction(
        `git create branch ${newBranchName.trim()}`,
        () => gitCreateBranch(cwd, newBranchName.trim(), newBranchFrom)
      );
      queryClient.invalidateQueries({ queryKey: ["gitBranches", cwd] });
      queryClient.invalidateQueries({ queryKey: ["gitCurrentBranch", cwd] });
      setNewBranchFrom(null);
    } catch (e) {
      setNewBranchError(String(e));
    } finally {
      setNewBranchLoading(false);
    }
  };

  if (!activeProjectDir) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-text-muted">
        Open a project to view git log
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Branch tree (35%) */}
      <div className="w-[35%] border-r border-border-muted overflow-hidden flex flex-col">
        {/* Inline new-branch form */}
        {newBranchFrom !== null && (
          <div className="px-3 py-2 border-b border-border-muted flex flex-col gap-1.5 shrink-0">
            <div className="text-[10px] text-text-muted truncate">
              New branch from{" "}
              <span className="text-text-primary font-medium">{newBranchFrom}</span>:
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateNewBranch();
                  if (e.key === "Escape") setNewBranchFrom(null);
                }}
                placeholder="branch name"
                className="flex-1 min-w-0 px-2 py-1 text-xs bg-bg-base border border-border-muted rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-border-focus"
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
                onClick={() => setNewBranchFrom(null)}
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
        <div className="flex-1 overflow-hidden">
          <BranchTree
            cwd={cwd}
            localBranches={localBranches ?? []}
            currentBranch={currentBranch}
            onBranchContextMenu={handleBranchContextMenu}
          />
        </div>
      </div>

      {/* Right: Commit log (65%) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 h-6 border-b border-border-muted bg-bg-surface text-[10px] text-text-muted font-semibold uppercase tracking-wider shrink-0">
          <span className="w-14 shrink-0">Hash</span>
          <span className="flex-1">Message</span>
          <span className="w-40 shrink-0">Refs</span>
          <span className="w-20 shrink-0 text-right">Author</span>
          <span className="w-20 shrink-0 text-right">Date</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1 gap-2 text-xs text-text-muted">
            <Loader2 size={14} className="animate-spin" />
            Loading commits…
          </div>
        ) : (commits?.length ?? 0) === 0 ? (
          <div className="flex items-center justify-center flex-1 text-xs text-text-muted">
            No commits found
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {(commits ?? []).map((commit) => (
              <CommitRow
                key={commit.hash}
                commit={commit}
                selected={selectedHash === commit.hash}
                onClick={() => setSelectedHash(commit.hash)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Branch context menu */}
      {contextMenu && (
        <BranchContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          branchName={contextMenu.branch}
          cwd={cwd}
          currentBranch={currentBranch}
          onClose={() => setContextMenu(null)}
          onAction={handleContextMenuAction}
        />
      )}
    </div>
  );
}
