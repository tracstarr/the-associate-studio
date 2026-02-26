import { create } from "zustand";

export type SidebarView = "sessions" | "git" | "prs" | "issues" | "files";
export type RightTab = "context" | "teams" | "plans" | "docs" | "notes";
export type BottomTab = "log" | "output" | "debug";

export interface PendingNoteRef {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  quote: string;
}

interface UIStore {
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;
  activeSidebarView: SidebarView;
  activeRightTab: RightTab;
  activeBottomTab: BottomTab;
  commandPaletteOpen: boolean;
  neuralFieldOpen: boolean;
  projectDropdownOpen: boolean;
  tabInitStatus: Record<string, 'initializing' | 'error'>;
  tabInitError: Record<string, string>;
  tabReloadKey: Record<string, number>;
  pendingNoteRef: PendingNoteRef | null;
  pendingNoteId: string | null;
  pendingAttachToNoteId: string | null;
  activeNoteId: string | null;

  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  setSidebarView: (view: SidebarView) => void;
  setRightTab: (tab: RightTab) => void;
  setBottomTab: (tab: BottomTab) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleNeuralField: () => void;
  toggleDebugPanel: () => void;
  openProjectDropdown: () => void;
  closeProjectDropdown: () => void;
  setTabInitStatus: (tabId: string, status: 'initializing' | 'error' | null) => void;
  setTabInitError: (tabId: string, error: string | null) => void;
  bumpReloadKey: (tabId: string) => void;
  setPendingNoteRef: (ref: PendingNoteRef | null) => void;
  openNotesWithRef: (ref: PendingNoteRef) => void;
  openNoteById: (id: string) => void;
  setPendingNoteId: (id: string | null) => void;
  setPendingAttachToNoteId: (id: string | null) => void;
  setActiveNoteId: (id: string | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  rightPanelOpen: true,
  bottomPanelOpen: true,
  activeSidebarView: "sessions",
  activeRightTab: "context",
  activeBottomTab: "log",
  commandPaletteOpen: false,
  neuralFieldOpen: false,
  projectDropdownOpen: false,
  tabInitStatus: {},
  tabInitError: {},
  tabReloadKey: {},
  pendingNoteRef: null,
  pendingNoteId: null,
  pendingAttachToNoteId: null,
  activeNoteId: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  setSidebarView: (view) => set({ activeSidebarView: view, sidebarOpen: true }),
  setRightTab: (tab) => set({ activeRightTab: tab }),
  setBottomTab: (tab) => set({ activeBottomTab: tab }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleNeuralField: () => set((s) => ({ neuralFieldOpen: !s.neuralFieldOpen })),
  toggleDebugPanel: () => set((s) => {
    if (s.activeBottomTab === "debug" && s.bottomPanelOpen) {
      return { bottomPanelOpen: false };
    }
    return { activeBottomTab: "debug" as BottomTab, bottomPanelOpen: true };
  }),
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
  setPendingNoteRef: (ref) => set({ pendingNoteRef: ref }),
  openNotesWithRef: (ref) => set({ pendingNoteRef: ref, activeRightTab: "notes", rightPanelOpen: true }),
  openNoteById: (id) => set({ pendingNoteId: id, activeRightTab: "notes", rightPanelOpen: true }),
  setPendingNoteId: (id) => set({ pendingNoteId: id }),
  setPendingAttachToNoteId: (id) => set({ pendingAttachToNoteId: id }),
  setActiveNoteId: (id) => set({ activeNoteId: id }),
}));
