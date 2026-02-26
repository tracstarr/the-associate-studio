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
    <div className="flex flex-1 overflow-hidden p-1.5 gap-1.5 bg-bg-base">
      <ActivityBar />

      <PanelGroup direction="vertical" className="flex-1 overflow-hidden gap-1.5">
        {/* Top section: sidebar + main + right panel */}
        <Panel minSize={30}>
          <PanelGroup direction="horizontal" className="flex-1 gap-1.5">
            {sidebarOpen && (
              <>
                <Panel defaultSize={18} minSize={10} maxSize={30}>
                  <div className="h-full rounded-xl overflow-hidden bg-bg-surface" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
                    <Sidebar />
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 rounded-full hover:bg-accent-primary/60 transition-all duration-200" />
              </>
            )}

            <Panel
              defaultSize={
                sidebarOpen && rightPanelOpen ? 52 : sidebarOpen || rightPanelOpen ? 70 : 100
              }
              minSize={30}
            >
              <div className="relative w-full h-full rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
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
                <PanelResizeHandle className="w-1 rounded-full hover:bg-accent-primary/60 transition-all duration-200" />
                <Panel defaultSize={25} minSize={15} maxSize={40}>
                  <div className="h-full rounded-xl overflow-hidden bg-bg-surface" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
                    <RightPanel />
                  </div>
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>

        {/* Bottom panel — sits between the two activity bars */}
        {bottomPanelOpen && (
          <>
            <PanelResizeHandle className="h-1 rounded-full hover:bg-accent-primary/60 cursor-row-resize transition-all duration-200" />
            <Panel defaultSize={25} minSize={10} maxSize={60}>
              <div className="h-full rounded-xl overflow-hidden bg-bg-surface" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
                <BottomPanel />
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>

      <RightActivityBar />
    </div>
  );
}

export const IDELayout = memo(IDELayoutComponent);
