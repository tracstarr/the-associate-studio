import { Wrench, CheckSquare, Brain, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranscript, useTodos } from "../../hooks/useClaudeData";
import { useActiveProjectTabs } from "../../hooks/useActiveProjectTabs";
import { useProjectsStore } from "../../stores/projectsStore";
import type { TranscriptItem } from "../../lib/tauri";
import { getHomeDir } from "../../lib/tauri";
import { cn, pathToProjectId } from "@/lib/utils";

export function ContextPanel() {
  const { openTabs, activeTabId } = useActiveProjectTabs();
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const activeTab = openTabs.find((t) => t.id === activeTabId);

  const { data: homeDir } = useQuery({
    queryKey: ["home-dir"],
    queryFn: getHomeDir,
    staleTime: Infinity,
  });

  // Use resolvedSessionId (set by watcher) first, fall back to sessionId
  const effectiveSessionId =
    activeTab?.resolvedSessionId ?? activeTab?.sessionId ?? null;

  const sessionPath =
    effectiveSessionId && activeProjectDir && homeDir
      ? `${homeDir}/.claude/projects/${pathToProjectId(activeProjectDir)}/${effectiveSessionId}.jsonl`
      : null;

  const { data: transcriptResult } = useTranscript(sessionPath ?? "", 0);
  const items = transcriptResult?.[0] ?? [];

  const { data: todos } = useTodos();

  const recentItems = items.slice(-20);

  if (!activeTab) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        No active session
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Todos section */}
      {todos && todos.length > 0 && (
        <div className="border-b border-[var(--color-border-default)]">
          <div className="flex items-center gap-2 px-3 py-2">
            <CheckSquare
              size={12}
              className="text-[var(--color-status-warning)]"
            />
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Todos
            </span>
          </div>
          <div className="pb-2">
            {todos
              .flatMap((f) => f.items)
              .slice(0, 5)
              .map((item, i) => (
                <div key={i} className="flex items-start gap-2 px-4 py-0.5">
                  <span className="text-[10px] mt-0.5 shrink-0 font-mono text-[var(--color-text-muted)]">
                    {item.status === "completed"
                      ? "+"
                      : item.status === "in_progress"
                        ? ">"
                        : "o"}
                  </span>
                  <span
                    className={cn(
                      "text-xs truncate",
                      item.status === "completed"
                        ? "line-through text-[var(--color-text-muted)]"
                        : "text-[var(--color-text-secondary)]"
                    )}
                  >
                    {item.content ?? "(empty)"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent transcript items */}
      <div className="flex-1 overflow-y-auto">
        {recentItems.length === 0 && (
          <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
            No transcript yet
          </div>
        )}
        {recentItems.map((item, i) => (
          <TranscriptItemRow key={i} item={item} />
        ))}
      </div>
    </div>
  );
}

function TranscriptItemRow({ item }: { item: TranscriptItem }) {
  const icons: Record<string, React.ReactNode> = {
    User: (
      <MessageSquare
        size={10}
        className="text-[var(--color-accent-primary)]"
      />
    ),
    Assistant: (
      <Brain size={10} className="text-[var(--color-accent-secondary)]" />
    ),
    ToolUse: (
      <Wrench size={10} className="text-[var(--color-status-warning)]" />
    ),
    ToolResult: (
      <Wrench size={10} className="text-[var(--color-text-muted)]" />
    ),
    System: (
      <span className="text-[10px] text-[var(--color-text-muted)]">SYS</span>
    ),
  };

  const icon = icons[item.kind] ?? null;
  const textPreview = item.text.slice(0, 200);

  return (
    <div
      className={cn(
        "px-3 py-2 border-b border-[var(--color-border-default)]",
        item.kind === "User" ? "bg-[var(--color-bg-surface)]" : ""
      )}
    >
      <div className="flex items-center gap-2 mb-0.5">
        {icon}
        <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase">
          {item.kind}
        </span>
        {item.timestamp && (
          <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] line-clamp-3 whitespace-pre-wrap break-words">
        {textPreview}
        {item.text.length > 200 && "..."}
      </p>
    </div>
  );
}

