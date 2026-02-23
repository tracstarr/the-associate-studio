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
  return [
    // -- View --
    {
      id: "view.toggle-sidebar",
      label: "Toggle Sidebar",
      category: "View",
      keybinding: "Ctrl+B",
      action: () => useUIStore.getState().toggleSidebar(),
    },
    {
      id: "view.toggle-right-panel",
      label: "Toggle Right Panel",
      category: "View",
      keybinding: "Ctrl+Shift+B",
      action: () => useUIStore.getState().toggleRightPanel(),
    },
    {
      id: "view.toggle-bottom-panel",
      label: "Toggle Bottom Panel",
      category: "View",
      keybinding: "Ctrl+J",
      action: () => useUIStore.getState().toggleBottomPanel(),
    },
    {
      id: "view.show-sessions",
      label: "Show Projects & Sessions",
      category: "View",
      keybinding: "Ctrl+1",
      action: () => {
        const u = useUIStore.getState();
        u.setSidebarView("sessions");
        if (!u.sidebarOpen) u.toggleSidebar();
      },
    },
    {
      id: "view.show-git",
      label: "Show Git",
      category: "View",
      keybinding: "Ctrl+2",
      action: () => {
        const u = useUIStore.getState();
        u.setSidebarView("git");
        if (!u.sidebarOpen) u.toggleSidebar();
      },
    },
    {
      id: "view.show-prs",
      label: "Show PRs",
      category: "View",
      keybinding: "Ctrl+3",
      action: () => {
        const u = useUIStore.getState();
        u.setSidebarView("prs");
        if (!u.sidebarOpen) u.toggleSidebar();
      },
    },
    {
      id: "view.right.context",
      label: "Right Panel: Context",
      category: "View",
      action: () => {
        const u = useUIStore.getState();
        u.setRightTab("context");
        if (!u.rightPanelOpen) u.toggleRightPanel();
      },
    },
    {
      id: "view.right.teams",
      label: "Right Panel: Teams",
      category: "View",
      action: () => {
        const u = useUIStore.getState();
        u.setRightTab("teams");
        if (!u.rightPanelOpen) u.toggleRightPanel();
      },
    },
    {
      id: "view.right.plans",
      label: "Right Panel: Plans",
      category: "View",
      action: () => {
        const u = useUIStore.getState();
        u.setRightTab("plans");
        if (!u.rightPanelOpen) u.toggleRightPanel();
      },
    },
    {
      id: "view.bottom.git",
      label: "Bottom Panel: Git",
      category: "View",
      keybinding: "Ctrl+Shift+G",
      action: () => {
        const u = useUIStore.getState();
        u.setBottomTab("git");
        if (!u.bottomPanelOpen) u.toggleBottomPanel();
      },
    },
    {
      id: "view.bottom.prs",
      label: "Bottom Panel: PRs",
      category: "View",
      action: () => {
        const u = useUIStore.getState();
        u.setBottomTab("prs");
        if (!u.bottomPanelOpen) u.toggleBottomPanel();
      },
    },
    {
      id: "view.bottom.issues",
      label: "Bottom Panel: Issues",
      category: "View",
      action: () => {
        const u = useUIStore.getState();
        u.setBottomTab("issues");
        if (!u.bottomPanelOpen) u.toggleBottomPanel();
      },
    },
    {
      id: "view.bottom.output",
      label: "Bottom Panel: Output",
      category: "View",
      action: () => {
        const u = useUIStore.getState();
        u.setBottomTab("output");
        if (!u.bottomPanelOpen) u.toggleBottomPanel();
      },
    },
    {
      id: "view.neural-field",
      label: "Toggle Neural Field",
      description: "Open mission control overlay",
      category: "View",
      keybinding: "Ctrl+Shift+Space",
      action: () => useUIStore.getState().toggleNeuralField(),
    },

    // -- Session --
    {
      id: "session.new",
      label: "New Claude Session",
      description: "Open a new terminal with Claude CLI",
      category: "Session",
      keybinding: "Ctrl+N",
      action: () => {
        const { activeProjectId, projects: allProjects } = useProjectsStore.getState();
        if (!activeProjectId) return;
        const proj = allProjects.find((p) => p.id === activeProjectId);
        const id = `session-${Date.now()}`;
        useSessionStore.getState().openTab(
          { id, title: "New Session", projectDir: proj?.path ?? "", spawnedAt: Date.now() },
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
        const pid = useProjectsStore.getState().activeProjectId ?? "";
        if (!pid) return;
        const s = useSessionStore.getState();
        const activeTabId = s.activeTabByProject[pid] ?? null;
        if (activeTabId) s.closeTab(activeTabId, pid);
      },
    },
    {
      id: "session.resume",
      label: "Resume Session",
      description: "Resume the current session-view tab as a terminal",
      category: "Session",
      keybinding: "Ctrl+R",
      action: () => {
        const pid = useProjectsStore.getState().activeProjectId ?? "";
        if (!pid) return;
        const s = useSessionStore.getState();
        const currentTabId = s.activeTabByProject[pid] ?? null;
        if (!currentTabId) return;
        const tabs = s.tabsByProject[pid] ?? [];
        const activeTab = tabs.find((t) => t.id === currentTabId);
        if (activeTab?.type === "session-view") {
          s.resumeTab(currentTabId, pid);
        }
      },
    },
    {
      id: "session.next",
      label: "Next Tab",
      category: "Session",
      keybinding: "Ctrl+Tab",
      action: () => {
        const pid = useProjectsStore.getState().activeProjectId ?? "";
        if (!pid) return;
        const s = useSessionStore.getState();
        const tabs = s.tabsByProject[pid] ?? [];
        if (tabs.length < 2) return;
        const activeTabId = s.activeTabByProject[pid] ?? null;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const next = tabs[(idx + 1) % tabs.length];
        s.setActiveTab(next.id, pid);
      },
    },
    {
      id: "session.prev",
      label: "Previous Tab",
      category: "Session",
      keybinding: "Ctrl+Shift+Tab",
      action: () => {
        const pid = useProjectsStore.getState().activeProjectId ?? "";
        if (!pid) return;
        const s = useSessionStore.getState();
        const tabs = s.tabsByProject[pid] ?? [];
        if (tabs.length < 2) return;
        const activeTabId = s.activeTabByProject[pid] ?? null;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
        s.setActiveTab(prev.id, pid);
      },
    },

    // -- Project --
    {
      id: "project.next",
      label: "Next Project",
      category: "Project",
      keybinding: "Ctrl+Shift+→",
      action: () => useProjectsStore.getState().cycleProject(1),
    },
    {
      id: "project.prev",
      label: "Previous Project",
      category: "Project",
      keybinding: "Ctrl+Shift+←",
      action: () => useProjectsStore.getState().cycleProject(-1),
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
      action: () => {
        const s = useSettingsStore.getState();
        s.setFontSize(Math.min(s.fontSize + 1, 24));
      },
    },
    {
      id: "settings.font-size.decrease",
      label: "Decrease Font Size",
      category: "Settings",
      keybinding: "Ctrl+-",
      action: () => {
        const s = useSettingsStore.getState();
        s.setFontSize(Math.max(s.fontSize - 1, 8));
      },
    },
    {
      id: "settings.font-size.reset",
      label: "Reset Font Size",
      category: "Settings",
      keybinding: "Ctrl+0",
      action: () => useSettingsStore.getState().setFontSize(13),
    },
  ];
}
