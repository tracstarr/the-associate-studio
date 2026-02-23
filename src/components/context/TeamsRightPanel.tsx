import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTeams, useTasks, useInbox } from "../../hooks/useClaudeData";
import { useProjectsStore } from "../../stores/projectsStore";
import { deleteTeam, sendInboxMessage } from "../../lib/tauri";
import {
  Crown,
  Circle,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  Send,
} from "lucide-react";
import type { Team, Task, TeamMember } from "../../lib/tauri";

export function TeamsRightPanel() {
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const { data: teams, isLoading } = useTeams(activeProjectDir ?? undefined);

  if (isLoading) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)]">
        Loading...
      </div>
    );
  }
  if (!teams?.length) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        No active teams
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="space-y-3 p-2">
        {teams.map((team) => (
          <TeamCard key={team.dirName} team={team} />
        ))}
      </div>
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  const queryClient = useQueryClient();
  const { data: tasks } = useTasks(team.dirName);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeTasks = tasks?.filter((t) => t.status === "in_progress") ?? [];
  const pendingTasks = tasks?.filter((t) => t.status === "pending") ?? [];
  const completedTasks = tasks?.filter((t) => t.status === "completed") ?? [];

  const isDone =
    (tasks?.length ?? 0) > 0 &&
    tasks!.every((t) => t.status === "completed" || t.status === "deleted");

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    let failed = false;
    try {
      await deleteTeam(team.dirName);
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    } catch (e) {
      console.error(e);
      failed = true;
      setDeleteError("Delete failed");
    } finally {
      setDeleting(false);
      if (!failed) setConfirmDelete(false);
    }
  };

  const toggleMember = (name: string) => {
    setExpandedMember((prev) => (prev === name ? null : name));
  };

  return (
    <div
      className="border border-[var(--color-border-default)] rounded bg-[var(--color-bg-surface)]"
      style={{ opacity: isDone ? 0.6 : 1 }}
    >
      {/* Card Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border-default)]">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-[var(--color-text-primary)] flex-1 truncate">
            {team.config.name ?? team.dirName}
          </p>
          {isDone && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-status-success)] bg-opacity-20 text-[var(--color-status-success)] shrink-0 flex items-center gap-0.5">
              Done <Check size={8} />
            </span>
          )}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-status-error)] shrink-0"
              title="Delete team"
            >
              <X size={12} />
            </button>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              {deleteError && (
                <span className="text-[10px] text-[var(--color-status-error)]">
                  {deleteError}
                </span>
              )}
              <span className="text-[10px] text-[var(--color-text-muted)]">
                Delete?
              </span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-status-error)] text-white disabled:opacity-40"
              >
                {deleting ? "..." : "Yes"}
              </button>
              <button
                onClick={() => { setConfirmDelete(false); setDeleteError(null); }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)]"
              >
                No
              </button>
            </div>
          )}
        </div>
        {team.config.description && (
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
            {team.config.description}
          </p>
        )}
      </div>

      {/* Member Rows */}
      <div className="divide-y divide-[var(--color-border-default)]">
        {team.config.members.map((member) => {
          const isExpanded = expandedMember === member.name;
          const memberActiveTasks = activeTasks.filter(
            (t) => t.owner === member.name
          );
          return (
            <div key={member.name}>
              <button
                onClick={() => toggleMember(member.name)}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--color-bg-raised)] text-left"
              >
                <Circle
                  size={6}
                  style={{
                    color: member.color ?? "var(--color-text-muted)",
                    fill: "currentColor",
                  }}
                  className="shrink-0"
                />
                <span className="text-xs text-[var(--color-text-secondary)] flex-1 truncate">
                  {member.name}
                </span>
                {member.agentId === team.config.leadAgentId && (
                  <Crown
                    size={10}
                    className="text-[var(--color-status-warning)] shrink-0"
                  />
                )}
                {memberActiveTasks.length > 0 && (
                  <span className="text-[10px] text-[var(--color-status-success)] truncate max-w-[80px]">
                    {memberActiveTasks[0].activeForm ??
                      memberActiveTasks[0].subject ??
                      "working"}
                  </span>
                )}
                {isExpanded ? (
                  <ChevronDown
                    size={12}
                    className="text-[var(--color-text-muted)] shrink-0"
                  />
                ) : (
                  <ChevronRight
                    size={12}
                    className="text-[var(--color-text-muted)] shrink-0"
                  />
                )}
              </button>
              {isExpanded && (
                <MemberDetail
                  team={team}
                  member={member}
                  tasks={tasks ?? []}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Task Summary Footer */}
      {tasks && tasks.length > 0 && (
        <div className="px-3 py-1.5 border-t border-[var(--color-border-default)] flex gap-3 text-[10px]">
          <span className="text-[var(--color-status-success)]">
            {activeTasks.length} active
          </span>
          <span className="text-[var(--color-text-muted)]">
            {pendingTasks.length} pending
          </span>
          <span className="text-[var(--color-text-muted)]">
            {completedTasks.length} done
          </span>
        </div>
      )}
    </div>
  );
}

function MemberDetail({
  team,
  member,
  tasks,
}: {
  team: Team;
  member: TeamMember;
  tasks: Task[];
}) {
  const memberTasks = tasks.filter(
    (t) => t.owner === member.name && t.status !== "deleted"
  );
  const { data: messages } = useInbox(team.dirName, member.name);
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);

  const visibleMessages =
    messages?.filter((m) => {
      if (!m.text.startsWith("{")) return true;
      try {
        const p = JSON.parse(m.text);
        return (
          p.type === "message" ||
          p.type === "task_completed" ||
          p.type === "plan_approval_request"
        );
      } catch {
        return true;
      }
    }) ?? [];

  const handleSend = async () => {
    if (!composeText.trim()) return;
    setSending(true);
    try {
      await sendInboxMessage(
        team.dirName,
        member.name,
        "team-lead",
        composeText.trim()
      );
      setComposeText("");
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-[var(--color-bg-raised)]">
      {/* Member Tasks */}
      {memberTasks.length > 0 && (
        <div className="px-3 py-2 border-b border-[var(--color-border-default)]">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-1">
            Tasks
          </p>
          <div className="space-y-0.5">
            {memberTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-1.5">
                <span className="text-[10px] shrink-0 mt-px text-[var(--color-text-muted)]">
                  {task.status === "in_progress"
                    ? "›"
                    : task.status === "completed"
                      ? "✓"
                      : "○"}
                </span>
                <span className="text-[10px] text-[var(--color-text-secondary)] line-clamp-2">
                  {task.activeForm ?? task.subject ?? task.id}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inbox Messages */}
      {visibleMessages.length > 0 && (
        <div className="max-h-32 overflow-y-auto divide-y divide-[var(--color-border-default)]">
          {visibleMessages.map((msg, i) => {
            let text = msg.text;
            if (text.startsWith("{")) {
              try {
                text = JSON.parse(text).content ?? text;
              } catch {
                /* use raw */
              }
            }
            return (
              <div key={i} className="px-3 py-1.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-[10px] font-medium"
                    style={{
                      color: msg.color ?? "var(--color-text-secondary)",
                    }}
                  >
                    {msg.from}
                  </span>
                  {msg.timestamp && (
                    <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--color-text-primary)] whitespace-pre-wrap break-words line-clamp-3">
                  {text}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {visibleMessages.length === 0 && memberTasks.length === 0 && (
        <div className="px-3 py-2 text-[10px] text-[var(--color-text-muted)]">
          No activity
        </div>
      )}

      {/* Compose */}
      <div className="p-2 border-t border-[var(--color-border-default)]">
        <div className="flex gap-1">
          <input
            value={composeText}
            onChange={(e) => setComposeText(e.target.value)}
            placeholder={`Message ${member.name}...`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            className="flex-1 text-[10px] px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-border-focus)]"
          />
          <button
            onClick={handleSend}
            disabled={!composeText.trim() || sending}
            className="px-1.5 py-1 rounded bg-[var(--color-accent-primary)] text-white disabled:opacity-40"
          >
            <Send size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}
