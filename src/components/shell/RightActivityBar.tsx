import { memo } from "react";
import { Brain, Users, Mail, FileText } from "lucide-react";
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
  { id: "inbox", icon: Mail, label: "Inbox" },
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
    <div className="flex flex-col items-center w-12 bg-bg-base border-l border-border-default py-2 shrink-0">
      <div className="flex flex-col items-center gap-1">
        {rightItems.map((item) => {
          const isActive = rightPanelOpen && activeRightTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
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
                <div className="absolute right-0 top-1.5 bottom-1.5 w-0.5 rounded-l bg-actbar-indicator" />
              )}
              <Icon size={22} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const RightActivityBar = memo(RightActivityBarComponent);
