import { memo } from "react";
import { useUIStore } from "@/stores/uiStore";
import { ContextPanel } from "@/components/context/ContextPanel";
import { TeamsRightPanel } from "@/components/context/TeamsRightPanel";
import { PlansPanel } from "@/components/context/PlansPanel";
import { DocsSection } from "@/components/context/DocsSection";
import { useProjectsStore } from "@/stores/projectsStore";

function DocsTabPanel() {
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const activeProjectId = useProjectsStore((s) => s.activeProjectId ?? "");
  if (!activeProject) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        Open a project to browse docs
      </div>
    );
  }
  return (
    <DocsSection
      activeProjectDir={activeProject.path}
      activeProjectId={activeProjectId}
    />
  );
}

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
        {activeTab === "docs" && <DocsTabPanel />}
      </div>
    </div>
  );
}

export const RightPanel = memo(RightPanelComponent);
