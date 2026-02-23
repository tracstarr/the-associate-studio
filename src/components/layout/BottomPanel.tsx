import { memo } from "react";
import { cn } from "@/lib/utils";
import { useUIStore, type BottomTab } from "@/stores/uiStore";
import { DiffViewer } from "@/components/git/DiffViewer";
import { GitLogPanel } from "@/components/git/GitLogPanel";
import { PRListPanel } from "@/components/issues/PRListPanel";
import { IssueListPanel } from "@/components/issues/IssueListPanel";

const tabs: { id: BottomTab; label: string }[] = [
  { id: "log", label: "Log" },
  { id: "git", label: "Diff" },
  { id: "prs", label: "PRs" },
  { id: "issues", label: "Issues" },
  { id: "output", label: "Output" },
];

const tabPlaceholders: Record<BottomTab, string> = {
  log: "Select a project to view git log.",
  git: "Select a file from the Git panel to view its diff.",
  prs: "No pull requests.",
  issues: "No issues.",
  output: "No output.",
};

function BottomPanelComponent() {
  const activeTab = useUIStore((s) => s.activeBottomTab);
  const setTab = useUIStore((s) => s.setBottomTab);
  const selectedDiffFile = useUIStore((s) => s.selectedDiffFile);

  return (
    <div className="flex flex-col h-full bg-bg-surface">
      {/* Tab strip */}
      <div className="flex items-center h-8 border-b border-border-default/60 px-1 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              "px-3 py-1 text-xs rounded-lg transition-colors",
              activeTab === tab.id
                ? "text-text-primary bg-bg-overlay"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "log" ? (
        <div className="flex-1 overflow-hidden">
          <GitLogPanel />
        </div>
      ) : activeTab === "git" && selectedDiffFile ? (
        <div className="flex-1 overflow-auto">
          <DiffViewer
            cwd={selectedDiffFile.cwd}
            filePath={selectedDiffFile.path}
            staged={selectedDiffFile.staged}
          />
        </div>
      ) : activeTab === "prs" ? (
        <div className="flex-1 overflow-hidden">
          <PRListPanel />
        </div>
      ) : activeTab === "issues" ? (
        <div className="flex-1 overflow-hidden">
          <IssueListPanel />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-text-muted text-center">
            {tabPlaceholders[activeTab]}
          </p>
        </div>
      )}
    </div>
  );
}

export const BottomPanel = memo(BottomPanelComponent);
