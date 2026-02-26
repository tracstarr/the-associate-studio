import { describe, it, expect, beforeEach } from "vitest";
import { useOutputStore } from "./outputStore";

describe("outputStore", () => {
  beforeEach(() => {
    useOutputStore.setState({ messages: [] });
  });

  it("adds a message", () => {
    useOutputStore.getState().addMessage("info", "Test message", "test");

    const msgs = useOutputStore.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].level).toBe("info");
    expect(msgs[0].text).toBe("Test message");
    expect(msgs[0].source).toBe("test");
    expect(msgs[0].timestamp).toBeDefined();
    expect(msgs[0].id).toBeDefined();
  });

  it("supports all message levels", () => {
    useOutputStore.getState().addMessage("info", "Info msg", "test");
    useOutputStore.getState().addMessage("success", "Success msg", "test");
    useOutputStore.getState().addMessage("error", "Error msg", "test");

    const levels = useOutputStore.getState().messages.map((m) => m.level);
    expect(levels).toEqual(["info", "success", "error"]);
  });

  it("caps messages at 500", () => {
    for (let i = 0; i < 510; i++) {
      useOutputStore.getState().addMessage("info", `Message ${i}`, "test");
    }

    expect(useOutputStore.getState().messages).toHaveLength(500);
    // Should keep the most recent messages
    expect(useOutputStore.getState().messages[499].text).toBe("Message 509");
  });

  it("clears all messages", () => {
    useOutputStore.getState().addMessage("info", "msg1", "test");
    useOutputStore.getState().addMessage("info", "msg2", "test");
    useOutputStore.getState().clear();

    expect(useOutputStore.getState().messages).toHaveLength(0);
  });
});
