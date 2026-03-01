import { useState } from "react";
import { ClipboardList, ChevronRight, ChevronDown } from "lucide-react";
import { useTaskSnapshots } from "../../hooks/useClaudeData";
import { useProjectsStore } from "../../stores/projectsStore";
import { useTeams } from "../../hooks/useClaudeData";
import type { TaskRecord } from "../../lib/tauri";
import { cn } from "../../lib/utils";

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

function TaskRecordRow({ record }: { record: TaskRecord }) {
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

function TeamTaskHistory({
  projectDir,
  teamName,
}: {
  projectDir: string;
  teamName: string;
}) {
  const { data } = useTaskSnapshots(projectDir, teamName);

  const records = data
    ? Object.values(data.tasks).sort((a, b) => {
        const aNum = parseInt(a.id, 10);
        const bNum = parseInt(b.id, 10);
        if (!isNaN(aNum) && !isNaN(bNum)) return bNum - aNum;
        return b.lastSeen.localeCompare(a.lastSeen);
      })
    : [];

  if (records.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--color-bg-raised)] border-b border-[var(--color-border-muted)]">
        <ClipboardList size={10} className="text-[var(--color-accent-secondary)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {teamName}
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

export function TaskHistoryPanel() {
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const activeProjectId = useProjectsStore((s) => s.activeProjectId ?? "");
  const { data: teams, isLoading } = useTeams(activeProject?.path);

  if (!activeProject) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        Open a project to see task history
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)]">Loading...</div>
    );
  }

  const teamNames = (teams ?? []).map((t) => t.dirName);

  if (teamNames.length === 0) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        No teams found for this project
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
      </div>
      {teamNames.map((teamName) => (
        <TeamTaskHistory
          key={teamName}
          projectDir={activeProjectId}
          teamName={teamName}
        />
      ))}
    </div>
  );
}
