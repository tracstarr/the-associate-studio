import { describe, it, expect, beforeEach } from "vitest";
import { useDebugStore } from "./debugStore";

describe("debugStore", () => {
  beforeEach(() => {
    useDebugStore.setState({ entries: [], nextId: 1 });
  });

  it("adds a debug entry with incrementing id", () => {
    useDebugStore.getState().addEntry({
      category: "Test",
      message: "Hello",
      level: "info",
    });

    const entries = useDebugStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(1);
    expect(entries[0].category).toBe("Test");
    expect(entries[0].message).toBe("Hello");
    expect(entries[0].level).toBe("info");
    expect(entries[0].timestamp).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it("increments IDs across entries", () => {
    useDebugStore
      .getState()
      .addEntry({ category: "A", message: "1", level: "info" });
    useDebugStore
      .getState()
      .addEntry({ category: "B", message: "2", level: "warn" });

    const entries = useDebugStore.getState().entries;
    expect(entries[0].id).toBe(1);
    expect(entries[1].id).toBe(2);
    expect(useDebugStore.getState().nextId).toBe(3);
  });

  it("stores optional data", () => {
    useDebugStore.getState().addEntry({
      category: "Test",
      message: "With data",
      data: { key: "value" },
      level: "success",
    });

    expect(useDebugStore.getState().entries[0].data).toEqual({ key: "value" });
  });

  it("caps entries at 500", () => {
    for (let i = 0; i < 510; i++) {
      useDebugStore
        .getState()
        .addEntry({ category: "Bulk", message: `Entry ${i}`, level: "info" });
    }

    expect(useDebugStore.getState().entries).toHaveLength(500);
  });

  it("clears log and resets nextId", () => {
    useDebugStore
      .getState()
      .addEntry({ category: "A", message: "1", level: "info" });
    useDebugStore
      .getState()
      .addEntry({ category: "B", message: "2", level: "error" });
    useDebugStore.getState().clearLog();

    expect(useDebugStore.getState().entries).toHaveLength(0);
    expect(useDebugStore.getState().nextId).toBe(1);
  });
});
