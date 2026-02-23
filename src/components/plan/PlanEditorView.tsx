import { type ReactNode, useState, useCallback, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Eye, Pencil, Check } from "lucide-react";
import { readPlan, savePlan } from "../../lib/tauri";
import { cn } from "../../lib/cn";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.default }))
);

interface PlanEditorViewProps {
  filename: string;
  isActive: boolean;
}

export function PlanEditorView({ filename }: PlanEditorViewProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [editContent, setEditContent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const { data: rawContent, isLoading } = useQuery({
    queryKey: ["plan-raw", filename],
    queryFn: () => readPlan(filename),
    staleTime: 30_000,
  });

  const enterEdit = useCallback(() => {
    setEditContent(rawContent ?? "");
    setMode("edit");
  }, [rawContent]);

  const cancelEdit = useCallback(() => {
    setEditContent(null);
    setMode("preview");
  }, []);

  const handleSave = useCallback(async () => {
    if (editContent === null) return;
    setSaving(true);
    try {
      await savePlan(filename, editContent);
      queryClient.invalidateQueries({ queryKey: ["plan-raw", filename] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      setMode("preview");
      setEditContent(null);
    } catch (e) {
      console.error("[plan-editor] save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [editContent, filename, queryClient]);

  const content = mode === "edit" ? (editContent ?? "") : (rawContent ?? "");

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 h-9 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shrink-0">
        <span className="text-[11px] text-[var(--color-text-muted)] font-mono truncate flex-1">
          ~/.claude/plans/{filename}
        </span>

        <div className="flex items-center rounded overflow-hidden border border-[var(--color-border-default)]">
          <button
            onClick={cancelEdit}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-[10px] transition-colors",
              mode === "preview"
                ? "bg-[var(--color-bg-raised)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)]"
            )}
          >
            <Eye size={10} />
            Preview
          </button>
          <button
            onClick={enterEdit}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-[10px] transition-colors border-l border-[var(--color-border-default)]",
              mode === "edit"
                ? "bg-[var(--color-bg-raised)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)]"
            )}
          >
            <Pencil size={10} />
            Edit
          </button>
        </div>

        {mode === "edit" && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all",
              savedFlash
                ? "bg-[var(--color-status-success)] text-white"
                : "bg-[var(--color-accent-primary)] text-white hover:opacity-90",
              saving && "opacity-50 cursor-not-allowed"
            )}
          >
            {savedFlash ? <Check size={10} /> : <Save size={10} />}
            {savedFlash ? "Saved" : saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-muted)]">
            Loading…
          </div>
        ) : mode === "preview" ? (
          <div className="h-full overflow-y-auto">
            <MarkdownPreview content={rawContent ?? ""} />
          </div>
        ) : (
          <Suspense
            fallback={
              <textarea
                className="w-full h-full p-4 bg-[var(--color-bg-terminal)] text-[var(--color-text-primary)] text-sm font-mono resize-none outline-none"
                value={content}
                onChange={(e) => setEditContent(e.target.value)}
                spellCheck={false}
              />
            }
          >
            <MonacoEditor
              height="100%"
              language="markdown"
              theme="vs-dark"
              value={content}
              onChange={(v) => setEditContent(v ?? "")}
              options={{
                fontSize: 13,
                lineHeight: 1.6,
                wordWrap: "on",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                fontFamily: "'Cascadia Code', 'JetBrains Mono', monospace",
                renderLineHighlight: "none",
                overviewRulerLanes: 0,
                folding: false,
              }}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ── Simple inline markdown renderer ─────────────────────────────────────────

function MarkdownPreview({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="px-8 py-6 max-w-3xl mx-auto space-y-1.5 text-[var(--color-text-secondary)]">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "hr" }
  | { kind: "blank" }
  | { kind: "listitem"; text: string; depth: number }
  | { kind: "code"; lines: string[] }
  | { kind: "paragraph"; text: string };

function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      blocks.push({ kind: "h1", text: trimmed.slice(2) });
    } else if (trimmed.startsWith("## ")) {
      blocks.push({ kind: "h2", text: trimmed.slice(3) });
    } else if (trimmed.startsWith("### ")) {
      blocks.push({ kind: "h3", text: trimmed.slice(4) });
    } else if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      blocks.push({ kind: "hr" });
    } else if (trimmed === "") {
      blocks.push({ kind: "blank" });
    } else if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ kind: "code", lines: codeLines });
    } else if (/^(\s*)([-*+]|\d+\.) /.test(line)) {
      const depth = line.match(/^(\s*)/)?.[1].length ?? 0;
      const text = trimmed.replace(/^([-*+]|\d+\.) /, "");
      blocks.push({ kind: "listitem", text, depth: Math.floor(depth / 2) });
    } else {
      blocks.push({ kind: "paragraph", text: trimmed });
    }
    i++;
  }
  return blocks;
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "h1":
      return (
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] mt-6 mb-3 first:mt-0">
          {block.text}
        </h1>
      );
    case "h2":
      return (
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-5 mb-2 pt-2 border-t border-[var(--color-border-default)]">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mt-3 mb-1">
          {block.text}
        </h3>
      );
    case "hr":
      return <hr className="border-[var(--color-border-default)] my-4" />;
    case "blank":
      return <div className="h-1" />;
    case "code":
      return (
        <pre className="bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] rounded p-3 my-2 overflow-x-auto">
          <code className="text-xs font-mono text-[var(--color-accent-secondary)]">
            {block.lines.join("\n")}
          </code>
        </pre>
      );
    case "listitem":
      return (
        <div
          className="flex gap-2 text-sm"
          style={{ paddingLeft: `${block.depth * 16 + 4}px` }}
        >
          <span className="text-[var(--color-accent-primary)] shrink-0 mt-0.5">
            •
          </span>
          <span>{renderInline(block.text)}</span>
        </div>
      );
    case "paragraph":
      return (
        <p className="text-sm leading-relaxed">{renderInline(block.text)}</p>
      );
  }
}

// Render inline markdown: bold, italic, inline code, backtick
function renderInline(text: string): ReactNode {
  const parts: React.ReactNode[] = [];
  // Tokenize: `code`, **bold**, *italic*
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      parts.push(
        <code key={key++} className="text-[11px] font-mono bg-[var(--color-bg-raised)] text-[var(--color-accent-secondary)] px-1 rounded">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-[var(--color-text-primary)]">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(
        <em key={key++} className="italic">{token.slice(1, -1)}</em>
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
}
