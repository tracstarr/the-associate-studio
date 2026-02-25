import { useState, useMemo } from "react";
import { CircleDot, CheckCircle2, Github } from "lucide-react";
import { useIssues, useLinearIssues, useJiraIssues } from "@/hooks/useClaudeData";
import { useProjectsStore } from "@/stores/projectsStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Issue } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export function IssueListPanel() {
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const linearApiKey = useSettingsStore((s) => s.linearApiKey);
  const jiraBaseUrl = useSettingsStore((s) => s.jiraBaseUrl);
  const jiraEmail = useSettingsStore((s) => s.jiraEmail);
  const jiraApiToken = useSettingsStore((s) => s.jiraApiToken);
  const hasJira = !!(jiraBaseUrl && jiraEmail && jiraApiToken);
  const [state, setState] = useState<"open" | "closed" | "all">("open");

  const { data: ghIssues, isLoading: ghLoading, error: ghError, refetch: ghRefetch } = useIssues(activeProjectDir, state);
  const { data: linearIssues, isLoading: linearLoading, refetch: linearRefetch } = useLinearIssues(!!linearApiKey, state);
  const { data: jiraIssues, isLoading: jiraLoading, refetch: jiraRefetch } = useJiraIssues(hasJira, jiraBaseUrl, jiraEmail, state);

  const issues = useMemo(() => {
    const all = [...(ghIssues ?? []), ...(linearIssues ?? []), ...(jiraIssues ?? [])];
    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [ghIssues, linearIssues, jiraIssues]);

  const isLoading = ghLoading || linearLoading || jiraLoading;

  function refetch() {
    ghRefetch();
    linearRefetch();
    jiraRefetch();
  }

  if (!activeProjectDir) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        Open a project to see issues
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center border-b border-[var(--color-border-muted)] px-2 py-1 gap-1">
        {(["open", "closed", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={cn(
              "px-2 py-0.5 rounded-lg text-[10px] capitalize transition-all duration-200",
              state === s
                ? "bg-[var(--color-bg-raised)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            {s}
          </button>
        ))}
        <button
          onClick={refetch}
          className="ml-auto text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          ↻
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-3 text-xs text-[var(--color-text-muted)]">Loading...</div>
        )}
        {!isLoading && ghError && (
          <div className="p-3 text-xs text-[var(--color-status-error)]">
            {ghError instanceof Error ? ghError.message : "Failed to load GitHub issues"}
          </div>
        )}
        {!isLoading && !ghError && issues.length === 0 && (
          <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
            No {state === "all" ? "" : state} issues
          </div>
        )}
        {issues.map((issue, i) => (
          <IssueItem key={`${issue.source}-${issue.identifier ?? issue.number}-${i}`} issue={issue} />
        ))}
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: Issue["source"] }) {
  if (source === "github") {
    return (
      <span title="GitHub" className="shrink-0 text-[var(--color-text-muted)]">
        <Github size={10} />
      </span>
    );
  }
  if (source === "linear") {
    return (
      <span title="Linear" className="shrink-0 text-indigo-400">
        <svg width="10" height="10" viewBox="0 0 100 100" fill="currentColor">
          <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857l37.3249 37.3249c.6889.6889.0915 1.8189-.857 1.5964C20.0516 95.1512 5.1488 80.2483 1.22541 61.5228zM.00189135 46.8891c-.01764375.3792.08825.7558.32148 1.0661l52.0956 52.0956c.3103.2332.6869.3391 1.0661.3215C29.7011 98.0867 1.99222 70.3778.00189135 46.8891zM4.69889 29.2076 70.7918 95.3005c.3401.3401.4168.8341.2372 1.2627C64.4903 99.8302 57.4747 101 50.2222 101c-.8864 0-1.7682-.0213-2.6456-.0633L3.43284 56.8311c-.04211-.8774-.06329-1.7592-.06329-2.6456 0-7.2525 1.16983-14.268 3.32905-20.983zM7.96879 19.4655c-.92861.931-.72523 2.4998.43883 3.1583l69.6078 69.6078c.6585 1.164 2.2273 1.3674 3.1583.4388L7.96879 19.4655zM14.3976 12.5045 87.4949 85.6018c1.0683.8928 2.625.8141 3.4317-.1896L14.5872 9.07281c-1.0037.80665-1.0824 2.36335-.1896 3.43169zM22.8194 7.06997 92.9296 77.1802c.8928 1.0684.8141 2.6251-.1896 3.4317L19.3877 7.25958c1.0684-.89279 2.6251-.81403 3.4317.19039zM33.1677 3.35664 96.6428 66.8317c.6585 1.164.4551 2.7328-.4388 3.1583L29.0094 2.90948c.9485-.22253 2.4598.00965 4.1583.44716zM46.8891.00189C70.3778 1.99222 98.0867 29.7011 99.8215 53.1628c.0176.3792-.0883.7558-.3215 1.0661L45.8227.32337c-.3103-.2332-.6869-.3391-1.0661-.3215.3775-.00131.7551-.00131 1.1325 0z" />
        </svg>
      </span>
    );
  }
  if (source === "jira") {
    return (
      <span title="Jira" className="shrink-0 text-blue-400">
        <svg width="10" height="10" viewBox="0 0 256 257" fill="currentColor">
          <path d="M145.951 125.8L78.648 58.498 52.467 32.317 2.804 82.004 29 108.2l30.352 30.352-30.352 30.352-26.196 26.196 49.663 49.663 49.664-49.663 26.196-26.196 26.196-26.196-9.372-16.909zM205.533 148.553L179.337 122.357l-26.196-26.196-26.196 26.196 26.196 26.196 26.196 26.196 26.196-26.196z" />
        </svg>
      </span>
    );
  }
  return null;
}

function IssueItem({ issue }: { issue: Issue }) {
  const timeAgo = formatTimeAgo(issue.created_at);
  const displayId = issue.identifier ?? `#${issue.number}`;

  return (
    <div className="px-3 py-2 border-b border-[var(--color-border-muted)] hover:bg-[var(--color-bg-raised)] transition-all duration-200">
      <div className="flex items-start gap-2">
        <SourceBadge source={issue.source} />
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
              {displayId}{issue.author ? ` by ${issue.author}` : ""} · {timeAgo}
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
