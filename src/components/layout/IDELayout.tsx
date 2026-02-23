import { memo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { ActivityBar } from "@/components/shell/ActivityBar";
import { RightActivityBar } from "@/components/shell/RightActivityBar";
import { Sidebar } from "./Sidebar";
import { MainArea } from "./MainArea";
import { RightPanel } from "./RightPanel";
import { BottomPanel } from "./BottomPanel";

function IDELayoutComponent() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const bottomPanelOpen = useUIStore((s) => s.bottomPanelOpen);
  const tabsByProject = useSessionStore((s) => s.tabsByProject);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);

  const projectIds = [
    ...new Set([...Object.keys(tabsByProject), activeProjectId ?? ""].filter(Boolean)),
  ];

  return (
    <PanelGroup direction="vertical" className="flex-1 overflow-hidden">
      {/* Top section: activity bars + sidebar + main + right panel */}
      <Panel minSize={30}>
        <div className="flex h-full overflow-hidden">
          <ActivityBar />

          <PanelGroup direction="horizontal" className="flex-1">
            {sidebarOpen && (
              <>
                <Panel defaultSize={18} minSize={10} maxSize={30}>
                  <Sidebar />
                </Panel>
                <PanelResizeHandle className="w-px bg-border-default/40 hover:bg-accent-primary transition-colors" />
              </>
            )}

            <Panel
              defaultSize={
                sidebarOpen && rightPanelOpen ? 52 : sidebarOpen || rightPanelOpen ? 70 : 100
              }
              minSize={30}
            >
              <div className="relative w-full h-full">
                {projectIds.map((pid) => (
                  <div
                    key={pid}
                    className="absolute inset-0"
                    style={{ display: pid === activeProjectId ? "block" : "none" }}
                  >
                    <MainArea projectId={pid} />
                  </div>
                ))}
              </div>
            </Panel>

            {rightPanelOpen && (
              <>
                <PanelResizeHandle className="w-px bg-border-default/40 hover:bg-accent-primary transition-colors" />
                <Panel defaultSize={25} minSize={15} maxSize={40}>
                  <RightPanel />
                </Panel>
              </>
            )}
          </PanelGroup>

          <RightActivityBar />
        </div>
      </Panel>

      {/* Full-width bottom panel */}
      {bottomPanelOpen && (
        <>
          <PanelResizeHandle className="h-1 bg-border-default/30 hover:bg-accent-primary/50 cursor-row-resize transition-colors" />
          <Panel defaultSize={25} minSize={10} maxSize={60}>
            <BottomPanel />
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}

export const IDELayout = memo(IDELayoutComponent);
