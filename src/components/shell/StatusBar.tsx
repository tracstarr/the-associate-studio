import { memo } from "react";
import { GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectsStore } from "@/stores/projectsStore";
import { useActiveProjectTabs } from "@/hooks/useActiveProjectTabs";
import { useGitCurrentBranch, useGitStatus } from "@/hooks/useClaudeData";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";

function getParentDir(path: string): string {
  return path.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
}

function StatusBarComponent() {
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const projects = useProjectsStore((s) => s.projects);
  const setActiveProject = useProjectsStore((s) => s.setActiveProject);
  const { openTabs, activeTabId } = useActiveProjectTabs();
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const toggleNeuralField = useUIStore((s) => s.toggleNeuralField);
  const activeSubagents = useSessionStore((s) => s.activeSubagents);
  const runningAgents = Object.values(activeSubagents).reduce(
    (sum, agents) => sum + agents.length,
    0
  );

  const projectPath = activeProject?.path ?? "";
  const projectName = activeProject?.name ?? "No project";

  // For worktrees: find the main project (non-worktree sibling in the same parent dir)
  const parentProject = activeProject?.isWorktree
    ? projects.find(
        (p) =>
          !p.isWorktree &&
          getParentDir(p.path) === getParentDir(activeProject.path)
      )
    : null;

  const { data: branch } = useGitCurrentBranch(projectPath);
  const { data: gitStatus } = useGitStatus(projectPath);

  const currentBranch = branch ?? "main";
  const changeCount =
    (gitStatus?.staged?.length ?? 0) +
    (gitStatus?.unstaged?.length ?? 0) +
    (gitStatus?.untracked?.length ?? 0);

  return (
    <div
      className={cn(
        "flex items-center justify-between",
        "h-7 px-4 bg-bg-surface",
        "text-xs text-text-secondary select-none shrink-0"
      )}
    >
      {/* Left items */}
      <div className="flex items-center gap-3">
        {activeProject?.isWorktree && parentProject ? (
          <span className="flex items-center gap-1">
            <button
              onClick={() => setActiveProject(parentProject.id)}
              className="text-text-muted hover:text-accent-primary transition-colors"
              title={`Switch to ${parentProject.name}`}
            >
              {parentProject.name}
            </button>
            <span className="text-text-muted">→</span>
            <span className="text-accent-primary">{projectName}</span>
          </span>
        ) : (
          <span className="text-accent-primary">{projectName}</span>
        )}
        {activeTab && (
          <span className="text-text-secondary">{activeTab.title}</span>
        )}
        <span className="flex items-center gap-1">
          <GitBranch size={10} />
          {currentBranch}
        </span>
        <span>{changeCount} changes</span>
      </div>

      {/* Right items */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleNeuralField}
          className="hover:text-accent-primary transition-colors"
          title="Neural Field (Ctrl+Shift+Space)"
        >
          {runningAgents} agents
        </button>
        <span>0 unread</span>
        <span className="text-status-success">&#x25CF;</span>
        <span>Ready</span>
      </div>
    </div>
  );
}

export const StatusBar = memo(StatusBarComponent);
