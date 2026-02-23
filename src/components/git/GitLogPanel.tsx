import { useState } from "react";
import { ChevronDown, ChevronRight, GitBranch, GitFork, Pin, Loader2 } from "lucide-react";
import { useGitBranches, useGitCurrentBranch, useGitLog, useGitRemoteBranches } from "@/hooks/useClaudeData";
import { useProjectsStore } from "@/stores/projectsStore";
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
}: {
  cwd: string;
  localBranches: string[];
  currentBranch: string;
}) {
  const [localOpen, setLocalOpen] = useState(true);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const { data: remoteBranches } = useGitRemoteBranches(cwd);

  const grouped = groupByPrefix(localBranches);
  const flat = grouped[""] ?? [];
  const prefixed = Object.entries(grouped).filter(([k]) => k !== "");

  // Group remote branches by remote name
  const remoteGroups: Record<string, string[]> = {};
  for (const rb of remoteBranches ?? []) {
    (remoteGroups[rb.remote] ??= []).push(rb.branch);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto text-xs">
      {/* HEAD */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default bg-accent-primary/10">
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
              <BranchRow key={b} name={b} isCurrent={b === currentBranch} />
            ))}
            {prefixed.map(([prefix, branches]) => (
              <PrefixGroup key={prefix} prefix={prefix} branches={branches} currentBranch={currentBranch} />
            ))}
          </div>
        )}
      </div>

      {/* Remote branches */}
      {(remoteBranches?.length ?? 0) > 0 && (
        <div className="border-t border-border-default">
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
              <RemoteGroup key={remote} remote={remote} branches={branches} />
            ))}
        </div>
      )}
    </div>
  );
}

function BranchRow({ name, isCurrent }: { name: string; isCurrent: boolean }) {
  const display = name.includes("/") ? name.split("/").pop() ?? name : name;
  return (
    <div
      className={cn(
        "flex items-center gap-2 pl-5 pr-3 py-0.5",
        isCurrent ? "text-accent-primary" : "text-text-secondary hover:text-text-primary"
      )}
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
}: {
  prefix: string;
  branches: string[];
  currentBranch: string;
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
              "flex items-center gap-2 pl-8 pr-3 py-0.5 text-[11px]",
              b === currentBranch ? "text-accent-primary" : "text-text-secondary hover:text-text-primary"
            )}
          >
            <span className="truncate flex-1">{b.slice(prefix.length + 1)}</span>
            {b === currentBranch && <Pin size={9} className="shrink-0 text-accent-primary" />}
          </div>
        ))}
    </div>
  );
}

function RemoteGroup({ remote, branches }: { remote: string; branches: string[] }) {
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
            className="flex items-center gap-2 pl-8 pr-3 py-0.5 text-[11px] text-text-secondary hover:text-text-primary"
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

  const { data: localBranches } = useGitBranches(cwd);
  const { data: currentBranchData } = useGitCurrentBranch(cwd);
  const { data: commits, isLoading } = useGitLog(cwd);

  const [selectedHash, setSelectedHash] = useState<string | null>(null);

  const currentBranch = currentBranchData ?? localBranches?.[0] ?? "main";

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
      <div className="w-[35%] border-r border-border-default overflow-hidden flex flex-col">
        <BranchTree
          cwd={cwd}
          localBranches={localBranches ?? []}
          currentBranch={currentBranch}
        />
      </div>

      {/* Right: Commit log (65%) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 h-6 border-b border-border-default bg-bg-surface text-[10px] text-text-muted font-semibold uppercase tracking-wider shrink-0">
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
    </div>
  );
}
