import { memo } from "react";
import { useUIStore } from "@/stores/uiStore";
import { ContextPanel } from "@/components/context/ContextPanel";
import { TeamsRightPanel } from "@/components/context/TeamsRightPanel";
import { InboxRightPanel } from "@/components/context/InboxRightPanel";
import { PlansPanel } from "@/components/context/PlansPanel";

function RightPanelComponent() {
  const activeTab = useUIStore((s) => s.activeRightTab);

  return (
    <div className="flex flex-col h-full bg-bg-surface">
      <div className="px-3 py-1.5 text-xs font-semibold text-text-muted border-b border-border-default capitalize shrink-0">
        {activeTab}
      </div>
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
