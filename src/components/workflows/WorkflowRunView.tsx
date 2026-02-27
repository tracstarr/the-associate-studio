import { ExternalLink, RefreshCw } from "lucide-react";
import { useWorkflowRunDetail, useWorkflowRunLogs } from "@/hooks/useClaudeData";
import { useProjectsStore } from "@/stores/projectsStore";
import type { SessionTab } from "@/stores/sessionStore";
import type { WorkflowRunJob } from "@/lib/tauri";

function StatusIcon({ status, conclusion, size = 14 }: { status: string; conclusion: string | null; size?: number }) {
  if (status === "completed") {
    if (conclusion === "success") {
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
          <circle cx="7" cy="7" r="6" fill="none" stroke="var(--color-status-success)" strokeWidth="1.5" />
          <path d="M4 7l2 2 4-4" fill="none" stroke="var(--color-status-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
        <circle cx="7" cy="7" r="6" fill="none" stroke="var(--color-status-error)" strokeWidth="1.5" />
        <path d="M5 5l4 4M9 5l-4 4" fill="none" stroke="var(--color-status-error)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "in_progress") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0 animate-spin">
        <circle cx="7" cy="7" r="6" fill="none" stroke="var(--color-status-warning)" strokeWidth="1.5" strokeDasharray="20 18" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className="shrink-0">
      <circle cx="7" cy="7" r="6" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" />
      <circle cx="7" cy="7" r="2" fill="var(--color-text-muted)" />
    </svg>
  );
}

function JobItem({ job }: { job: WorkflowRunJob }) {
  const duration = (() => {
    if (!job.startedAt || !job.completedAt) return null;
    const start = new Date(job.startedAt).getTime();
    const end = new Date(job.completedAt).getTime();
    const secs = Math.floor((end - start) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}m ${remSecs}s`;
  })();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <StatusIcon status={job.status} conclusion={job.conclusion} />
      <span className="text-xs text-text-primary flex-1">{job.name}</span>
      {duration && (
        <span className="text-[10px] text-text-muted">{duration}</span>
      )}
    </div>
  );
}

export function WorkflowRunView({ tab }: { tab: SessionTab }) {
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const runId = tab.workflowRunId ?? 0;
  const runUrl = tab.workflowRunUrl;

  const { data: detail, isLoading: detailLoading, refetch: refetchDetail } = useWorkflowRunDetail(activeProjectDir, runId);
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useWorkflowRunLogs(activeProjectDir, runId);

  const handleRefresh = () => {
    refetchDetail();
    refetchLogs();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-base">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border-muted bg-bg-surface shrink-0">
        {detail && (
          <StatusIcon status={detail.status} conclusion={detail.conclusion} size={18} />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-text-primary truncate">
            {detail?.displayTitle || detail?.name || `Run #${runId}`}
          </h2>
          {detail && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-text-muted">
                {detail.headBranch} · {detail.status}
                {detail.conclusion ? ` · ${detail.conclusion}` : ""}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="text-text-muted hover:text-text-secondary transition-colors p-1"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
        {runUrl && (
          <a
            href={runUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-accent-primary transition-colors p-1"
            title="Open in browser"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {detailLoading && (
        <div className="p-4 text-xs text-text-muted">Loading run details...</div>
      )}

      {/* Jobs */}
      {detail && detail.jobs.length > 0 && (
        <div className="border-b border-border-muted">
          <div className="px-3 py-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wide bg-bg-surface">
            Jobs
          </div>
          {detail.jobs.map((job, i) => (
            <JobItem key={i} job={job} />
          ))}
        </div>
      )}

      {/* Logs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-3 py-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wide bg-bg-surface border-b border-border-muted shrink-0">
          Output
        </div>
        <div className="flex-1 overflow-auto">
          {logsLoading && (
            <div className="p-4 text-xs text-text-muted">Loading logs...</div>
          )}
          {!logsLoading && logs && (
            <pre className="p-3 text-[11px] font-mono text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
              {logs}
            </pre>
          )}
          {!logsLoading && !logs && (
            <div className="p-4 text-xs text-text-muted text-center">
              {detail?.status === "in_progress"
                ? "Logs will be available once the run completes."
                : "No logs available."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
