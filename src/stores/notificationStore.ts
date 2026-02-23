import { create } from "zustand";

export interface QuestionNotification {
  id: string;
  tabId: string;
  projectId: string;
  sessionTitle: string;
  question: string;
  timestamp: number;
  read: boolean; // true = user has acted on it (tab switch / typed); shown greyed out
}

interface NotificationStore {
  notifications: QuestionNotification[];
  addNotification: (n: Omit<QuestionNotification, "id" | "timestamp" | "read">) => void;
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
      const existing = s.notifications.find((x) => x.tabId === n.tabId);
      if (existing && !existing.read) {
        // Update question text on the existing unread notification (same session, new text)
        return {
          notifications: s.notifications.map((x) =>
            x.tabId === n.tabId ? { ...x, question: n.question, timestamp: Date.now() } : x
          ),
        };
      }
      // Replace any read (acted-on) notification for this tab with a fresh unread one,
      // or append if no prior notification exists for this tab.
      let notifications = [
        ...s.notifications.filter((x) => x.tabId !== n.tabId),
        { ...n, id: crypto.randomUUID(), timestamp: Date.now(), read: false },
      ];
      // Cap at MAX_NOTIFICATIONS: evict oldest read first, then oldest unread
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
        n.tabId === tabId ? { ...n, read: true } : n
      ),
    })),

  removeNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  clearAll: () => set({ notifications: [] }),
}));
