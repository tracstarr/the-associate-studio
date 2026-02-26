import { useQuery } from "@tanstack/react-query";
import { Clock, Play, FileText } from "lucide-react";
import { readSummary } from "@/lib/tauri";
import type { SessionTab } from "@/stores/sessionStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useActiveProjectTabs } from "@/hooks/useActiveProjectTabs";
import { parseFrontmatter, FrontmatterBlock } from "@/lib/frontmatter";

interface SummaryViewProps {
  tab: SessionTab;
  projectId: string;
}

export function SummaryView({ tab, projectId }: SummaryViewProps) {
  const { openTabs } = useActiveProjectTabs(projectId);
  const openTab = useSessionStore((s) => s.openTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);

  const projectDir = tab.summaryProjectDir ?? "";
  const filename = tab.summaryFilename ?? "";

  const { data: content, isLoading } = useQuery({
    queryKey: ["summary", projectDir, filename],
    queryFn: () => readSummary(projectDir, filename),
    enabled: !!projectDir && !!filename,
    staleTime: 60_000,
  });

  const match = filename.match(/-summary-(\d+)\.md$/);
  const summaryNum = match ? parseInt(match[1], 10) : 1;

  const handleOpenSession = () => {
    if (!tab.sessionId || !projectId) return;
    // Find existing session-view or terminal tab for this session
    const existing = openTabs.find(
      (t) =>
        (t.type === "session-view" || !t.type || t.type === "terminal") &&
        (t.sessionId === tab.sessionId || t.resolvedSessionId === tab.sessionId)
    );
    if (existing) {
      setActiveTab(existing.id, projectId);
    } else {
      // Open a session-view tab
      const newTab: SessionTab = {
        id: `session-view:${tab.sessionId}`,
        type: "session-view",
        title: tab.sessionId?.slice(0, 8) ?? "Session",
        projectDir: "",
        sessionId: tab.sessionId,
      };
      openTab(newTab, projectId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-4 h-10 border-b border-[var(--color-border-muted)] bg-[var(--color-bg-surface)]">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={13} className="shrink-0 text-[var(--color-status-success)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            Summary {summaryNum}
          </span>
          {tab.sessionId && (
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
              {tab.sessionId.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono flex items-center gap-1">
            <Clock size={10} />
            {filename}
          </span>
          {tab.sessionId && (
            <button
              onClick={handleOpenSession}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--color-accent-primary)] text-white text-[10px] font-medium hover:opacity-90 transition-all duration-200"
            >
              <Play size={10} fill="currentColor" />
              Open Session
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-muted)]">
            Loading summary…
          </div>
        ) : !content ? (
          <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-muted)]">
            Summary not found
          </div>
        ) : (
          <MarkdownPreview content={content} />
        )}
      </div>
    </div>
  );
}

// ── Reused inline markdown renderer (same as PlanEditorView) ─────────────────

function MarkdownPreview({ content }: { content: string }) {
  const { fm, body } = parseFrontmatter(content);
  const blocks = parseBlocks(body);
  return (
    <div className="px-8 py-6 max-w-3xl mx-auto space-y-1.5 text-[var(--color-text-secondary)]">
      {fm && <FrontmatterBlock fm={fm} />}
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
      return <h1 className="text-xl font-bold text-[var(--color-text-primary)] mt-6 mb-3 first:mt-0">{block.text}</h1>;
    case "h2":
      return <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-5 mb-2 pt-2 border-t border-[var(--color-border-muted)]">{block.text}</h2>;
    case "h3":
      return <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mt-3 mb-1">{block.text}</h3>;
    case "hr":
      return <hr className="border-[var(--color-border-muted)] my-4" />;
    case "blank":
      return <div className="h-1" />;
    case "code":
      return (
        <pre className="bg-[var(--color-bg-raised)] border border-[var(--color-border-muted)] rounded-lg p-3 my-2 overflow-x-auto">
          <code className="text-xs font-mono text-[var(--color-accent-secondary)]">{block.lines.join("\n")}</code>
        </pre>
      );
    case "listitem":
      return (
        <div className="flex gap-2 text-sm" style={{ paddingLeft: `${block.depth * 16 + 4}px` }}>
          <span className="text-[var(--color-status-success)] shrink-0 mt-0.5">•</span>
          <span>{block.text}</span>
        </div>
      );
    case "paragraph":
      return <p className="text-sm leading-relaxed">{block.text}</p>;
  }
}
