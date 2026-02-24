import { useState, useRef, useEffect } from "react";
import { Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { useDebugStore, type DebugEntry } from "@/stores/debugStore";
import { cn } from "@/lib/utils";

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
  GitAction: "var(--color-accent-primary)",
  Settings: "var(--color-text-secondary)",
  Projects: "var(--color-accent-secondary)",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "var(--color-text-muted)";
}

type LevelFilter = "all" | DebugEntry["level"];

const LEVEL_FILTERS: { id: LevelFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "info", label: "Info" },
  { id: "warn", label: "Warn" },
  { id: "error", label: "Error" },
  { id: "success", label: "Success" },
];

function DebugEntryRow({ entry }: { entry: DebugEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = entry.data !== undefined;
  const dataStr = hasData ? JSON.stringify(entry.data) : "";
  const preview = dataStr.length > 80 ? dataStr.slice(0, 80) + "..." : dataStr;

  return (
    <div
      className="px-3 py-1.5 border-b border-[var(--color-border-muted)]/50 text-xs hover:bg-[var(--color-bg-surface)] transition-all duration-200"
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
          className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
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
            className="inline-flex items-center gap-0.5 text-[10px] font-mono hover:text-[var(--color-accent-primary)] transition-all duration-200"
            style={{ color: "var(--color-text-muted)" }}
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {expanded ? "collapse" : preview}
          </button>
          {expanded && (
            <pre
              className="mt-1 p-2 rounded-md text-[10px] font-mono whitespace-pre-wrap break-all"
              style={{
                backgroundColor: "var(--color-bg-base)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border-muted)",
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
  const entries = useDebugStore((s) => s.entries);
  const clearLog = useDebugStore((s) => s.clearLog);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");

  const filteredEntries =
    levelFilter === "all" ? entries : entries.filter((e) => e.level === levelFilter);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0 flex-wrap"
        style={{ borderColor: "var(--color-border-muted)" }}
      >
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Debug
        </span>
        <span
          className="px-1.5 py-0.5 rounded-md text-[10px] font-mono"
          style={{
            backgroundColor: "var(--color-bg-base)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border-muted)",
          }}
        >
          {entries.length}
        </span>
        {/* Level filter */}
        <div className="flex items-center gap-0.5">
          {LEVEL_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setLevelFilter(f.id)}
              className={cn(
                "px-1.5 py-0.5 rounded-md text-[10px] font-mono transition-all duration-200",
                levelFilter === f.id
                  ? "bg-bg-overlay text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={clearLog}
          className="p-1 rounded-md hover:bg-[var(--color-bg-surface)] transition-all duration-200"
          style={{ color: "var(--color-text-muted)" }}
          title="Clear log"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Log list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span
              className="text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              No debug entries
            </span>
          </div>
        ) : (
          filteredEntries.map((entry) => <DebugEntryRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
