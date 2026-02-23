import { useEffect } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useActiveProjectTabs } from "@/hooks/useActiveProjectTabs";
import { useProjectsStore } from "@/stores/projectsStore";

export function useKeyBindings() {
  const ui = useUIStore();
  const session = useSessionStore();
  const settings = useSettingsStore();
  const { openTabs, activeTabId, projectId } = useActiveProjectTabs();
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Don't intercept when typing in inputs/textareas
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Command palette -- always intercept
      if (ctrl && e.key === "p" && !shift) {
        e.preventDefault();
        ui.openCommandPalette();
        return;
      }

      // Escape -- close palette
      if (e.key === "Escape") {
        if (ui.commandPaletteOpen) {
          e.preventDefault();
          ui.closeCommandPalette();
          return;
        }
      }

      if (inInput) return;

      if (!ctrl) return;

      switch (e.key) {
        // Panels
        case "b":
          e.preventDefault();
          if (shift) ui.toggleRightPanel();
          else ui.toggleSidebar();
          break;
        case "B":
          if (shift) {
            e.preventDefault();
            ui.toggleRightPanel();
          }
          break;
        case "j":
          e.preventDefault();
          ui.toggleBottomPanel();
          break;

        // Sidebar views — now only 3 views
        case "1":
          e.preventDefault();
          ui.setSidebarView("sessions");
          if (!ui.sidebarOpen) ui.toggleSidebar();
          break;
        case "2":
          e.preventDefault();
          ui.setSidebarView("git");
          if (!ui.sidebarOpen) ui.toggleSidebar();
          break;
        case "3":
          e.preventDefault();
          ui.setSidebarView("prs");
          if (!ui.sidebarOpen) ui.toggleSidebar();
          break;

        // Tabs
        case "n":
          if (!shift) {
            e.preventDefault();
            if (projectId) {
              const id = `session-${Date.now()}`;
              session.openTab(
                { id, title: "New Session", projectDir: activeProject?.path ?? "", spawnedAt: Date.now() },
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
                session.resumeTab(activeTabId, projectId);
              }
            }
          }
          break;
        case "w":
          e.preventDefault();
          if (activeTabId && projectId) session.closeTab(activeTabId, projectId);
          break;
        case "Tab":
          e.preventDefault();
          {
            if (openTabs.length < 2) break;
            const idx = openTabs.findIndex((t) => t.id === activeTabId);
            const next = shift
              ? openTabs[(idx - 1 + openTabs.length) % openTabs.length]
              : openTabs[(idx + 1) % openTabs.length];
            session.setActiveTab(next.id, projectId);
          }
          break;

        // Git bottom panel shortcut
        case "G":
          if (shift) {
            e.preventDefault();
            ui.setBottomTab("git");
            if (!ui.bottomPanelOpen) ui.toggleBottomPanel();
          }
          break;

        // Debug panel (dev only)
        case "D":
          if (shift && import.meta.env.DEV) {
            e.preventDefault();
            ui.toggleDebugPanel();
          }
          break;

        // Settings
        case ",":
          e.preventDefault();
          if (projectId) session.openSettingsTab(projectId);
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
        case "+":
          e.preventDefault();
          settings.setFontSize(Math.min(settings.fontSize + 1, 24));
          break;
        case "-":
          e.preventDefault();
          settings.setFontSize(Math.max(settings.fontSize - 1, 8));
          break;
        case "0":
          e.preventDefault();
          settings.setFontSize(13);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ui, session, settings, openTabs, activeTabId, projectId, activeProject]);
}
