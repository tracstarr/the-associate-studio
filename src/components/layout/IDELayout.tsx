import { memo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useUIStore } from "@/stores/uiStore";
import { ActivityBar } from "@/components/shell/ActivityBar";
import { Sidebar } from "./Sidebar";
import { MainArea } from "./MainArea";
import { RightPanel } from "./RightPanel";

function IDELayoutComponent() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Activity Bar - fixed width */}
      <ActivityBar />

      {/* Resizable panel layout */}
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <Panel defaultSize={18} minSize={10} maxSize={30}>
              <Sidebar />
            </Panel>
            <PanelResizeHandle className="w-px bg-border-default hover:bg-accent-primary transition-colors" />
          </>
        )}

        {/* Main content area */}
        <Panel defaultSize={sidebarOpen && rightPanelOpen ? 52 : sidebarOpen || rightPanelOpen ? 70 : 100} minSize={30}>
          <MainArea />
        </Panel>

        {/* Right panel */}
        {rightPanelOpen && (
          <>
            <PanelResizeHandle className="w-px bg-border-default hover:bg-accent-primary transition-colors" />
            <Panel defaultSize={25} minSize={15} maxSize={40}>
              <RightPanel />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
}

export const IDELayout = memo(IDELayoutComponent);
