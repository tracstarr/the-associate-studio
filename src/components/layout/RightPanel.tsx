import { memo } from "react";
import { cn } from "@/lib/utils";
import { useUIStore, type RightTab } from "@/stores/uiStore";
import { ContextPanel } from "@/components/context/ContextPanel";
import { TeamsRightPanel } from "@/components/context/TeamsRightPanel";
import { InboxRightPanel } from "@/components/context/InboxRightPanel";
import { PlansPanel } from "@/components/context/PlansPanel";

const tabs: { id: RightTab; label: string }[] = [
  { id: "context", label: "Context" },
  { id: "teams", label: "Teams" },
  { id: "inbox", label: "Inbox" },
  { id: "plans", label: "Plans" },
];

function RightPanelComponent() {
  const activeTab = useUIStore((s) => s.activeRightTab);
  const setTab = useUIStore((s) => s.setRightTab);

  return (
    <div className="flex flex-col h-full bg-bg-surface">
      {/* Tab strip */}
      <div className="flex items-center h-9 border-b border-border-default px-1 gap-1 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              "px-3 py-1 text-xs rounded transition-colors",
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
      <div className="flex-1 overflow-hidden">
        {activeTab === "context" && <ContextPanel />}
        {activeTab === "teams" && <TeamsRightPanel />}
        {activeTab === "inbox" && <InboxRightPanel />}
        {activeTab === "plans" && <PlansPanel />}
      </div>
    </div>
  );
}

export const RightPanel = memo(RightPanelComponent);
