import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  it("parses basic key-value frontmatter", () => {
    const input = `---
title: Hello World
author: Test
---
Body content here`;

    const result = parseFrontmatter(input);
    expect(result.fm).toEqual({ title: "Hello World", author: "Test" });
    expect(result.body).toBe("Body content here");
  });

  it("returns null fm when no frontmatter present", () => {
    const input = "Just some text without frontmatter";
    const result = parseFrontmatter(input);
    expect(result.fm).toBeNull();
    expect(result.body).toBe(input);
  });

  it("parses boolean values", () => {
    const input = `---
draft: true
published: false
---
Content`;

    const result = parseFrontmatter(input);
    expect(result.fm).toEqual({ draft: true, published: false });
  });

  it("parses inline arrays", () => {
    const input = `---
tags: [react, typescript, testing]
---
Content`;

    const result = parseFrontmatter(input);
    expect(result.fm?.tags).toEqual(["react", "typescript", "testing"]);
  });

  it("parses bullet-list arrays", () => {
    const input = `---
tags:
  - react
  - typescript
---
Content`;

    const result = parseFrontmatter(input);
    expect(result.fm?.tags).toEqual(["react", "typescript"]);
  });

  it("handles CRLF line endings", () => {
    const input = "---\r\ntitle: Test\r\n---\r\nBody";
    const result = parseFrontmatter(input);
    expect(result.fm).toEqual({ title: "Test" });
    expect(result.body).toBe("Body");
  });

  it("returns null fm for unclosed frontmatter", () => {
    const input = `---
title: Hello
No closing delimiter`;

    const result = parseFrontmatter(input);
    expect(result.fm).toBeNull();
  });

  it("returns null fm for empty frontmatter block", () => {
    const input = `---
---
Body`;

    const result = parseFrontmatter(input);
    expect(result.fm).toBeNull();
  });

  it("handles leading whitespace before opening delimiter", () => {
    const input = `  ---
title: Test
---
Body`;

    const result = parseFrontmatter(input);
    expect(result.fm).toEqual({ title: "Test" });
  });
});
