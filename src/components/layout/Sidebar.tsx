import { memo } from "react";
import { useUIStore, type SidebarView } from "@/stores/uiStore";
import { GitStatusPanel } from "@/components/git/GitStatusPanel";
import { PRListPanel } from "@/components/issues/PRListPanel";
import { ProjectSwitcher } from "@/components/projects/ProjectSwitcher";
import { FileBrowserPanel } from "@/components/files/FileBrowserPanel";

const viewLabels: Record<SidebarView, string> = {
  sessions: "Projects",
  git: "Git",
  prs: "Pull Requests",
  files: "Files",
};

function SidebarComponent() {
  const activeView = useUIStore((s) => s.activeSidebarView);

  return (
    <div className="flex flex-col h-full bg-bg-surface">
      {/* Header */}
      <div className="flex items-center h-9 px-4 border-b border-border-default shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {viewLabels[activeView]}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === "sessions" && <ProjectSwitcher />}
        {activeView === "git" && <GitStatusPanel />}
        {activeView === "prs" && <PRListPanel />}
        {activeView === "files" && <FileBrowserPanel />}
      </div>
    </div>
  );
}

export const Sidebar = memo(SidebarComponent);
