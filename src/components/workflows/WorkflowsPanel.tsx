import { useState, useCallback } from "react";
import { RefreshCw, ExternalLink, Play } from "lucide-react";
import { useWorkflowFiles, useWorkflowRuns } from "@/hooks/useClaudeData";
import { useProjectsStore } from "@/stores/projectsStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { SessionTab } from "@/stores/sessionStore";
import type { WorkflowFile, WorkflowRun } from "@/lib/tauri";
import { pathToProjectId, cn } from "@/lib/utils";

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function StatusIcon({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === "completed") {
    if (conclusion === "success") {
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
          <circle cx="7" cy="7" r="6" fill="none" stroke="var(--color-status-success)" strokeWidth="1.5" />
          <path d="M4 7l2 2 4-4" fill="none" stroke="var(--color-status-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
        <circle cx="7" cy="7" r="6" fill="none" stroke="var(--color-status-error)" strokeWidth="1.5" />
        <path d="M5 5l4 4M9 5l-4 4" fill="none" stroke="var(--color-status-error)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "in_progress") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0 animate-spin">
        <circle cx="7" cy="7" r="6" fill="none" stroke="var(--color-status-warning)" strokeWidth="1.5" strokeDasharray="20 18" />
      </svg>
    );
  }
  // queued / waiting / pending
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
      <circle cx="7" cy="7" r="6" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" />
      <circle cx="7" cy="7" r="2" fill="var(--color-text-muted)" />
    </svg>
  );
}

export function WorkflowsPanel() {
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const openTab = useSessionStore((s) => s.openTab);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowFile | null>(null);

  const {
    data: workflowFiles,
    isLoading: filesLoading,
    error: filesError,
    refetch: refetchFiles,
  } = useWorkflowFiles(activeProjectDir);

  const {
    data: runs,
    isLoading: runsLoading,
    error: runsError,
    refetch: refetchRuns,
  } = useWorkflowRuns(
    activeProjectDir,
    selectedWorkflow?.filename
  );

  const handleWorkflowClick = useCallback((wf: WorkflowFile) => {
    setSelectedWorkflow(wf);
  }, []);

  const handleWorkflowDoubleClick = useCallback((wf: WorkflowFile) => {
    if (!activeProjectDir) return;
    const projectId = pathToProjectId(activeProjectDir);
    const tabId = `file:${wf.path}`;
    const tab: SessionTab = {
      id: tabId,
      type: "file",
      title: wf.filename,
      filePath: wf.path,
      projectDir: activeProjectDir,
    };
    openTab(tab, projectId);
  }, [activeProjectDir, openTab]);

  const handleRunClick = useCallback((run: WorkflowRun) => {
    if (!activeProjectDir) return;
    const projectId = pathToProjectId(activeProjectDir);
    const tabId = `workflow-run:${run.id}`;
    const tab: SessionTab = {
      id: tabId,
      type: "workflow-run",
      title: `Run #${run.id}`,
      projectDir: activeProjectDir,
      workflowRunId: run.id,
      workflowRunUrl: run.url,
    };
    openTab(tab, projectId);
  }, [activeProjectDir, openTab]);

  const handleRefresh = useCallback(() => {
    refetchFiles();
    refetchRuns();
  }, [refetchFiles, refetchRuns]);

  if (!activeProjectDir) {
    return (
      <div className="flex items-center justify-center h-full p-3 text-xs text-text-muted">
        Open a project to see workflows
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left pane — workflow list */}
      <div className="w-52 shrink-0 flex flex-col border-r border-border-muted">
        <div className="flex items-center h-7 px-2 border-b border-border-muted">
          <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide flex-1">
            Workflows
          </span>
          <button
            onClick={handleRefresh}
            className="text-text-muted hover:text-text-secondary transition-colors"
            title="Refresh"
          >
            <RefreshCw size={10} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filesLoading && (
            <div className="p-2 text-[10px] text-text-muted">Loading...</div>
          )}
          {filesError && (
            <div className="p-2 text-[10px] text-status-error">
              Failed to load workflows
            </div>
          )}
          {!filesLoading && !filesError && (!workflowFiles || workflowFiles.length === 0) && (
            <div className="p-3 text-[10px] text-text-muted text-center">
              No workflow files found in .github/workflows/
            </div>
          )}
          {/* "All" option */}
          {workflowFiles && workflowFiles.length > 0 && (
            <button
              onClick={() => setSelectedWorkflow(null)}
              className={cn(
                "w-full text-left px-2 py-1.5 text-xs transition-all duration-150 border-b border-border-muted",
                selectedWorkflow === null
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-text-secondary hover:bg-bg-raised/50"
              )}
            >
              <div className="flex items-center gap-1.5">
                <Play size={10} className="shrink-0 text-text-muted" />
                <span className="truncate font-medium">All workflows</span>
              </div>
            </button>
          )}
          {workflowFiles?.map((wf) => (
            <WorkflowFileItem
              key={wf.filename}
              workflow={wf}
              isSelected={selectedWorkflow?.filename === wf.filename}
              latestRun={runs?.find((r) => r.workflowName === wf.name)}
              onClick={() => handleWorkflowClick(wf)}
              onDoubleClick={() => handleWorkflowDoubleClick(wf)}
            />
          ))}
        </div>
      </div>

      {/* Right pane — runs list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center h-7 px-2 border-b border-border-muted">
          <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide flex-1">
            {selectedWorkflow ? selectedWorkflow.name : "All Runs"}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {runsLoading && (
            <div className="p-2 text-[10px] text-text-muted">Loading runs...</div>
          )}
          {runsError && (
            <div className="p-2 text-[10px] text-status-error">
              {runsError instanceof Error ? runsError.message : "Failed to load runs"}
              <p className="mt-1 text-text-muted">
                Make sure GitHub CLI is installed and authenticated.
              </p>
            </div>
          )}
          {!runsLoading && !runsError && (!runs || runs.length === 0) && (
            <div className="p-3 text-[10px] text-text-muted text-center">
              No workflow runs found
            </div>
          )}
          {runs?.map((run) => (
            <RunItem
              key={run.id}
              run={run}
              onClick={() => handleRunClick(run)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkflowFileItem({
  workflow,
  isSelected,
  latestRun,
  onClick,
  onDoubleClick,
}: {
  workflow: WorkflowFile;
  isSelected: boolean;
  latestRun?: WorkflowRun;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        "w-full text-left px-2 py-1.5 text-xs transition-all duration-150 border-b border-border-muted",
        isSelected
          ? "bg-accent-primary/10 text-accent-primary"
          : "text-text-secondary hover:bg-bg-raised/50"
      )}
    >
      <div className="flex items-center gap-1.5">
        {latestRun ? (
          <StatusIcon status={latestRun.status} conclusion={latestRun.conclusion} />
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
            <circle cx="7" cy="7" r="6" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeDasharray="3 3" />
          </svg>
        )}
        <span className="truncate">{workflow.name}</span>
      </div>
    </button>
  );
}

function RunItem({
  run,
  onClick,
}: {
  run: WorkflowRun;
  onClick: () => void;
}) {
  return (
    <div
      className="px-3 py-2 border-b border-border-muted hover:bg-bg-raised/50 transition-all duration-150 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5">
          <StatusIcon status={run.status} conclusion={run.conclusion} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-text-primary truncate">
            {run.displayTitle || run.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-text-muted">
              {run.workflowName} · {run.headBranch} · {formatTimeAgo(run.createdAt)}
            </span>
          </div>
        </div>
        <a
          href={run.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 text-text-muted hover:text-accent-primary transition-colors"
          title="Open in browser"
        >
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
