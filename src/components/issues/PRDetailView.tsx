import {
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
  ExternalLink,
  MessageSquare,
  FileCode,
  RefreshCw,
} from "lucide-react";
import { usePRDetail } from "@/hooks/useClaudeData";
import { useProjectsStore } from "@/stores/projectsStore";
import type { SessionTab } from "@/stores/sessionStore";
import type { PRDetail, PRComment, PRReviewComment } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface PRDetailViewProps {
  tab: SessionTab;
}

export function PRDetailView({ tab }: PRDetailViewProps) {
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const prNumber = tab.prNumber ?? 0;
  const { data: pr, isLoading, error, refetch } = usePRDetail(activeProjectDir, prNumber);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-muted)]">
        Loading PR #{prNumber}…
      </div>
    );
  }

  if (error || !pr) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-[var(--color-text-muted)]">
        <p className="text-[var(--color-status-error)]">
          {error instanceof Error ? error.message : `Failed to load PR #${prNumber}`}
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

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* Header with link */}
      <PRHeader pr={pr} onRefresh={() => refetch()} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
          {/* PR Body / Description */}
          <PRBody pr={pr} />

          {/* Comments section */}
          {pr.comments.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <MessageSquare size={14} />
                Comments ({pr.comments.length})
              </h2>
              <div className="space-y-3">
                {pr.comments.map((comment, i) => (
                  <CommentCard key={i} comment={comment} />
                ))}
              </div>
            </section>
          )}

          {/* Review comments (inline code comments) */}
          {pr.review_comments.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <FileCode size={14} />
                Review Comments ({pr.review_comments.length})
              </h2>
              <div className="space-y-3">
                {pr.review_comments.map((comment, i) => (
                  <ReviewCommentCard key={i} comment={comment} />
                ))}
              </div>
            </section>
          )}

          {pr.comments.length === 0 && pr.review_comments.length === 0 && (
            <div className="text-xs text-[var(--color-text-muted)] text-center py-4">
              No comments yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PRHeader({ pr, onRefresh }: { pr: PRDetail; onRefresh: () => void }) {
  const stateIcon =
    pr.state === "merged" ? (
      <GitMerge size={14} className="text-[var(--color-accent-secondary)]" />
    ) : pr.state === "closed" ? (
      <GitPullRequestClosed size={14} className="text-[var(--color-status-error)]" />
    ) : (
      <GitPullRequest
        size={14}
        className={
          pr.draft
            ? "text-[var(--color-text-muted)]"
            : "text-[var(--color-status-success)]"
        }
      />
    );

  const stateLabel = pr.draft ? "Draft" : pr.state;
  const stateBg =
    pr.state === "merged"
      ? "bg-[var(--color-accent-secondary)]/20 text-[var(--color-accent-secondary)]"
      : pr.state === "closed"
        ? "bg-[var(--color-status-error)]/20 text-[var(--color-status-error)]"
        : pr.draft
          ? "bg-[var(--color-text-muted)]/20 text-[var(--color-text-muted)]"
          : "bg-[var(--color-status-success)]/20 text-[var(--color-status-success)]";

  return (
    <div className="shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
      {/* Top row: link + refresh */}
      <div className="flex items-center justify-between mb-2">
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-[var(--color-accent-primary)] hover:underline font-mono"
        >
          <ExternalLink size={11} />
          {pr.url}
        </a>
        <button
          onClick={onRefresh}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Title row */}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">{stateIcon}</span>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">
            {pr.title}
            <span className="text-[var(--color-text-muted)] font-normal ml-1.5">#{pr.number}</span>
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize", stateBg)}>
              {stateLabel}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {pr.author} wants to merge
            </span>
            <span className="text-[10px] font-mono text-[var(--color-accent-primary)]">
              {pr.head_ref}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)]">into</span>
            <span className="text-[10px] font-mono text-[var(--color-accent-primary)]">
              {pr.base_ref}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-[var(--color-status-success)]">
              +{pr.additions}
            </span>
            <span className="text-[10px] text-[var(--color-status-error)]">
              -{pr.deletions}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {pr.changed_files} file{pr.changed_files !== 1 ? "s" : ""} changed
            </span>
            {pr.labels.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {pr.labels.map((label) => (
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
    </div>
  );
}

function PRBody({ pr }: { pr: PRDetail }) {
  const body = pr.body?.trim();
  if (!body) {
    return (
      <div className="text-xs text-[var(--color-text-muted)] italic">
        No description provided.
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
        Description
      </h2>
      <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <MarkdownBody text={body} />
      </div>
    </section>
  );
}

function CommentCard({ comment }: { comment: PRComment }) {
  return (
    <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--color-bg-raised)] border-b border-[var(--color-border-default)]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[var(--color-text-primary)]">
            {comment.author}
          </span>
          {comment.association && comment.association !== "NONE" && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)] uppercase">
              {comment.association}
            </span>
          )}
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {formatDate(comment.created_at)}
        </span>
      </div>
      <div className="px-3 py-2">
        <MarkdownBody text={comment.body} />
      </div>
    </div>
  );
}

function ReviewCommentCard({ comment }: { comment: PRReviewComment }) {
  return (
    <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--color-bg-raised)] border-b border-[var(--color-border-default)]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[var(--color-text-primary)]">
            {comment.author}
          </span>
          {comment.path && (
            <span className="text-[10px] font-mono text-[var(--color-accent-primary)]">
              {comment.path}
            </span>
          )}
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {formatDate(comment.created_at)}
        </span>
      </div>
      {comment.diff_hunk && (
        <pre className="px-3 py-1.5 bg-[var(--color-bg-base)] border-b border-[var(--color-border-default)] overflow-x-auto">
          <code className="text-[10px] font-mono text-[var(--color-text-muted)]">
            {comment.diff_hunk}
          </code>
        </pre>
      )}
      <div className="px-3 py-2">
        <MarkdownBody text={comment.body} />
      </div>
    </div>
  );
}

/** Simple inline markdown: code blocks, bold, inline code, plain text */
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
          <p key={idx}>
            <InlineMarkdown text={block.text} />
          </p>
        )
      )}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  // Handle bold (**text**) and inline code (`text`)
  const parts: Array<{ type: "text" | "bold" | "code"; value: string }> = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+?)`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: "text", value: text.slice(lastIdx, match.index) });
    }
    if (match[2]) {
      parts.push({ type: "bold", value: match[2] });
    } else if (match[3]) {
      parts.push({ type: "code", value: match[3] });
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push({ type: "text", value: text.slice(lastIdx) });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.type === "bold" ? (
          <strong key={i} className="font-semibold text-[var(--color-text-primary)]">
            {part.value}
          </strong>
        ) : part.type === "code" ? (
          <code
            key={i}
            className="text-[10px] px-1 py-0.5 bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] rounded font-mono text-[var(--color-accent-secondary)]"
          >
            {part.value}
          </code>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
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
