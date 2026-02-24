import { memo } from "react";
import { useUIStore } from "@/stores/uiStore";
import { ContextPanel } from "@/components/context/ContextPanel";
import { TeamsRightPanel } from "@/components/context/TeamsRightPanel";
import { PlansPanel } from "@/components/context/PlansPanel";

function RightPanelComponent() {
  const activeTab = useUIStore((s) => s.activeRightTab);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-2.5 text-xs font-semibold text-accent-primary border-b border-border-muted capitalize shrink-0">
        {activeTab}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === "context" && <ContextPanel />}
        {activeTab === "teams" && <TeamsRightPanel />}
        {activeTab === "plans" && <PlansPanel />}
      </div>
    </div>
  );
}

export const RightPanel = memo(RightPanelComponent);
