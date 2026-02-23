import { useState } from "react";
import { CircleDot, CheckCircle2 } from "lucide-react";
import { useIssues } from "@/hooks/useClaudeData";
import { useProjectsStore } from "@/stores/projectsStore";
import type { Issue } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export function IssueListPanel() {
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const [state, setState] = useState<"open" | "closed" | "all">("open");
  const { data: issues, isLoading, error, refetch } = useIssues(activeProjectDir, state);

  if (!activeProjectDir) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        Open a project to see issues
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
            {error instanceof Error ? error.message : "Failed to load issues"}
          </div>
        )}
        {!isLoading && !error && (!issues || issues.length === 0) && (
          <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
            No {state === "all" ? "" : state} issues
          </div>
        )}
        {issues?.map((issue) => (
          <IssueItem key={issue.number} issue={issue} />
        ))}
      </div>
    </div>
  );
}

function IssueItem({ issue }: { issue: Issue }) {
  const timeAgo = formatTimeAgo(issue.created_at);

  return (
    <div className="px-3 py-2 border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-raised)] transition-colors">
      <div className="flex items-start gap-2">
        {issue.state === "open" ? (
          <CircleDot
            size={12}
            className="text-[var(--color-status-success)] mt-0.5 shrink-0"
          />
        ) : (
          <CheckCircle2
            size={12}
            className="text-[var(--color-accent-secondary)] mt-0.5 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--color-text-primary)] truncate">
            {issue.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-[var(--color-text-muted)]">
              #{issue.number} by {issue.author} · {timeAgo}
            </span>
          </div>
          {issue.labels.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {issue.labels.slice(0, 3).map((label) => (
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
