import { memo } from "react";
import { Brain, Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore, type RightTab } from "@/stores/uiStore";

interface RightActivityItem {
  id: RightTab;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}

const rightItems: RightActivityItem[] = [
  { id: "context", icon: Brain, label: "Context" },
  { id: "teams", icon: Users, label: "Teams" },
  { id: "plans", icon: FileText, label: "Plans" },
];

function RightActivityBarComponent() {
  const activeRightTab = useUIStore((s) => s.activeRightTab);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const setRightTab = useUIStore((s) => s.setRightTab);

  const handleClick = (tabId: RightTab) => {
    if (rightPanelOpen && activeRightTab === tabId) {
      toggleRightPanel();
    } else {
      setRightTab(tabId);
      if (!rightPanelOpen) toggleRightPanel();
    }
  };

  return (
    <div className="flex flex-col items-center w-12 bg-bg-base py-3 shrink-0">
      <div className="flex flex-col items-center gap-2">
        {rightItems.map((item) => {
          const isActive = rightPanelOpen && activeRightTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
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
                <div className="absolute right-0 top-2 bottom-2 w-[3px] rounded-l-full bg-actbar-indicator" style={{ boxShadow: "0 0 6px rgba(212,168,83,0.4)" }} />
              )}
              <Icon size={20} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const RightActivityBar = memo(RightActivityBarComponent);
