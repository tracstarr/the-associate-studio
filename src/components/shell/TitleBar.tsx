import { memo } from "react";
import { Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveProjectTabs } from "@/hooks/useActiveProjectTabs";
import { useProjectsStore } from "@/stores/projectsStore";

function TitleBarComponent() {
  const { openTabs, activeTabId } = useActiveProjectTabs();
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const breadcrumb = activeTab
    ? activeTab.title
    : activeProject
    ? activeProject.name
    : null;

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch {
      // not in Tauri context
    }
  };

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const isMaximized = await win.isMaximized();
      if (isMaximized) {
        await win.unmaximize();
      } else {
        await win.maximize();
      }
    } catch {
      // not in Tauri context
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch {
      // not in Tauri context
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between",
        "h-9 bg-bg-surface border-b border-border-default",
        "select-none shrink-0"
      )}
      data-tauri-drag-region
    >
      {/* Left: Logo + breadcrumb (draggable) */}
      <div className="flex flex-1 items-center gap-2 pl-4" data-tauri-drag-region>
        <div
          className="w-4 h-4 rounded-sm opacity-80 pointer-events-none"
          style={{ backgroundColor: "var(--color-accent-primary)" }}
        />
        <span className="text-accent-secondary font-semibold text-sm pointer-events-none">
          The Associate Studio
        </span>
        {breadcrumb && (
          <>
            <span className="text-text-muted text-xs pointer-events-none">/</span>
            <span className="text-text-primary text-xs pointer-events-none">{breadcrumb}</span>
          </>
        )}
      </div>

      {/* Right: Window controls */}
      <div className="flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-12 h-full text-text-secondary hover:bg-bg-overlay transition-colors"
          aria-label="Minimize"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-12 h-full text-text-secondary hover:bg-bg-overlay transition-colors"
          aria-label="Maximize"
        >
          <Square size={14} />
        </button>
        <button
          onClick={handleClose}
          className="flex items-center justify-center w-12 h-full text-text-secondary hover:bg-status-error hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export const TitleBar = memo(TitleBarComponent);
