import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTeams, useTasks, useInbox } from "../../hooks/useClaudeData";
import { useProjectsStore } from "../../stores/projectsStore";
import { useSessionStore } from "../../stores/sessionStore";
import { deleteTeam, sendInboxMessage } from "../../lib/tauri";
import {
  Crown,
  Circle,
  ChevronDown,
  ChevronRight,
  X,
  Send,
  Zap,
  ExternalLink,
} from "lucide-react";
import type { Team, Task, TeamMember } from "../../lib/tauri";

const shortModel = (model?: string): string => {
  if (!model) return "?";
  if (model.includes("haiku")) return "haiku";
  if (model.includes("sonnet")) return "sonnet";
  if (model.includes("opus")) return "opus";
  return model.slice(0, 8);
};

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
  const activeSubagents = useSessionStore((s) => s.activeSubagents);
  const openTab = useSessionStore((s) => s.openTab);
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? ""
  );
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const leadSessionId = team.config.leadSessionId;
  const runningAgents = leadSessionId
    ? (activeSubagents[leadSessionId] ?? [])
    : Object.values(activeSubagents).flat();

  const isMemberActive = (member: TeamMember) =>
    runningAgents.some(
      (a) =>
        a.agent_id === member.name ||
        a.agent_id === member.agentId ||
        (a.agent_id?.includes(member.name) ?? false)
    );

  const visibleTasks =
    tasks?.filter((t) => t.status !== "deleted") ?? [];

  const sortedTasks = [...visibleTasks].sort((a, b) => {
    const order: Record<string, number> = { in_progress: 0, pending: 1, completed: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  const isDone =
    (tasks?.length ?? 0) > 0 &&
    tasks!.every((t) => t.status === "completed" || t.status === "deleted");

  if (tasks !== undefined && isDone) return null;

  const handleOpenSession = () => {
    if (!leadSessionId || !projectId) return;
    openTab(
      {
        id: `session-view:${leadSessionId}`,
        type: "session-view",
        projectDir: activeProjectDir,
        sessionId: leadSessionId,
        title: team.config.name ?? team.dirName,
      },
      projectId
    );
  };

  const leadMember = team.config.members.find(
    (m) => m.agentId === team.config.leadAgentId
  );
  const originalPrompt = leadMember?.prompt ?? team.config.description;

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    let failed = false;
    try {
      await deleteTeam(team.dirName);
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[deleteTeam] failed for", team.dirName, "—", msg, e);
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

  const memberByName = (name?: string) =>
    team.config.members.find((m) => m.name === name);

  return (
    <div className="border border-[var(--color-border-default)] rounded bg-[var(--color-bg-surface)]">
      {/* Card Header */}
      <div className="px-3 py-2 border-b border-[var(--color-border-default)]">
        <div className="flex items-center gap-2">
          {leadSessionId ? (
            <button
              onClick={handleOpenSession}
              className="text-xs font-medium text-[var(--color-text-primary)] hover:underline text-left truncate flex-1 flex items-center gap-1"
            >
              <span className="truncate">{team.config.name ?? team.dirName}</span>
              <ExternalLink size={10} className="shrink-0 text-[var(--color-text-muted)]" />
            </button>
          ) : (
            <p className="text-xs font-medium text-[var(--color-text-primary)] flex-1 truncate">
              {team.config.name ?? team.dirName}
            </p>
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
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteError(null);
                }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)]"
              >
                No
              </button>
            </div>
          )}
        </div>
        {originalPrompt && (
          <p className="text-[10px] italic text-[var(--color-text-muted)] mt-1 line-clamp-2 border-l-2 border-[var(--color-border-default)] pl-2">
            {originalPrompt}
          </p>
        )}
      </div>

      {/* Tasks Section */}
      {sortedTasks.length > 0 && (
        <div className="border-b border-[var(--color-border-default)]">
          <p className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
            Tasks
          </p>
          <div className="pb-1">
            {sortedTasks.map((task) => {
              const owner = memberByName(task.owner);
              const isActive = task.status === "in_progress";
              const isDoneTask = task.status === "completed";
              const isBlocked = task.blockedBy.length > 0;

              return (
                <div
                  key={task.id}
                  className="px-3 py-1 flex items-center gap-1.5"
                  style={{ opacity: isDoneTask ? 0.45 : 1 }}
                >
                  {/* Status glyph */}
                  <span
                    className="text-[11px] shrink-0 w-3 text-center"
                    style={{
                      color: isActive
                        ? "var(--color-status-success)"
                        : "var(--color-text-secondary)",
                    }}
                  >
                    {isActive ? "▶" : isDoneTask ? "✓" : "○"}
                  </span>

                  {/* Task ID */}
                  <span className="text-[9px] text-[var(--color-text-secondary)] shrink-0 font-mono opacity-70">
                    #{task.id}
                  </span>

                  {/* Task text */}
                  <span
                    className="text-[10px] flex-1 truncate"
                    style={{
                      color: isActive
                        ? "var(--color-text-primary)"
                        : "var(--color-text-primary)",
                    }}
                  >
                    {isActive && task.activeForm
                      ? task.activeForm
                      : (task.subject ?? task.id)}
                  </span>

                  {/* Blocked badge */}
                  {isBlocked && !isDoneTask && (
                    <span className="text-[9px] px-1 py-px rounded bg-[var(--color-status-warning)] bg-opacity-20 text-[var(--color-status-warning)] shrink-0">
                      blocked
                    </span>
                  )}

                  {/* Owner dot */}
                  {owner && (
                    <span
                      className="text-[9px] truncate max-w-[56px] shrink-0"
                      style={{ color: owner.color ?? "var(--color-text-secondary)" }}
                      title={owner.name}
                    >
                      ● {owner.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agents Section */}
      <div className="divide-y divide-[var(--color-border-default)]">
        <p className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
          Agents
        </p>
        {team.config.members.map((member) => {
          const isExpanded = expandedMember === member.name;
          const active = isMemberActive(member);
          const isLead = member.agentId === team.config.leadAgentId;
          const inProgressTask = visibleTasks.find(
            (t) => t.owner === member.name && t.status === "in_progress"
          );

          return (
            <div key={member.name}>
              <button
                onClick={() => toggleMember(member.name)}
                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[var(--color-bg-raised)] text-left"
              >
                {/* Active/idle indicator */}
                {active ? (
                  <Zap
                    size={8}
                    className="shrink-0"
                    style={{
                      color: member.color ?? "var(--color-status-success)",
                      fill: "currentColor",
                    }}
                  />
                ) : (
                  <Circle
                    size={6}
                    className="shrink-0"
                    style={{
                      color: member.color ?? "var(--color-text-secondary)",
                    }}
                  />
                )}

                {/* Name */}
                <span className="text-xs text-[var(--color-text-primary)] truncate flex-1">
                  {member.name}
                </span>

                {/* Lead crown + session chip */}
                {isLead && (
                  <>
                    <Crown
                      size={10}
                      className="text-[var(--color-status-warning)] shrink-0"
                    />
                    {leadSessionId && (
                      <span className="text-[9px] font-mono text-[var(--color-text-muted)] truncate max-w-[60px] shrink-0">
                        {leadSessionId.slice(0, 8)}
                      </span>
                    )}
                  </>
                )}

                {/* Model badge */}
                {member.model && (
                  <span className="text-[9px] px-1 py-px rounded bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)] shrink-0 font-mono border border-[var(--color-border-default)]">
                    {shortModel(member.model)}
                  </span>
                )}

                {/* Status text */}
                <span
                  className="text-[10px] truncate max-w-[72px] shrink-0"
                  style={{
                    color: active
                      ? "var(--color-status-success)"
                      : "var(--color-text-secondary)",
                  }}
                >
                  {active && inProgressTask
                    ? (inProgressTask.activeForm ?? inProgressTask.subject ?? "working")
                    : active
                      ? "active"
                      : "idle"}
                </span>

                {/* Expand chevron */}
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
      {/* Agent metadata */}
      {(member.agentType || member.model) && (
        <div className="px-3 py-1.5 border-b border-[var(--color-border-default)] flex items-center gap-2 flex-wrap">
          {member.agentType && (
            <span className="text-[9px] px-1.5 py-px rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] font-mono">
              {member.agentType}
            </span>
          )}
          {member.model && (
            <span className="text-[9px] text-[var(--color-text-secondary)] truncate">
              {member.model}
            </span>
          )}
        </div>
      )}

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
