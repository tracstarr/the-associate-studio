import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useProjectsStore } from "../stores/projectsStore";

export interface Command {
  id: string;
  label: string;
  description?: string;
  category: string;
  keybinding?: string;
  action: () => void;
}

export function buildCommands(): Command[] {
  const ui = useUIStore.getState();
  const session = useSessionStore.getState();
  const settings = useSettingsStore.getState();
  const projects = useProjectsStore.getState();
  const activeProjectId = projects.activeProjectId ?? "";
  const activeProject = projects.projects.find((p) => p.id === activeProjectId);

  return [
    // -- View --
    {
      id: "view.toggle-sidebar",
      label: "Toggle Sidebar",
      category: "View",
      keybinding: "Ctrl+B",
      action: () => ui.toggleSidebar(),
    },
    {
      id: "view.toggle-right-panel",
      label: "Toggle Right Panel",
      category: "View",
      keybinding: "Ctrl+Shift+B",
      action: () => ui.toggleRightPanel(),
    },
    {
      id: "view.toggle-bottom-panel",
      label: "Toggle Bottom Panel",
      category: "View",
      keybinding: "Ctrl+J",
      action: () => ui.toggleBottomPanel(),
    },
    {
      id: "view.show-sessions",
      label: "Show Projects & Sessions",
      category: "View",
      keybinding: "Ctrl+1",
      action: () => {
        ui.setSidebarView("sessions");
        if (!ui.sidebarOpen) ui.toggleSidebar();
      },
    },
    {
      id: "view.show-git",
      label: "Show Git",
      category: "View",
      keybinding: "Ctrl+2",
      action: () => {
        ui.setSidebarView("git");
        if (!ui.sidebarOpen) ui.toggleSidebar();
      },
    },
    {
      id: "view.show-prs",
      label: "Show PRs",
      category: "View",
      keybinding: "Ctrl+3",
      action: () => {
        ui.setSidebarView("prs");
        if (!ui.sidebarOpen) ui.toggleSidebar();
      },
    },
    {
      id: "view.right.context",
      label: "Right Panel: Context",
      category: "View",
      action: () => {
        ui.setRightTab("context");
        if (!ui.rightPanelOpen) ui.toggleRightPanel();
      },
    },
    {
      id: "view.right.teams",
      label: "Right Panel: Teams",
      category: "View",
      action: () => {
        ui.setRightTab("teams");
        if (!ui.rightPanelOpen) ui.toggleRightPanel();
      },
    },
    {
      id: "view.right.plans",
      label: "Right Panel: Plans",
      category: "View",
      action: () => {
        ui.setRightTab("plans");
        if (!ui.rightPanelOpen) ui.toggleRightPanel();
      },
    },
    {
      id: "view.bottom.git",
      label: "Bottom Panel: Git",
      category: "View",
      keybinding: "Ctrl+Shift+G",
      action: () => {
        ui.setBottomTab("git");
        if (!ui.bottomPanelOpen) ui.toggleBottomPanel();
      },
    },
    {
      id: "view.bottom.prs",
      label: "Bottom Panel: PRs",
      category: "View",
      action: () => {
        ui.setBottomTab("prs");
        if (!ui.bottomPanelOpen) ui.toggleBottomPanel();
      },
    },
    {
      id: "view.bottom.issues",
      label: "Bottom Panel: Issues",
      category: "View",
      action: () => {
        ui.setBottomTab("issues");
        if (!ui.bottomPanelOpen) ui.toggleBottomPanel();
      },
    },
    {
      id: "view.bottom.output",
      label: "Bottom Panel: Output",
      category: "View",
      action: () => {
        ui.setBottomTab("output");
        if (!ui.bottomPanelOpen) ui.toggleBottomPanel();
      },
    },

    // -- Session --
    {
      id: "session.new",
      label: "New Claude Session",
      description: "Open a new terminal with Claude CLI",
      category: "Session",
      keybinding: "Ctrl+N",
      action: () => {
        if (!activeProjectId) return;
        const id = `session-${Date.now()}`;
        session.openTab(
          { id, title: "New Session", projectDir: activeProject?.path ?? "", spawnedAt: Date.now() },
          activeProjectId
        );
      },
    },
    {
      id: "session.close",
      label: "Close Current Tab",
      category: "Session",
      keybinding: "Ctrl+W",
      action: () => {
        if (!activeProjectId) return;
        const activeTabId = session.activeTabByProject[activeProjectId] ?? null;
        if (activeTabId) session.closeTab(activeTabId, activeProjectId);
      },
    },
    {
      id: "session.resume",
      label: "Resume Session",
      description: "Resume the current session-view tab as a terminal",
      category: "Session",
      keybinding: "Ctrl+R",
      action: () => {
        if (!activeProjectId) return;
        const currentTabId = useSessionStore.getState().activeTabByProject[activeProjectId] ?? null;
        if (!currentTabId) return;
        const tabs = useSessionStore.getState().tabsByProject[activeProjectId] ?? [];
        const activeTab = tabs.find((t) => t.id === currentTabId);
        if (activeTab?.type === "session-view") {
          useSessionStore.getState().resumeTab(currentTabId, activeProjectId);
        }
      },
    },
    {
      id: "session.next",
      label: "Next Tab",
      category: "Session",
      keybinding: "Ctrl+Tab",
      action: () => {
        if (!activeProjectId) return;
        const tabs = session.tabsByProject[activeProjectId] ?? [];
        if (tabs.length < 2) return;
        const activeTabId = session.activeTabByProject[activeProjectId] ?? null;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const next = tabs[(idx + 1) % tabs.length];
        session.setActiveTab(next.id, activeProjectId);
      },
    },
    {
      id: "session.prev",
      label: "Previous Tab",
      category: "Session",
      keybinding: "Ctrl+Shift+Tab",
      action: () => {
        if (!activeProjectId) return;
        const tabs = session.tabsByProject[activeProjectId] ?? [];
        if (tabs.length < 2) return;
        const activeTabId = session.activeTabByProject[activeProjectId] ?? null;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
        session.setActiveTab(prev.id, activeProjectId);
      },
    },

    // -- Project --
    {
      id: "project.next",
      label: "Next Project",
      category: "Project",
      keybinding: "Ctrl+Shift+→",
      action: () => projects.cycleProject(1),
    },
    {
      id: "project.prev",
      label: "Previous Project",
      category: "Project",
      keybinding: "Ctrl+Shift+←",
      action: () => projects.cycleProject(-1),
    },

    // -- Settings --
    {
      id: "settings.open",
      label: "Open Settings",
      category: "Settings",
      keybinding: "Ctrl+,",
      action: () => {
        const pid = useProjectsStore.getState().activeProjectId ?? "";
        if (pid) useSessionStore.getState().openSettingsTab(pid);
      },
    },
    {
      id: "settings.font-size.increase",
      label: "Increase Font Size",
      category: "Settings",
      keybinding: "Ctrl+=",
      action: () => settings.setFontSize(Math.min(settings.fontSize + 1, 24)),
    },
    {
      id: "settings.font-size.decrease",
      label: "Decrease Font Size",
      category: "Settings",
      keybinding: "Ctrl+-",
      action: () => settings.setFontSize(Math.max(settings.fontSize - 1, 8)),
    },
    {
      id: "settings.font-size.reset",
      label: "Reset Font Size",
      category: "Settings",
      keybinding: "Ctrl+0",
      action: () => settings.setFontSize(13),
    },
  ];
}
