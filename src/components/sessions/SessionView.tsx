import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Clock, GitBranch, MessageSquare, Brain, Wrench, Hash, Zap, ChevronDown, ChevronRight, CheckCircle2, ExternalLink } from "lucide-react";
import { useTranscript, useSessions, useSummaries } from "@/hooks/useClaudeData";
import { getHomeDir } from "@/lib/tauri";
import type { SessionTab } from "@/stores/sessionStore";
import { useSessionStore } from "@/stores/sessionStore";
import { cn, pathToProjectId } from "@/lib/utils";
import type { TranscriptItem } from "@/lib/tauri";

export function SessionView({ tab, projectId }: { tab: SessionTab; projectId: string }) {
  const [summariesOpen, setSummariesOpen] = useState(true);

  const { data: homeDir } = useQuery({
    queryKey: ["homeDir"],
    queryFn: getHomeDir,
    staleTime: Infinity,
  });

  const { data: sessions } = useSessions(tab.projectDir);
  const session = sessions?.find((s) => s.sessionId === tab.sessionId);

  const knownSessions = useSessionStore((s) => s.knownSessions);
  const openSummaryTab = useSessionStore((s) => s.openSummaryTab);
  const isSubAgent = tab.id.startsWith("subagent:");
  const isActive =
    (tab.sessionId ? knownSessions[tab.sessionId] : false) ||
    (tab.resolvedSessionId ? knownSessions[tab.resolvedSessionId] : false);

  const encodedProjectDir = pathToProjectId(tab.projectDir);

  // tab.filePath is set for subagent sessions (direct path override); otherwise derive from sessionId
  const sessionPath =
    tab.filePath ||
    (homeDir && tab.sessionId
      ? `${homeDir}/.claude/projects/${encodedProjectDir}/${tab.sessionId}.jsonl`
      : "");

  const { data: transcriptResult, isLoading } = useTranscript(sessionPath, 0);
  const { data: summaries } = useSummaries(encodedProjectDir, tab.sessionId ?? "");

  const items = transcriptResult?.[0] ?? [];
  const filtered = items
    .filter((item) => item.kind !== "System" && item.kind !== "Progress" && item.kind !== "Other")
    .slice()
    .reverse();

  const handleResume = () => {
    useSessionStore.getState().resumeTab(tab.id, projectId);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[var(--color-bg-base)]">
      {/* Header */}
      <div className="shrink-0 flex items-start justify-between gap-4 px-4 py-3 border-b border-[var(--color-border-muted)] bg-[var(--color-bg-surface)]">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {tab.title}
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            {isActive && (
              <span className="flex items-center gap-1 text-[11px] text-[var(--color-status-success)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-success)] animate-pulse" />
                Active
              </span>
            )}
            {session?.gitBranch && (
              <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                <GitBranch size={10} />
                {session.gitBranch}
              </span>
            )}
            {session?.messageCount !== undefined && (
              <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                <Hash size={10} />
                {session.messageCount} messages
              </span>
            )}
            {session?.modified && (
              <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                <Clock size={10} />
                {formatDate(session.modified)}
              </span>
            )}
            {tab.sessionId && (
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                {tab.sessionId.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
        {!isSubAgent && (
          isActive ? (
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-status-success)] text-[var(--color-status-success)] text-sm">
              <Zap size={14} />
              Running
            </div>
          ) : (
            <button
              onClick={handleResume}
              className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-all duration-200"
              title="Resume Session (Ctrl+R)"
            >
              <Play size={14} fill="currentColor" />
              Resume Session
            </button>
          )
        )}
      </div>

      {/* Summaries section */}
      {tab.sessionId && (
        <div className="shrink-0 border-b border-[var(--color-border-muted)]">
          <button
            className="w-full flex items-center gap-2 px-4 py-2 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)] transition-all duration-200"
            onClick={() => setSummariesOpen((o) => !o)}
          >
            {summariesOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <CheckCircle2 size={11} className="text-[var(--color-status-success)]" />
            Summaries
            {summaries && summaries.length > 0 && (
              <span className="ml-auto text-[10px] text-[var(--color-status-success)]">
                {summaries.length}
              </span>
            )}
          </button>
          {summariesOpen && (
            <div className="px-4 pb-2">
              {!summaries || summaries.length === 0 ? (
                <p className="text-[11px] text-[var(--color-text-muted)] py-1">
                  No summaries yet
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {summaries.map((s) => {
                    const match = s.filename.match(/-summary-(\d+)\.md$/);
                    const num = match ? parseInt(match[1], 10) : 1;
                    return (
                      <div
                        key={s.filename}
                        className="flex items-start justify-between gap-2 py-1.5 border-b border-[var(--color-border-muted)] last:border-0"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={10} className="shrink-0 text-[var(--color-status-success)]" />
                            <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                              Summary {num}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">
                              {formatCreated(s.created)}
                            </span>
                          </div>
                          {s.preview && (
                            <p className="text-[10px] text-[var(--color-text-muted)] line-clamp-2 leading-relaxed pl-4">
                              {s.preview}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            openSummaryTab(tab.sessionId!, s.filename, encodedProjectDir, projectId)
                          }
                          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] bg-[var(--color-status-success)]/15 text-[var(--color-status-success)] hover:bg-[var(--color-status-success)]/25 transition-all duration-200 font-medium"
                        >
                          <ExternalLink size={9} />
                          Open
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Transcript — newest first */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="px-4 py-6 text-xs text-[var(--color-text-muted)] text-center">
            Loading transcript…
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="px-4 py-6 text-xs text-[var(--color-text-muted)] text-center">
            No messages yet
          </div>
        )}
        {filtered.map((item, i) => (
          <TranscriptRow key={`${item.timestamp ?? i}-${item.kind ?? i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function TranscriptRow({ item }: { item: TranscriptItem }) {
  const isUser = item.kind === "User";
  const isAssistant = item.kind === "Assistant";
  const isTool = item.kind === "ToolUse" || item.kind === "ToolResult";

  const Icon = isUser ? MessageSquare : isAssistant ? Brain : Wrench;
  const iconColor = isUser
    ? "text-[var(--color-accent-primary)]"
    : isAssistant
      ? "text-[var(--color-accent-secondary)]"
      : "text-[var(--color-status-warning)]";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 border-b border-[var(--color-border-muted)]",
        isUser ? "bg-[var(--color-bg-surface)]" : "bg-[var(--color-bg-base)]"
      )}
    >
      <Icon size={13} className={cn("shrink-0 mt-0.5", iconColor)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
            {item.kind === "ToolUse"
              ? "Tool"
              : item.kind === "ToolResult"
                ? "Result"
                : item.kind}
          </span>
          {item.timestamp && (
            <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
              {formatTime(item.timestamp)}
            </span>
          )}
        </div>
        <p
          className={cn(
            "text-xs leading-relaxed whitespace-pre-wrap break-words",
            isTool
              ? "text-[var(--color-text-muted)] font-mono"
              : "text-[var(--color-text-secondary)]"
          )}
        >
          {item.text}
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatCreated(epochSecs: number): string {
  if (!epochSecs) return "";
  const d = new Date(epochSecs * 1000);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
