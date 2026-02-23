import { create } from "zustand";

export interface QuestionNotification {
  type: "question";
  id: string;
  tabId: string;
  projectId: string;
  sessionTitle: string;
  question: string;
  timestamp: number;
  read: boolean;
}

export interface CompletionNotification {
  type: "completion";
  id: string;
  sessionId: string;
  tabId?: string;
  projectId: string;
  sessionTitle: string;
  filename: string;
  preview: string;
  timestamp: number;
  read: boolean;
}

export type AppNotification = QuestionNotification | CompletionNotification;

interface NotificationStore {
  notifications: AppNotification[];
  addNotification: (n: Omit<QuestionNotification, "id" | "timestamp" | "read" | "type">) => void;
  addCompletionNotification: (n: Omit<CompletionNotification, "id" | "timestamp" | "read" | "type">) => void;
  markRead: (id: string) => void;
  markReadByTabId: (tabId: string) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const MAX_NOTIFICATIONS = 50;

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],

  addNotification: (n) =>
    set((s) => {
      const existing = s.notifications.find(
        (x): x is QuestionNotification => x.type === "question" && x.tabId === n.tabId
      );
      if (existing && !existing.read) {
        return {
          notifications: s.notifications.map((x) =>
            x.type === "question" && x.tabId === n.tabId
              ? { ...x, question: n.question, timestamp: Date.now() }
              : x
          ),
        };
      }
      let notifications: AppNotification[] = [
        ...s.notifications.filter((x) => !(x.type === "question" && x.tabId === n.tabId)),
        { ...n, type: "question" as const, id: crypto.randomUUID(), timestamp: Date.now(), read: false },
      ];
      while (notifications.length > MAX_NOTIFICATIONS) {
        const oldestReadIdx = notifications.findIndex((x) => x.read);
        if (oldestReadIdx !== -1) {
          notifications.splice(oldestReadIdx, 1);
        } else {
          notifications.shift();
        }
      }
      return { notifications };
    }),

  addCompletionNotification: (n) =>
    set((s) => {
      // Deduplicate by sessionId + filename
      const isDupe = s.notifications.some(
        (x): x is CompletionNotification =>
          x.type === "completion" &&
          x.sessionId === n.sessionId &&
          x.filename === n.filename
      );
      if (isDupe) return {};
      let notifications: AppNotification[] = [
        ...s.notifications,
        { ...n, type: "completion" as const, id: crypto.randomUUID(), timestamp: Date.now(), read: false },
      ];
      while (notifications.length > MAX_NOTIFICATIONS) {
        const oldestReadIdx = notifications.findIndex((x) => x.read);
        if (oldestReadIdx !== -1) {
          notifications.splice(oldestReadIdx, 1);
        } else {
          notifications.shift();
        }
      }
      return { notifications };
    }),

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markReadByTabId: (tabId) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        "tabId" in n && n.tabId === tabId ? { ...n, read: true } : n
      ),
    })),

  removeNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  clearAll: () => set({ notifications: [] }),
}));
