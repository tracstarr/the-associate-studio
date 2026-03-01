import { useState } from "react";
import { ClipboardList, ChevronRight, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSessionTasks } from "../../hooks/useClaudeData";
import { useActiveProjectTabs } from "../../hooks/useActiveProjectTabs";
import { useProjectsStore } from "../../stores/projectsStore";
import type { SessionTaskEvent } from "../../lib/tauri";
import { getHomeDir } from "../../lib/tauri";
import { cn } from "../../lib/utils";

interface DerivedStatusChange {
  status: string;
  at: string;
}

interface DerivedTaskRecord {
  id: string;
  subject?: string;
  firstSeen: string;
  lastSeen: string;
  statusChanges: DerivedStatusChange[];
}

function deriveTaskRecords(events: SessionTaskEvent[]): DerivedTaskRecord[] {
  const records = new Map<string, DerivedTaskRecord>();
  let createCount = 0;

  for (const event of events) {
    const at = event.timestamp ?? "";
    if (event.toolName === "TaskCreate") {
      createCount++;
      const id = String(createCount);
      records.set(id, {
        id,
        subject: event.input.subject as string | undefined,
        firstSeen: at,
        lastSeen: at,
        statusChanges: [{ status: "pending", at }],
      });
    } else if (event.toolName === "TaskUpdate") {
      const taskId = String(event.input.taskId);
      const record = records.get(taskId);
      if (record) {
        record.lastSeen = at;
        if (event.input.status !== undefined) {
          const newStatus = event.input.status as string;
          const lastStatus = record.statusChanges[record.statusChanges.length - 1]?.status;
          if (lastStatus !== newStatus) {
            record.statusChanges.push({ status: newStatus, at });
          }
        }
        if (event.input.subject !== undefined) {
          record.subject = event.input.subject as string;
        }
      }
    }
  }

  return Array.from(records.values()).sort((a, b) => {
    const aNum = parseInt(a.id, 10);
    const bNum = parseInt(b.id, 10);
    if (!isNaN(aNum) && !isNaN(bNum)) return bNum - aNum;
    return b.lastSeen.localeCompare(a.lastSeen);
  });
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  deleted: "Deleted",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-[var(--color-bg-raised)] text-[var(--color-text-muted)]",
  in_progress: "bg-blue-900/40 text-blue-300",
  completed: "bg-green-900/40 text-green-300",
  deleted: "bg-red-900/30 text-red-400",
};

function formatAt(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function TaskRecordRow({ record }: { record: DerivedTaskRecord }) {
  const [expanded, setExpanded] = useState(false);
  const lastStatus = record.statusChanges[record.statusChanges.length - 1]?.status ?? "pending";

  return (
    <div className="border-b border-[var(--color-border-muted)]">
      <button
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-left hover:bg-[var(--color-bg-raised)] transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-[var(--color-text-muted)]">
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded shrink-0",
            STATUS_COLORS[lastStatus] ?? STATUS_COLORS.pending
          )}
        >
          {STATUS_LABELS[lastStatus] ?? lastStatus}
        </span>
        <span className="text-xs text-[var(--color-text-primary)] truncate flex-1">
          {record.subject ?? record.id}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
          #{record.id}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-2 space-y-1">
          <div className="text-[10px] text-[var(--color-text-muted)]">
            First seen: {formatAt(record.firstSeen)}
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">
            Last seen: {formatAt(record.lastSeen)}
          </div>
          {record.statusChanges.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {record.statusChanges.map((sc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded",
                      STATUS_COLORS[sc.status] ?? STATUS_COLORS.pending
                    )}
                  >
                    {STATUS_LABELS[sc.status] ?? sc.status}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {formatAt(sc.at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskHistoryPanel() {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId ?? "");
  const { openTabs, activeTabId } = useActiveProjectTabs();
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const effectiveSessionId =
    activeTab?.resolvedSessionId ?? activeTab?.sessionId ?? null;

  const { data: homeDir } = useQuery({
    queryKey: ["home-dir"],
    queryFn: getHomeDir,
    staleTime: Infinity,
  });

  const sessionPath =
    homeDir && activeProjectId && effectiveSessionId
      ? `${homeDir}/.claude/projects/${activeProjectId}/${effectiveSessionId}.jsonl`
      : null;

  const { data: events, isLoading } = useSessionTasks(sessionPath);
  const records = deriveTaskRecords(events ?? []);

  if (!activeProjectId) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        Open a project to see task history
      </div>
    );
  }

  if (!sessionPath) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        Open a session to see task history
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)]">Loading...</div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        No tasks found in this session
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-bg-raised)] border-b border-[var(--color-border-muted)]">
        <ClipboardList size={10} className="text-[var(--color-accent-primary)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Task History
        </span>
        <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
          {records.length} task{records.length !== 1 ? "s" : ""}
        </span>
      </div>
      {records.map((record) => (
        <TaskRecordRow key={record.id} record={record} />
      ))}
    </div>
  );
}
