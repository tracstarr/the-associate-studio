import { memo } from "react";
import { FolderOpen, GitBranch, GitPullRequest, FolderTree, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore, type SidebarView } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectsStore } from "@/stores/projectsStore";

interface ActivityItem {
  id: SidebarView;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}

const topItems: ActivityItem[] = [
  { id: "sessions", icon: FolderOpen, label: "Projects & Sessions" },
  { id: "git", icon: GitBranch, label: "Git" },
  { id: "files", icon: FolderTree, label: "Files" },
  { id: "prs", icon: GitPullRequest, label: "Pull Requests" },
];

function ActivityBarComponent() {
  const activeSidebarView = useUIStore((s) => s.activeSidebarView);
  const setSidebarView = useUIStore((s) => s.setSidebarView);
  const openSettingsTab = useSessionStore((s) => s.openSettingsTab);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);

  return (
    <div className="flex flex-col items-center justify-between w-12 bg-bg-base border-r border-border-default py-2">
      {/* Top icons */}
      <div className="flex flex-col items-center gap-1">
        {topItems.map((item) => {
          const isActive = activeSidebarView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setSidebarView(item.id)}
              title={item.label}
              className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-md transition-colors",
                isActive
                  ? "text-actbar-icon-active"
                  : "text-actbar-icon-default hover:text-text-secondary"
              )}
              aria-label={item.label}
            >
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-actbar-indicator" />
              )}
              <Icon size={22} />
            </button>
          );
        })}
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center">
        <button
          title="Settings (Ctrl+,)"
          onClick={() => { if (activeProjectId) openSettingsTab(activeProjectId); }}
          className="flex items-center justify-center w-10 h-10 rounded-md text-actbar-icon-default hover:text-text-secondary transition-colors"
          aria-label="Settings"
        >
          <Settings size={22} />
        </button>
      </div>
    </div>
  );
}

export const ActivityBar = memo(ActivityBarComponent);
