import { create } from "zustand";

export interface OutputMessage {
  id: string;
  timestamp: string;
  level: "info" | "success" | "error";
  text: string;
  source: string;
}

interface OutputStore {
  messages: OutputMessage[];
  addMessage: (level: OutputMessage["level"], text: string, source: string) => void;
  clear: () => void;
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 8);
}

export const useOutputStore = create<OutputStore>((set) => ({
  messages: [],

  addMessage: (level, text, source) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: formatTime(new Date()),
          level,
          text,
          source,
        },
      ],
    })),

  clear: () => set({ messages: [] }),
}));
