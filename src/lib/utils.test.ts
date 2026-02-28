import { describe, it, expect } from "vitest";
import { cn, pathToProjectId } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("returns empty string for no input", () => {
    expect(cn()).toBe("");
  });
});

describe("pathToProjectId", () => {
  it("encodes a simple Windows path", () => {
    expect(pathToProjectId("C:\\dev\\profile-server")).toBe(
      "C--dev-profile-server"
    );
  });

  it("encodes a worktree path", () => {
    expect(
      pathToProjectId("C:\\dev\\profile-server\\.worktrees\\aero-planning")
    ).toBe("C--dev-profile-server--worktrees-aero-planning");
  });

  it("encodes a deep path", () => {
    expect(pathToProjectId("C:\\Users\\Keith\\projects\\my-app")).toBe(
      "C--Users-Keith-projects-my-app"
    );
  });

  it("handles forward slashes (unix-style input)", () => {
    expect(pathToProjectId("C:/dev/ide")).toBe("C--dev-ide");
  });

  it("strips trailing dashes", () => {
    expect(pathToProjectId("C:\\dev\\")).toBe("C--dev");
  });

  it("handles a root drive path (trailing dashes stripped)", () => {
    // D:\ → D-- → trailing dashes stripped → D
    expect(pathToProjectId("D:\\")).toBe("D");
  });
});
