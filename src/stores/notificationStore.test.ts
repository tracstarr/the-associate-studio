import { describe, it, expect, beforeEach } from "vitest";
import { useNotificationStore } from "./notificationStore";

describe("notificationStore", () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
  });

  describe("addNotification", () => {
    it("adds a question notification", () => {
      useNotificationStore.getState().addNotification({
        tabId: "tab1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        question: "Which approach?",
      });

      const notifs = useNotificationStore.getState().notifications;
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("question");
      expect(notifs[0].read).toBe(false);
    });

    it("updates existing unread notification for same tab", () => {
      useNotificationStore.getState().addNotification({
        tabId: "tab1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        question: "First question",
      });

      useNotificationStore.getState().addNotification({
        tabId: "tab1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        question: "Updated question",
      });

      const notifs = useNotificationStore.getState().notifications;
      expect(notifs).toHaveLength(1);
      if (notifs[0].type === "question") {
        expect(notifs[0].question).toBe("Updated question");
      }
    });

    it("creates new notification for same tab after marking read", () => {
      useNotificationStore.getState().addNotification({
        tabId: "tab1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        question: "First question",
      });

      const id = useNotificationStore.getState().notifications[0].id;
      useNotificationStore.getState().markRead(id);

      useNotificationStore.getState().addNotification({
        tabId: "tab1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        question: "New question",
      });

      const notifs = useNotificationStore.getState().notifications;
      expect(notifs).toHaveLength(1);
      expect(notifs[0].read).toBe(false);
    });
  });

  describe("addCompletionNotification", () => {
    it("adds a completion notification", () => {
      useNotificationStore.getState().addCompletionNotification({
        sessionId: "sess1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        filename: "summary-001.md",
        preview: "Task completed",
      });

      const notifs = useNotificationStore.getState().notifications;
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("completion");
    });

    it("deduplicates by sessionId and filename", () => {
      const notif = {
        sessionId: "sess1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        filename: "summary-001.md",
        preview: "Task completed",
      };

      useNotificationStore.getState().addCompletionNotification(notif);
      useNotificationStore.getState().addCompletionNotification(notif);

      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });
  });

  describe("markRead", () => {
    it("marks a notification as read", () => {
      useNotificationStore.getState().addNotification({
        tabId: "tab1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        question: "Question?",
      });

      const id = useNotificationStore.getState().notifications[0].id;
      useNotificationStore.getState().markRead(id);

      expect(useNotificationStore.getState().notifications[0].read).toBe(true);
    });
  });

  describe("markReadByTabId", () => {
    it("marks all notifications for a tab as read", () => {
      useNotificationStore.getState().addNotification({
        tabId: "tab1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        question: "Q1",
      });

      // Mark first as read, then add another
      const id = useNotificationStore.getState().notifications[0].id;
      useNotificationStore.getState().markRead(id);
      useNotificationStore.getState().addNotification({
        tabId: "tab1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        question: "Q2",
      });

      useNotificationStore.getState().markReadByTabId("tab1");

      const allRead = useNotificationStore
        .getState()
        .notifications.every((n) => n.read);
      expect(allRead).toBe(true);
    });
  });

  describe("removeNotification", () => {
    it("removes a notification by id", () => {
      useNotificationStore.getState().addNotification({
        tabId: "tab1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        question: "Q1",
      });

      const id = useNotificationStore.getState().notifications[0].id;
      useNotificationStore.getState().removeNotification(id);

      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });
  });

  describe("clearAll", () => {
    it("clears all notifications", () => {
      useNotificationStore.getState().addNotification({
        tabId: "tab1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        question: "Q1",
      });
      useNotificationStore.getState().addCompletionNotification({
        sessionId: "sess1",
        projectId: "proj1",
        sessionTitle: "Session 1",
        filename: "f.md",
        preview: "done",
      });

      useNotificationStore.getState().clearAll();
      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });
  });

  describe("max notifications", () => {
    it("caps notifications at 50", () => {
      for (let i = 0; i < 55; i++) {
        useNotificationStore.getState().addNotification({
          tabId: `tab-${i}`,
          projectId: "proj1",
          sessionTitle: `Session ${i}`,
          question: `Question ${i}`,
        });
      }

      expect(
        useNotificationStore.getState().notifications.length
      ).toBeLessThanOrEqual(50);
    });
  });
});
