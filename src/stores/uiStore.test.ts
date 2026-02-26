import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useUIStore.setState({
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
    });
  });

  describe("panel toggles", () => {
    it("toggles sidebar", () => {
      expect(useUIStore.getState().sidebarOpen).toBe(true);
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it("toggles right panel", () => {
      expect(useUIStore.getState().rightPanelOpen).toBe(true);
      useUIStore.getState().toggleRightPanel();
      expect(useUIStore.getState().rightPanelOpen).toBe(false);
    });

    it("toggles bottom panel", () => {
      expect(useUIStore.getState().bottomPanelOpen).toBe(true);
      useUIStore.getState().toggleBottomPanel();
      expect(useUIStore.getState().bottomPanelOpen).toBe(false);
    });
  });

  describe("view switching", () => {
    it("sets sidebar view and opens sidebar", () => {
      useUIStore.setState({ sidebarOpen: false });
      useUIStore.getState().setSidebarView("git");
      expect(useUIStore.getState().activeSidebarView).toBe("git");
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it("sets right tab", () => {
      useUIStore.getState().setRightTab("plans");
      expect(useUIStore.getState().activeRightTab).toBe("plans");
    });

    it("sets bottom tab", () => {
      useUIStore.getState().setBottomTab("output");
      expect(useUIStore.getState().activeBottomTab).toBe("output");
    });
  });

  describe("command palette", () => {
    it("opens and closes command palette", () => {
      expect(useUIStore.getState().commandPaletteOpen).toBe(false);
      useUIStore.getState().openCommandPalette();
      expect(useUIStore.getState().commandPaletteOpen).toBe(true);
      useUIStore.getState().closeCommandPalette();
      expect(useUIStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  describe("neural field", () => {
    it("toggles neural field", () => {
      expect(useUIStore.getState().neuralFieldOpen).toBe(false);
      useUIStore.getState().toggleNeuralField();
      expect(useUIStore.getState().neuralFieldOpen).toBe(true);
      useUIStore.getState().toggleNeuralField();
      expect(useUIStore.getState().neuralFieldOpen).toBe(false);
    });
  });

  describe("debug panel", () => {
    it("opens debug panel when not currently showing debug", () => {
      useUIStore.setState({ activeBottomTab: "log", bottomPanelOpen: false });
      useUIStore.getState().toggleDebugPanel();
      expect(useUIStore.getState().activeBottomTab).toBe("debug");
      expect(useUIStore.getState().bottomPanelOpen).toBe(true);
    });

    it("closes bottom panel when debug is already active and open", () => {
      useUIStore.setState({ activeBottomTab: "debug", bottomPanelOpen: true });
      useUIStore.getState().toggleDebugPanel();
      expect(useUIStore.getState().bottomPanelOpen).toBe(false);
    });
  });

  describe("project dropdown", () => {
    it("opens and closes project dropdown", () => {
      expect(useUIStore.getState().projectDropdownOpen).toBe(false);
      useUIStore.getState().openProjectDropdown();
      expect(useUIStore.getState().projectDropdownOpen).toBe(true);
      useUIStore.getState().closeProjectDropdown();
      expect(useUIStore.getState().projectDropdownOpen).toBe(false);
    });
  });

  describe("tab init status", () => {
    it("sets and clears tab init status", () => {
      useUIStore.getState().setTabInitStatus("tab1", "initializing");
      expect(useUIStore.getState().tabInitStatus["tab1"]).toBe("initializing");

      useUIStore.getState().setTabInitStatus("tab1", "error");
      expect(useUIStore.getState().tabInitStatus["tab1"]).toBe("error");

      useUIStore.getState().setTabInitStatus("tab1", null);
      expect(useUIStore.getState().tabInitStatus["tab1"]).toBeUndefined();
    });
  });

  describe("tab init error", () => {
    it("sets and clears tab init error", () => {
      useUIStore.getState().setTabInitError("tab1", "Something went wrong");
      expect(useUIStore.getState().tabInitError["tab1"]).toBe(
        "Something went wrong"
      );

      useUIStore.getState().setTabInitError("tab1", null);
      expect(useUIStore.getState().tabInitError["tab1"]).toBeUndefined();
    });
  });

  describe("reload key", () => {
    it("increments reload key from 0", () => {
      useUIStore.getState().bumpReloadKey("tab1");
      expect(useUIStore.getState().tabReloadKey["tab1"]).toBe(1);
    });

    it("increments reload key from existing value", () => {
      useUIStore.getState().bumpReloadKey("tab1");
      useUIStore.getState().bumpReloadKey("tab1");
      expect(useUIStore.getState().tabReloadKey["tab1"]).toBe(2);
    });
  });

  describe("notes integration", () => {
    it("opens notes with a pending ref", () => {
      const ref = {
        filePath: "/test/file.ts",
        lineStart: 1,
        lineEnd: 5,
        quote: "some code",
      };
      useUIStore.getState().openNotesWithRef(ref);
      expect(useUIStore.getState().pendingNoteRef).toEqual(ref);
      expect(useUIStore.getState().activeRightTab).toBe("notes");
      expect(useUIStore.getState().rightPanelOpen).toBe(true);
    });

    it("opens a note by id", () => {
      useUIStore.getState().openNoteById("note-123");
      expect(useUIStore.getState().pendingNoteId).toBe("note-123");
      expect(useUIStore.getState().activeRightTab).toBe("notes");
      expect(useUIStore.getState().rightPanelOpen).toBe(true);
    });

    it("sets active note id", () => {
      useUIStore.getState().setActiveNoteId("note-456");
      expect(useUIStore.getState().activeNoteId).toBe("note-456");
    });
  });
});
