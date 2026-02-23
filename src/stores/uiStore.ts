import { create } from "zustand";

export type SidebarView = "sessions" | "git" | "prs" | "files";
export type RightTab = "context" | "teams" | "plans";
export type BottomTab = "log" | "git" | "prs" | "issues" | "output";

export interface SelectedDiffFile {
  cwd: string;
  path: string;
  staged: boolean;
}

interface UIStore {
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;
  activeSidebarView: SidebarView;
  activeRightTab: RightTab;
  activeBottomTab: BottomTab;
  commandPaletteOpen: boolean;
  selectedDiffFile: SelectedDiffFile | null;
  debugPanelOpen: boolean;
  projectDropdownOpen: boolean;
  tabInitStatus: Record<string, 'initializing' | 'error'>;
  tabInitError: Record<string, string>;
  tabReloadKey: Record<string, number>;

  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  setSidebarView: (view: SidebarView) => void;
  setRightTab: (tab: RightTab) => void;
  setBottomTab: (tab: BottomTab) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setSelectedDiffFile: (file: SelectedDiffFile | null) => void;
  toggleDebugPanel: () => void;
  openProjectDropdown: () => void;
  closeProjectDropdown: () => void;
  setTabInitStatus: (tabId: string, status: 'initializing' | 'error' | null) => void;
  setTabInitError: (tabId: string, error: string | null) => void;
  bumpReloadKey: (tabId: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  rightPanelOpen: true,
  bottomPanelOpen: true,
  activeSidebarView: "sessions",
  activeRightTab: "context",
  activeBottomTab: "git",
  commandPaletteOpen: false,
  selectedDiffFile: null,
  debugPanelOpen: false,
  projectDropdownOpen: false,
  tabInitStatus: {},
  tabInitError: {},
  tabReloadKey: {},

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  setSidebarView: (view) => set({ activeSidebarView: view, sidebarOpen: true }),
  setRightTab: (tab) => set({ activeRightTab: tab }),
  setBottomTab: (tab) => set({ activeBottomTab: tab }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  setSelectedDiffFile: (file) => set({ selectedDiffFile: file }),
  toggleDebugPanel: () => set((s) => ({ debugPanelOpen: !s.debugPanelOpen })),
  openProjectDropdown: () => set({ projectDropdownOpen: true }),
  closeProjectDropdown: () => set({ projectDropdownOpen: false }),
  setTabInitStatus: (tabId, status) =>
    set((s) => {
      const next = { ...s.tabInitStatus };
      if (status === null) {
        delete next[tabId];
      } else {
        next[tabId] = status;
      }
      return { tabInitStatus: next };
    }),
  setTabInitError: (tabId, error) =>
    set((s) => {
      const next = { ...s.tabInitError };
      if (error === null) {
        delete next[tabId];
      } else {
        next[tabId] = error;
      }
      return { tabInitError: next };
    }),
  bumpReloadKey: (tabId) =>
    set((s) => ({
      tabReloadKey: { ...s.tabReloadKey, [tabId]: (s.tabReloadKey[tabId] ?? 0) + 1 },
    })),
}));
