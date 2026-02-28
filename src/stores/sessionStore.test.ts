import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore, type SessionTab } from "./sessionStore";

const makeTab = (overrides: Partial<SessionTab> = {}): SessionTab => ({
  id: `tab-${Math.random().toString(36).slice(2, 7)}`,
  projectDir: "C:\\dev\\test",
  title: "Test Tab",
  ...overrides,
});

const PROJECT = "test-project";

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.setState({
      tabsByProject: {},
      activeTabByProject: {},
      activeSubagents: {},
      knownSessions: {},
      planLinks: {},
      dirtyTabs: {},
    });
  });

  describe("openTab", () => {
    it("opens a new tab and makes it active", () => {
      const tab = makeTab({ id: "tab1" });
      useSessionStore.getState().openTab(tab, PROJECT);

      const state = useSessionStore.getState();
      expect(state.tabsByProject[PROJECT]).toHaveLength(1);
      expect(state.tabsByProject[PROJECT]![0].id).toBe("tab1");
      expect(state.activeTabByProject[PROJECT]).toBe("tab1");
    });

    it("focuses existing tab without duplicating", () => {
      const tab = makeTab({ id: "tab1" });
      useSessionStore.getState().openTab(tab, PROJECT);
      useSessionStore.getState().openTab(makeTab({ id: "tab2" }), PROJECT);
      useSessionStore.getState().openTab(tab, PROJECT);

      const state = useSessionStore.getState();
      expect(state.tabsByProject[PROJECT]).toHaveLength(2);
      expect(state.activeTabByProject[PROJECT]).toBe("tab1");
    });

    it("adds spawnedAt timestamp", () => {
      const tab = makeTab({ id: "tab1" });
      useSessionStore.getState().openTab(tab, PROJECT);

      const state = useSessionStore.getState();
      expect(state.tabsByProject[PROJECT]![0].spawnedAt).toBeDefined();
    });
  });

  describe("closeTab", () => {
    it("removes a tab and selects the last remaining tab", () => {
      const tab1 = makeTab({ id: "tab1" });
      const tab2 = makeTab({ id: "tab2" });
      useSessionStore.getState().openTab(tab1, PROJECT);
      useSessionStore.getState().openTab(tab2, PROJECT);

      useSessionStore.getState().closeTab("tab2", PROJECT);

      const state = useSessionStore.getState();
      expect(state.tabsByProject[PROJECT]).toHaveLength(1);
      expect(state.activeTabByProject[PROJECT]).toBe("tab1");
    });

    it("sets active to null when closing the last tab", () => {
      const tab = makeTab({ id: "tab1" });
      useSessionStore.getState().openTab(tab, PROJECT);
      useSessionStore.getState().closeTab("tab1", PROJECT);

      const state = useSessionStore.getState();
      expect(state.tabsByProject[PROJECT]).toHaveLength(0);
      expect(state.activeTabByProject[PROJECT]).toBeNull();
    });

    it("preserves active tab when closing a non-active tab", () => {
      const tab1 = makeTab({ id: "tab1" });
      const tab2 = makeTab({ id: "tab2" });
      useSessionStore.getState().openTab(tab1, PROJECT);
      useSessionStore.getState().openTab(tab2, PROJECT);
      // tab2 is active
      useSessionStore.getState().closeTab("tab1", PROJECT);

      expect(useSessionStore.getState().activeTabByProject[PROJECT]).toBe(
        "tab2"
      );
    });
  });

  describe("setActiveTab", () => {
    it("changes the active tab", () => {
      useSessionStore.getState().openTab(makeTab({ id: "tab1" }), PROJECT);
      useSessionStore.getState().openTab(makeTab({ id: "tab2" }), PROJECT);
      useSessionStore.getState().setActiveTab("tab1", PROJECT);

      expect(useSessionStore.getState().activeTabByProject[PROJECT]).toBe(
        "tab1"
      );
    });
  });

  describe("insertTabBackground", () => {
    it("adds tab without changing active tab", () => {
      useSessionStore.getState().openTab(makeTab({ id: "tab1" }), PROJECT);
      useSessionStore
        .getState()
        .insertTabBackground(makeTab({ id: "bg-tab" }), PROJECT);

      const state = useSessionStore.getState();
      expect(state.tabsByProject[PROJECT]).toHaveLength(2);
      expect(state.activeTabByProject[PROJECT]).toBe("tab1");
    });

    it("does not duplicate existing tabs", () => {
      const tab = makeTab({ id: "tab1" });
      useSessionStore.getState().openTab(tab, PROJECT);
      useSessionStore.getState().insertTabBackground(tab, PROJECT);

      expect(useSessionStore.getState().tabsByProject[PROJECT]).toHaveLength(1);
    });
  });

  describe("openPlanTab", () => {
    it("creates a plan tab", () => {
      useSessionStore.getState().openPlanTab("plan.md", "My Plan", PROJECT);

      const state = useSessionStore.getState();
      const planTab = state.tabsByProject[PROJECT]?.find(
        (t) => t.id === "plan:plan.md"
      );
      expect(planTab).toBeDefined();
      expect(planTab?.type).toBe("plan");
      expect(planTab?.planFilename).toBe("plan.md");
    });

    it("does not duplicate plan tabs", () => {
      useSessionStore.getState().openPlanTab("plan.md", "My Plan", PROJECT);
      useSessionStore.getState().openPlanTab("plan.md", "My Plan", PROJECT);

      expect(useSessionStore.getState().tabsByProject[PROJECT]).toHaveLength(1);
    });
  });

  describe("closeAllTabs", () => {
    it("removes all tabs for a project", () => {
      useSessionStore.getState().openTab(makeTab({ id: "tab1" }), PROJECT);
      useSessionStore.getState().openTab(makeTab({ id: "tab2" }), PROJECT);
      useSessionStore.getState().closeAllTabs(PROJECT);

      const state = useSessionStore.getState();
      expect(state.tabsByProject[PROJECT]).toHaveLength(0);
      expect(state.activeTabByProject[PROJECT]).toBeNull();
    });
  });

  describe("closeOtherTabs", () => {
    it("keeps only the specified tab", () => {
      useSessionStore.getState().openTab(makeTab({ id: "tab1" }), PROJECT);
      useSessionStore.getState().openTab(makeTab({ id: "tab2" }), PROJECT);
      useSessionStore.getState().openTab(makeTab({ id: "tab3" }), PROJECT);
      useSessionStore.getState().closeOtherTabs("tab2", PROJECT);

      const state = useSessionStore.getState();
      expect(state.tabsByProject[PROJECT]).toHaveLength(1);
      expect(state.tabsByProject[PROJECT]![0].id).toBe("tab2");
    });
  });

  describe("closeTabsToLeft", () => {
    it("removes tabs to the left of the specified tab", () => {
      useSessionStore.getState().openTab(makeTab({ id: "tab1" }), PROJECT);
      useSessionStore.getState().openTab(makeTab({ id: "tab2" }), PROJECT);
      useSessionStore.getState().openTab(makeTab({ id: "tab3" }), PROJECT);
      useSessionStore.getState().closeTabsToLeft("tab2", PROJECT);

      const ids = useSessionStore
        .getState()
        .tabsByProject[PROJECT]!.map((t) => t.id);
      expect(ids).toEqual(["tab2", "tab3"]);
    });
  });

  describe("closeTabsToRight", () => {
    it("removes tabs to the right of the specified tab", () => {
      useSessionStore.getState().openTab(makeTab({ id: "tab1" }), PROJECT);
      useSessionStore.getState().openTab(makeTab({ id: "tab2" }), PROJECT);
      useSessionStore.getState().openTab(makeTab({ id: "tab3" }), PROJECT);
      useSessionStore.getState().closeTabsToRight("tab2", PROJECT);

      const ids = useSessionStore
        .getState()
        .tabsByProject[PROJECT]!.map((t) => t.id);
      expect(ids).toEqual(["tab1", "tab2"]);
    });
  });

  describe("resolveTabSession", () => {
    it("sets the resolved session ID on a tab across all projects", () => {
      useSessionStore.getState().openTab(makeTab({ id: "tab1" }), PROJECT);
      useSessionStore.getState().resolveTabSession("tab1", "real-session-id");

      const tab = useSessionStore.getState().tabsByProject[PROJECT]![0];
      expect(tab.resolvedSessionId).toBe("real-session-id");
    });
  });

  describe("renameTab", () => {
    it("renames a tab", () => {
      useSessionStore.getState().openTab(makeTab({ id: "tab1" }), PROJECT);
      useSessionStore.getState().renameTab("tab1", "New Title");

      const tab = useSessionStore.getState().tabsByProject[PROJECT]![0];
      expect(tab.title).toBe("New Title");
    });
  });

  describe("session status", () => {
    it("marks session as active/idle/completed", () => {
      useSessionStore.getState().markSessionStatus("sess1", "active");
      expect(useSessionStore.getState().knownSessions["sess1"]).toBe("active");

      useSessionStore.getState().markSessionStatus("sess1", "completed");
      expect(useSessionStore.getState().knownSessions["sess1"]).toBe(
        "completed"
      );
    });
  });

  describe("subagents", () => {
    it("sets subagents for a session", () => {
      const subs = [
        { sessionId: "sub1", parentSessionId: "sess1", name: "Agent 1" },
      ];
      useSessionStore.getState().setSubagents("sess1", subs);
      expect(useSessionStore.getState().activeSubagents["sess1"]).toEqual(subs);
    });
  });

  describe("dirtyTabs", () => {
    it("marks and unmarks a tab as dirty", () => {
      useSessionStore.getState().setTabDirty("tab1", true);
      expect(useSessionStore.getState().dirtyTabs["tab1"]).toBe(true);

      useSessionStore.getState().setTabDirty("tab1", false);
      expect(useSessionStore.getState().dirtyTabs["tab1"]).toBeUndefined();
    });
  });

  describe("resumeTab", () => {
    it("clears the tab type", () => {
      useSessionStore
        .getState()
        .openTab(
          makeTab({ id: "tab1", type: "session-view" }),
          PROJECT
        );
      useSessionStore.getState().resumeTab("tab1", PROJECT);

      const tab = useSessionStore.getState().tabsByProject[PROJECT]![0];
      expect(tab.type).toBeUndefined();
    });
  });
});
