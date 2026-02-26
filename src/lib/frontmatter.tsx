import React from "react";

type FmValue = string | boolean | string[];

export interface ParsedFrontmatter {
  fm: Record<string, FmValue> | null;
  body: string;
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  // Normalize line endings so \r\n files work the same as \n files
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const trimmed = normalized.replace(/^\s*/, "");

  // Opening --- must be on its own line
  if (!trimmed.startsWith("---\n") && trimmed !== "---") {
    return { fm: null, body: content };
  }

  const afterOpen = trimmed.slice(4); // skip "---\n"
  // Find closing --- on its own line
  const closeMatch = afterOpen.match(/\n---[ \t]*(\n|$)/);
  if (!closeMatch || closeMatch.index === undefined) {
    return { fm: null, body: content };
  }

  const yamlText = afterOpen.slice(0, closeMatch.index);
  const body = afterOpen.slice(closeMatch.index + closeMatch[0].length);

  const fm: Record<string, FmValue> = {};
  const lines = yamlText.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (!keyMatch) { i++; continue; }

    const key = keyMatch[1];
    const rest = keyMatch[2].trim();

    // Inline array: [a, b, c]
    if (rest.startsWith("[") && rest.endsWith("]")) {
      const items = rest.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
      fm[key] = items;
      i++;
      continue;
    }

    // Boolean
    if (rest === "true") { fm[key] = true; i++; continue; }
    if (rest === "false") { fm[key] = false; i++; continue; }

    // Empty value — might be followed by bullet list
    if (rest === "") {
      const listItems: string[] = [];
      i++;
      while (i < lines.length && /^\s*-\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*-\s*/, "").trim());
        i++;
      }
      fm[key] = listItems.length > 0 ? listItems : "";
      continue;
    }

    fm[key] = rest;
    i++;
  }

  if (Object.keys(fm).length === 0) {
    return { fm: null, body: content };
  }

  return { fm, body };
}

// ── FrontmatterBlock component ────────────────────────────────────────────────

interface FrontmatterBlockProps {
  fm: Record<string, FmValue>;
}

export function FrontmatterBlock({ fm }: FrontmatterBlockProps) {
  const entries = Object.entries(fm);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--color-border-muted)] border-l-2 border-l-[var(--color-accent-primary)] bg-[var(--color-bg-raised)] px-4 py-3 mb-6">
      <div
        className="mb-2 font-mono"
        style={{ fontSize: "10px", color: "var(--color-text-muted)" }}
      >
        frontmatter
      </div>
      <div className="grid gap-x-4 gap-y-1" style={{ gridTemplateColumns: "auto 1fr" }}>
        {entries.map(([key, value]) => (
          <React.Fragment key={key}>
            <span
              className="font-mono self-start pt-0.5"
              style={{ fontSize: "10px", color: "var(--color-text-muted)" }}
            >
              {key}
            </span>
            <FmValueDisplay value={value} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function FmValueDisplay({ value }: { value: FmValue }) {
  if (typeof value === "boolean") {
    return (
      <span
        className="text-xs"
        style={{ color: value ? "var(--color-status-success)" : "var(--color-text-muted)" }}
      >
        {value ? "true" : "false"}
      </span>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, i) => (
          <span
            key={i}
            className="text-xs px-1.5 py-0.5 rounded border"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-muted)",
              color: "var(--color-text-secondary)",
            }}
          >
            {item}
          </span>
        ))}
      </div>
    );
  }

  return (
    <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
      {value}
    </span>
  );
}
