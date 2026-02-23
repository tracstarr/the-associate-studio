import { useTeams, useTasks } from "../../hooks/useClaudeData";
import { useProjectsStore } from "../../stores/projectsStore";
import { Crown, Circle } from "lucide-react";
import type { Team } from "../../lib/tauri";

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
    <div className="space-y-3 p-2">
      {teams.map((team) => (
        <TeamCard key={team.dirName} team={team} />
      ))}
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  const { data: tasks } = useTasks(team.dirName);
  const activeTasks = tasks?.filter((t) => t.status === "in_progress") ?? [];

  return (
    <div className="border border-[var(--color-border-default)] rounded bg-[var(--color-bg-surface)]">
      <div className="px-3 py-2 border-b border-[var(--color-border-default)]">
        <p className="text-xs font-medium text-[var(--color-text-primary)]">
          {team.config.name ?? team.dirName}
        </p>
        {team.config.description && (
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
            {team.config.description}
          </p>
        )}
      </div>
      <div className="px-3 py-2 space-y-1">
        {team.config.members.map((member) => {
          const memberTasks = activeTasks.filter(
            (t) => t.owner === member.name
          );
          return (
            <div key={member.name} className="flex items-center gap-2">
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
              {memberTasks.length > 0 && (
                <span className="text-[10px] text-[var(--color-status-success)]">
                  {memberTasks[0].activeForm ??
                    memberTasks[0].subject ??
                    "working"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {tasks && tasks.length > 0 && (
        <div className="px-3 py-1.5 border-t border-[var(--color-border-default)] flex gap-3 text-[10px]">
          <span className="text-[var(--color-status-success)]">
            {activeTasks.length} active
          </span>
          <span className="text-[var(--color-text-muted)]">
            {tasks.filter((t) => t.status === "pending").length} pending
          </span>
          <span className="text-[var(--color-text-muted)]">
            {tasks.filter((t) => t.status === "completed").length} done
          </span>
        </div>
      )}
    </div>
  );
}
