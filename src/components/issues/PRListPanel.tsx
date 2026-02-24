import { useState } from "react";
import {
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
} from "lucide-react";
import { usePRs } from "@/hooks/useClaudeData";
import { useProjectsStore } from "@/stores/projectsStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { SessionTab } from "@/stores/sessionStore";
import type { PullRequest } from "@/lib/tauri";
import { pathToProjectId, cn } from "@/lib/utils";

export function PRListPanel() {
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const openTab = useSessionStore((s) => s.openTab);
  const [state, setState] = useState<"open" | "closed" | "all">("open");
  const { data: prs, isLoading, error, refetch } = usePRs(activeProjectDir, state);

  const openPRDetailTab = (pr: PullRequest) => {
    if (!activeProjectDir) return;
    const projectId = pathToProjectId(activeProjectDir);
    const tab: SessionTab = {
      id: `pr:${pr.number}`,
      type: "pr-detail",
      title: `PR #${pr.number}`,
      projectDir: activeProjectDir,
      prNumber: pr.number,
    };
    openTab(tab, projectId);
  };

  if (!activeProjectDir) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        Open a project to see PRs
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter tabs */}
      <div className="flex items-center border-b border-[var(--color-border-default)] px-2 py-1 gap-1">
        {(["open", "closed", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] capitalize transition-colors",
              state === s
                ? "bg-[var(--color-bg-raised)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            {s}
          </button>
        ))}
        <button
          onClick={() => refetch()}
          className="ml-auto text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          ↻
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-3 text-xs text-[var(--color-text-muted)]">Loading...</div>
        )}
        {error && (
          <div className="p-3 text-xs text-[var(--color-status-error)]">
            {error instanceof Error ? error.message : "Failed to load PRs"}
            <p className="mt-1 text-[var(--color-text-muted)]">
              Make sure GitHub CLI is installed and authenticated.
            </p>
          </div>
        )}
        {!isLoading && !error && (!prs || prs.length === 0) && (
          <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
            No {state === "all" ? "" : state} PRs
          </div>
        )}
        {prs?.map((pr) => (
          <PRItem
            key={pr.number}
            pr={pr}
            onClick={() => openPRDetailTab(pr)}
          />
        ))}
      </div>
    </div>
  );
}

function PRItem({ pr, onClick }: { pr: PullRequest; onClick: () => void }) {
  const stateIcon =
    pr.state === "merged" ? (
      <GitMerge size={12} className="text-[var(--color-accent-secondary)]" />
    ) : pr.state === "closed" ? (
      <GitPullRequestClosed size={12} className="text-[var(--color-status-error)]" />
    ) : (
      <GitPullRequest
        size={12}
        className={
          pr.draft
            ? "text-[var(--color-text-muted)]"
            : "text-[var(--color-status-success)]"
        }
      />
    );

  const timeAgo = formatTimeAgo(pr.created_at);

  return (
    <div
      className="px-3 py-2 border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-raised)] transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">{stateIcon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--color-text-primary)] truncate">
            {pr.draft && (
              <span className="text-[var(--color-text-muted)] mr-1">[Draft]</span>
            )}
            {pr.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-[var(--color-text-muted)]">
              #{pr.number} by {pr.author} · {timeAgo}
            </span>
          </div>
          {pr.labels.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {pr.labels.slice(0, 3).map((label) => (
                <span
                  key={label}
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}
