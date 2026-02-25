import { useEffect } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useActiveProjectTabs } from "@/hooks/useActiveProjectTabs";
import { useProjectsStore } from "@/stores/projectsStore";

export function useKeyBindings() {
  const { openTabs, activeTabId, projectId } = useActiveProjectTabs();
  const activeProjectPath = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? ""
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      const target = e.target as HTMLElement;
      const isXtermFocused = !!target.closest?.(".xterm");
      const inRegularInput =
        !isXtermFocused &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Command palette -- always intercept
      if (ctrl && e.key === "p" && !shift) {
        e.preventDefault();
        useUIStore.getState().openCommandPalette();
        return;
      }

      // Neural Field -- always intercept
      if (ctrl && shift && e.key === " ") {
        e.preventDefault();
        useUIStore.getState().toggleNeuralField();
        return;
      }

      // Escape -- close overlays in priority order
      if (e.key === "Escape") {
        const ui = useUIStore.getState();
        if (ui.neuralFieldOpen) {
          e.preventDefault();
          ui.toggleNeuralField();
          return;
        }
        if (ui.commandPaletteOpen) {
          e.preventDefault();
          ui.closeCommandPalette();
          return;
        }
      }

      // Block everything in regular inputs
      if (inRegularInput) return;

      // In xterm: only terminal-safe keybindings pass through
      if (isXtermFocused) {
        const isTerminalSafe =
          (ctrl && e.key === "Tab") ||
          (ctrl && shift && e.key === "ArrowRight") ||
          (ctrl && shift && e.key === "ArrowLeft") ||
          (ctrl && shift && e.key === "b") ||
          (ctrl && (e.key === "=" || e.key === "+" || e.key === "-" || e.key === "0"));
        if (!isTerminalSafe) return;
      }

      if (!ctrl) return;

      switch (e.key) {
        // Panels
        case "b":
          e.preventDefault();
          if (shift) useUIStore.getState().toggleRightPanel();
          else useUIStore.getState().toggleSidebar();
          break;
        case "j":
          e.preventDefault();
          useUIStore.getState().toggleBottomPanel();
          break;

        // Sidebar views — now only 3 views
        case "1": {
          e.preventDefault();
          const ui = useUIStore.getState();
          ui.setSidebarView("sessions");
          if (!ui.sidebarOpen) ui.toggleSidebar();
          break;
        }
        case "2": {
          e.preventDefault();
          const ui = useUIStore.getState();
          ui.setSidebarView("git");
          if (!ui.sidebarOpen) ui.toggleSidebar();
          break;
        }
        case "3": {
          e.preventDefault();
          const ui = useUIStore.getState();
          ui.setSidebarView("prs");
          if (!ui.sidebarOpen) ui.toggleSidebar();
          break;
        }

        // Tabs
        case "n":
          if (!shift) {
            e.preventDefault();
            if (projectId) {
              const id = `session-${Date.now()}`;
              useSessionStore.getState().openTab(
                { id, title: "New Session", projectDir: activeProjectPath, spawnedAt: Date.now() },
                projectId
              );
            }
          }
          break;
        case "r":
          if (!shift) {
            e.preventDefault();
            if (activeTabId && projectId) {
              const activeTab = openTabs.find((t) => t.id === activeTabId);
              if (activeTab?.type === "session-view") {
                useSessionStore.getState().resumeTab(activeTabId, projectId);
              }
            }
          }
          break;
        case "w":
          e.preventDefault();
          if (activeTabId && projectId) useSessionStore.getState().closeTab(activeTabId, projectId);
          break;
        case "Tab":
          e.preventDefault();
          {
            if (openTabs.length < 2) break;
            const idx = openTabs.findIndex((t) => t.id === activeTabId);
            const next = shift
              ? openTabs[(idx - 1 + openTabs.length) % openTabs.length]
              : openTabs[(idx + 1) % openTabs.length];
            useSessionStore.getState().setActiveTab(next.id, projectId);
          }
          break;

        // Git bottom panel shortcut
        case "G":
          if (shift) {
            e.preventDefault();
            const ui = useUIStore.getState();
            ui.setBottomTab("git");
            if (!ui.bottomPanelOpen) ui.toggleBottomPanel();
          }
          break;

        // Debug panel (dev only)
        case "D":
          if (shift && import.meta.env.DEV) {
            e.preventDefault();
            useUIStore.getState().toggleDebugPanel();
          }
          break;

        // Settings
        case ",":
          e.preventDefault();
          if (projectId) useSessionStore.getState().openSettingsTab(projectId);
          break;

        // Project cycling
        case "ArrowRight":
          if (shift) {
            e.preventDefault();
            useProjectsStore.getState().cycleProject(1);
          }
          break;
        case "ArrowLeft":
          if (shift) {
            e.preventDefault();
            useProjectsStore.getState().cycleProject(-1);
          }
          break;

        // Font size
        case "=":
        case "+": {
          e.preventDefault();
          const s = useSettingsStore.getState();
          s.setFontSize(Math.min(s.fontSize + 1, 24));
          break;
        }
        case "-": {
          e.preventDefault();
          const s = useSettingsStore.getState();
          s.setFontSize(Math.max(s.fontSize - 1, 8));
          break;
        }
        case "0":
          e.preventDefault();
          useSettingsStore.getState().setFontSize(13);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openTabs, activeTabId, projectId, activeProjectPath]);
}
