import { create } from "zustand";

export interface DebugEntry {
  id: number;
  timestamp: string;
  category: string;
  message: string;
  data?: unknown;
  level: "info" | "warn" | "error" | "success";
}

interface DebugStore {
  entries: DebugEntry[];
  nextId: number;
  addEntry: (entry: Omit<DebugEntry, "id" | "timestamp">) => void;
  clearLog: () => void;
}

const MAX_ENTRIES = 500;

function formatTimestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

export const useDebugStore = create<DebugStore>((set) => ({
  entries: [],
  nextId: 1,
  addEntry: (entry) =>
    set((s) => {
      const newEntry: DebugEntry = {
        ...entry,
        id: s.nextId,
        timestamp: formatTimestamp(),
      };
      const entries = [...s.entries, newEntry];
      if (entries.length > MAX_ENTRIES) {
        entries.splice(0, entries.length - MAX_ENTRIES);
      }
      return { entries, nextId: s.nextId + 1 };
    }),
  clearLog: () => set({ entries: [], nextId: 1 }),
}));

export function debugLog(
  category: string,
  message: string,
  data?: unknown,
  level: DebugEntry["level"] = "info"
) {
  if (import.meta.env.DEV) {
    useDebugStore.getState().addEntry({ category, message, data, level });
  }
}
