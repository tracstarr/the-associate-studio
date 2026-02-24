import { memo } from "react";
import { FolderOpen, GitBranch, GitPullRequest, FolderTree, Settings, PanelBottomOpen, PanelBottomClose } from "lucide-react";
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
  const bottomPanelOpen = useUIStore((s) => s.bottomPanelOpen);
  const toggleBottomPanel = useUIStore((s) => s.toggleBottomPanel);
  const openSettingsTab = useSessionStore((s) => s.openSettingsTab);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);

  return (
    <div className="flex flex-col items-center justify-between w-12 bg-bg-base py-3">
      {/* Top icons */}
      <div className="flex flex-col items-center gap-2">
        {topItems.map((item) => {
          const isActive = activeSidebarView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setSidebarView(item.id)}
              title={item.label}
              className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                isActive
                  ? "text-actbar-icon-active bg-bg-raised"
                  : "text-actbar-icon-default hover:text-text-secondary hover:bg-bg-surface"
              )}
              aria-label={item.label}
            >
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-actbar-indicator" style={{ boxShadow: "0 0 6px rgba(212,168,83,0.4)" }} />
              )}
              <Icon size={20} />
            </button>
          );
        })}
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center gap-2">
        <button
          title="Toggle Bottom Panel (Ctrl+J)"
          onClick={toggleBottomPanel}
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
            bottomPanelOpen
              ? "text-actbar-icon-active bg-bg-raised"
              : "text-actbar-icon-default hover:text-text-secondary hover:bg-bg-surface"
          )}
          aria-label="Toggle Bottom Panel"
        >
          {bottomPanelOpen ? <PanelBottomClose size={20} /> : <PanelBottomOpen size={20} />}
        </button>
        <button
          title="Settings (Ctrl+,)"
          onClick={() => { if (activeProjectId) openSettingsTab(activeProjectId); }}
          className="flex items-center justify-center w-10 h-10 rounded-xl text-actbar-icon-default hover:text-text-secondary hover:bg-bg-surface transition-all duration-200"
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}

export const ActivityBar = memo(ActivityBarComponent);
