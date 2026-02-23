import { useState, useRef, useEffect } from "react";
import { X, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { useDebugStore, type DebugEntry } from "@/stores/debugStore";
import { useUIStore } from "@/stores/uiStore";

const LEVEL_COLORS: Record<DebugEntry["level"], string> = {
  info: "var(--color-text-primary)",
  warn: "var(--color-status-warning)",
  error: "var(--color-status-error)",
  success: "var(--color-status-success)",
};

const CATEGORY_COLORS: Record<string, string> = {
  ReadmeTab: "var(--color-accent-primary)",
  Terminal: "var(--color-status-success)",
  PTY: "var(--color-accent-secondary)",
  Hooks: "var(--color-status-warning)",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "var(--color-text-muted)";
}

function DebugEntryRow({ entry }: { entry: DebugEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = entry.data !== undefined;
  const dataStr = hasData ? JSON.stringify(entry.data) : "";
  const preview = dataStr.length > 80 ? dataStr.slice(0, 80) + "..." : dataStr;

  return (
    <div
      className="px-3 py-1.5 border-b border-[var(--color-border-default)]/50 text-xs hover:bg-[var(--color-bg-surface)] transition-colors"
      style={{ color: LEVEL_COLORS[entry.level] }}
    >
      <div className="flex items-start gap-2">
        <span
          className="shrink-0 font-mono text-[10px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          {entry.timestamp}
        </span>
        <span
          className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{
            color: getCategoryColor(entry.category),
            backgroundColor: "var(--color-bg-base)",
            border: `1px solid ${getCategoryColor(entry.category)}40`,
          }}
        >
          {entry.category}
        </span>
        <span className="flex-1 break-words">{entry.message}</span>
      </div>
      {hasData && (
        <div className="mt-1 ml-[72px]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-0.5 text-[10px] font-mono hover:text-[var(--color-accent-primary)] transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {expanded ? "collapse" : preview}
          </button>
          {expanded && (
            <pre
              className="mt-1 p-2 rounded text-[10px] font-mono whitespace-pre-wrap break-all"
              style={{
                backgroundColor: "var(--color-bg-base)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border-default)",
              }}
            >
              {JSON.stringify(entry.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function DebugPanel() {
  if (!import.meta.env.DEV) return null;

  const entries = useDebugStore((s) => s.entries);
  const clearLog = useDebugStore((s) => s.clearLog);
  const debugPanelOpen = useUIStore((s) => s.debugPanelOpen);
  const toggleDebugPanel = useUIStore((s) => s.toggleDebugPanel);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (!debugPanelOpen) return null;

  return (
    <div
      className="fixed top-0 right-0 h-full flex flex-col border-l"
      style={{
        width: 380,
        zIndex: 9999,
        backgroundColor: "var(--color-bg-raised)",
        borderColor: "var(--color-border-default)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
        style={{ borderColor: "var(--color-border-default)" }}
      >
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Debug
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-mono"
          style={{
            backgroundColor: "var(--color-bg-base)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          {entries.length}
        </span>
        <div className="flex-1" />
        <button
          onClick={clearLog}
          className="p-1 rounded hover:bg-[var(--color-bg-surface)] transition-colors"
          style={{ color: "var(--color-text-muted)" }}
          title="Clear log"
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={toggleDebugPanel}
          className="p-1 rounded hover:bg-[var(--color-bg-surface)] transition-colors"
          style={{ color: "var(--color-text-muted)" }}
          title="Close"
        >
          <X size={13} />
        </button>
      </div>

      {/* Log list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              No debug entries
            </span>
          </div>
        ) : (
          entries.map((entry) => <DebugEntryRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
