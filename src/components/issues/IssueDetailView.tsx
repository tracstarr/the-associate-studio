import { ExternalLink, RefreshCw, User, Tag, AlertCircle, MessageSquare } from "lucide-react";
import { useJiraIssueDetail, useIssues, useLinearIssues } from "@/hooks/useClaudeData";
import { useSettingsStore } from "@/stores/settingsStore";
import type { SessionTab } from "@/stores/sessionStore";
import type { Issue } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface IssueDetailViewProps {
  tab: SessionTab;
}

export function IssueDetailView({ tab }: IssueDetailViewProps) {
  if (tab.issueSource === "jira") return <JiraIssueDetailView tab={tab} />;
  if (tab.issueSource === "github") return <GitHubIssueDetailView tab={tab} />;
  return <LinearIssueDetailView tab={tab} />;
}

function JiraIssueDetailView({ tab }: { tab: SessionTab }) {
  const jiraBaseUrl = useSettingsStore((s) => s.jiraBaseUrl);
  const jiraEmail = useSettingsStore((s) => s.jiraEmail);
  const jiraApiToken = useSettingsStore((s) => s.jiraApiToken);
  const hasJira = !!(jiraBaseUrl && jiraEmail && jiraApiToken);
  const { data, isLoading, error, refetch } = useJiraIssueDetail(
    hasJira,
    jiraBaseUrl,
    jiraEmail,
    jiraApiToken,
    tab.issueKey ?? ""
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-muted)]">
        Loading {tab.issueKey}…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-[var(--color-text-muted)]">
        <p className="text-[var(--color-status-error)]">
          {error instanceof Error ? error.message : `Failed to load ${tab.issueKey}`}
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-bg-raised)] hover:bg-[var(--color-bg-overlay)] transition-colors text-[var(--color-text-secondary)]"
        >
          <RefreshCw size={10} />
          Retry
        </button>
      </div>
    );
  }

  const statusColor = getStatusColor(data.status);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      <div className="shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-[var(--color-accent-primary)] hover:underline font-mono"
          >
            <ExternalLink size={11} />
            {data.url}
          </a>
          <button
            onClick={() => refetch()}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">
            {data.summary}
            <span className="text-[var(--color-text-muted)] font-normal ml-1.5 font-mono">{data.key}</span>
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", statusColor)}>
              {data.status}
            </span>
            {data.issue_type && (
              <span className="text-[10px] text-[var(--color-text-muted)]">{data.issue_type}</span>
            )}
            {data.priority && (
              <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-0.5">
                <AlertCircle size={9} />
                {data.priority}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {data.reporter && (
              <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                <User size={9} />
                Reporter: {data.reporter}
              </span>
            )}
            {data.assignee && (
              <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                <User size={9} />
                Assignee: {data.assignee}
              </span>
            )}
            <span className="text-[10px] text-[var(--color-text-muted)]">
              Created {formatDate(data.created)}
            </span>
            {data.comment_count > 0 && (
              <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                <MessageSquare size={9} />
                {data.comment_count} comment{data.comment_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
          {data.labels.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-start">
              <Tag size={12} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" />
              {data.labels.map((label) => (
                <span
                  key={label}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {data.description ? (
            <section>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Description</h2>
              <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
                <pre className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {data.description}
                </pre>
              </div>
            </section>
          ) : (
            <div className="text-xs text-[var(--color-text-muted)] italic">No description provided.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function GitHubIssueDetailView({ tab }: { tab: SessionTab }) {
  const cwd = tab.projectDir || null;
  const issueNum = parseInt(tab.issueKey ?? "0", 10);
  const { data: openIssues } = useIssues(cwd, "open");
  const { data: closedIssues } = useIssues(cwd, "closed");
  const issue: Issue | undefined = [...(openIssues ?? []), ...(closedIssues ?? [])].find(
    (i) => i.number === issueNum
  );

  if (!issue) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-xs text-[var(--color-text-muted)]">
        <p>Issue #{issueNum} not found in cache.</p>
        {tab.issueUrl && (
          <a
            href={tab.issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[var(--color-accent-primary)] hover:underline"
          >
            <ExternalLink size={12} />
            Open in GitHub
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      <div className="shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-[var(--color-accent-primary)] hover:underline font-mono"
          >
            <ExternalLink size={11} />
            {issue.url}
          </a>
          <svg
            width="12"
            height="12"
            viewBox="0 0 98 96"
            fill="currentColor"
            className="text-[var(--color-text-muted)] shrink-0"
          >
            <path d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">
            {issue.title}
            <span className="text-[var(--color-text-muted)] font-normal ml-1.5">#{issue.number}</span>
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize",
                issue.state === "open"
                  ? "bg-[var(--color-status-success)]/20 text-[var(--color-status-success)]"
                  : "bg-[var(--color-accent-secondary)]/20 text-[var(--color-accent-secondary)]"
              )}
            >
              {issue.state}
            </span>
            {issue.author && (
              <span className="text-[10px] text-[var(--color-text-muted)]">by {issue.author}</span>
            )}
            <span className="text-[10px] text-[var(--color-text-muted)]">
              Created {formatDate(issue.created_at)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
          {issue.labels.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-start">
              <Tag size={12} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" />
              {issue.labels.map((label) => (
                <span
                  key={label}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {issue.body?.trim() ? (
            <section>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Description</h2>
              <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
                <MarkdownBody text={issue.body!} />
              </div>
            </section>
          ) : (
            <div className="text-xs text-[var(--color-text-muted)] italic">No description provided.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function LinearIssueDetailView({ tab }: { tab: SessionTab }) {
  const linearApiKey = useSettingsStore((s) => s.linearApiKey);
  const hasKey = !!linearApiKey;
  const { data: openIssues } = useLinearIssues(hasKey, "open");
  const { data: closedIssues } = useLinearIssues(hasKey, "closed");
  const issue: Issue | undefined = [...(openIssues ?? []), ...(closedIssues ?? [])].find(
    (i) => i.identifier === tab.issueKey
  );
  const url = tab.issueUrl ?? issue?.url ?? "";

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      <div className="shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-[var(--color-accent-primary)] hover:underline font-mono"
            >
              <ExternalLink size={11} />
              {url}
            </a>
          ) : (
            <span />
          )}
          <span title="Linear" className="text-indigo-400 shrink-0">
            <svg width="12" height="12" viewBox="0 0 100 100" fill="currentColor">
              <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857l37.3249 37.3249c.6889.6889.0915 1.8189-.857 1.5964C20.0516 95.1512 5.1488 80.2483 1.22541 61.5228zM.00189135 46.8891c-.01764375.3792.08825.7558.32148 1.0661l52.0956 52.0956c.3103.2332.6869.3391 1.0661.3215C29.7011 98.0867 1.99222 70.3778.00189135 46.8891zM4.69889 29.2076 70.7918 95.3005c.3401.3401.4168.8341.2372 1.2627C64.4903 99.8302 57.4747 101 50.2222 101c-.8864 0-1.7682-.0213-2.6456-.0633L3.43284 56.8311c-.04211-.8774-.06329-1.7592-.06329-2.6456 0-7.2525 1.16983-14.268 3.32905-20.983zM7.96879 19.4655c-.92861.931-.72523 2.4998.43883 3.1583l69.6078 69.6078c.6585 1.164 2.2273 1.3674 3.1583.4388L7.96879 19.4655zM14.3976 12.5045 87.4949 85.6018c1.0683.8928 2.625.8141 3.4317-.1896L14.5872 9.07281c-1.0037.80665-1.0824 2.36335-.1896 3.43169zM22.8194 7.06997 92.9296 77.1802c.8928 1.0684.8141 2.6251-.1896 3.4317L19.3877 7.25958c1.0684-.89279 2.6251-.81403 3.4317.19039zM33.1677 3.35664 96.6428 66.8317c.6585 1.164.4551 2.7328-.4388 3.1583L29.0094 2.90948c.9485-.22253 2.4598.00965 4.1583.44716zM46.8891.00189C70.3778 1.99222 98.0867 29.7011 99.8215 53.1628c.0176.3792-.0883.7558-.3215 1.0661L45.8227.32337c-.3103-.2332-.6869-.3391-1.0661-.3215.3775-.00131.7551-.00131 1.1325 0z" />
            </svg>
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">
            {issue?.title ?? tab.title}
            <span className="text-[var(--color-text-muted)] font-normal ml-1.5 font-mono">{tab.issueKey}</span>
          </h1>
          {issue && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize",
                  issue.state === "open"
                    ? "bg-[var(--color-status-success)]/20 text-[var(--color-status-success)]"
                    : "bg-[var(--color-accent-secondary)]/20 text-[var(--color-accent-secondary)]"
                )}
              >
                {issue.state}
              </span>
              {issue.author && (
                <span className="text-[10px] text-[var(--color-text-muted)]">by {issue.author}</span>
              )}
              <span className="text-[10px] text-[var(--color-text-muted)]">
                Created {formatDate(issue.created_at)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
          {issue && issue.labels.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-start">
              <Tag size={12} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" />
              {issue.labels.map((label) => (
                <span
                  key={label}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          <div className="text-xs text-[var(--color-text-muted)] italic">
            Linear issue body is not available in the preview.
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("done") || s.includes("closed") || s.includes("complete")) {
    return "bg-[var(--color-accent-secondary)]/20 text-[var(--color-accent-secondary)]";
  }
  if (s.includes("progress") || s.includes("review") || s.includes("active")) {
    return "bg-[var(--color-status-warning)]/20 text-[var(--color-status-warning)]";
  }
  if (s.includes("open") || s.includes("todo") || s.includes("backlog") || s.includes("new") || s.includes("triage")) {
    return "bg-[var(--color-status-success)]/20 text-[var(--color-status-success)]";
  }
  return "bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]";
}

function MarkdownBody({ text }: { text: string }) {
  const lines = text.split("\n");
  let i = 0;
  const result: Array<{ type: "code"; lines: string[] } | { type: "text"; text: string }> = [];

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      result.push({ type: "code", lines: codeLines });
    } else {
      result.push({ type: "text", text: line });
    }
    i++;
  }

  return (
    <div className="text-xs text-[var(--color-text-secondary)] space-y-1 leading-relaxed whitespace-pre-wrap break-words">
      {result.map((block, idx) =>
        block.type === "code" ? (
          <pre
            key={idx}
            className="bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] rounded p-2 my-1 overflow-x-auto"
          >
            <code className="text-[10px] font-mono text-[var(--color-accent-secondary)]">
              {block.lines.join("\n")}
            </code>
          </pre>
        ) : block.text.trim() === "" ? (
          <div key={idx} className="h-1" />
        ) : (
          <p key={idx}>{block.text}</p>
        )
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
