import { useState } from "react";
import { Users, ChevronRight, ChevronDown, Crown, Circle } from "lucide-react";
import { useTeams, useTasks } from "../../hooks/useClaudeData";
import { useProjectsStore } from "../../stores/projectsStore";
import { useActiveProjectTabs } from "../../hooks/useActiveProjectTabs";
import type { Team } from "../../lib/tauri";

export function TeamsPanel() {
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const { openTabs, activeTabId } = useActiveProjectTabs();
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const activeSessionId = activeTab?.resolvedSessionId;
  const { data: teams, isLoading } = useTeams(activeProjectDir ?? undefined);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const filteredTeams = activeSessionId
    ? (teams?.filter((t) => t.config?.leadSessionId === activeSessionId) ?? [])
    : [];
  const displayTeams = filteredTeams.length > 0 ? filteredTeams : (teams ?? []);

  if (isLoading) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)]">
        Loading...
      </div>
    );
  }

  if (!displayTeams || displayTeams.length === 0) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        No active teams
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {displayTeams.map((team) => (
        <TeamRow
          key={team.dirName}
          team={team}
          expanded={expandedTeam === team.dirName}
          onToggle={() =>
            setExpandedTeam(
              expandedTeam === team.dirName ? null : team.dirName
            )
          }
        />
      ))}
    </div>
  );
}

function TeamRow({
  team,
  expanded,
  onToggle,
}: {
  team: Team;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { data: tasks } = useTasks(team.dirName);
  const activeTasks = tasks?.filter((t) => t.status === "in_progress") ?? [];
  const pendingTasks = tasks?.filter((t) => t.status === "pending") ?? [];

  return (
    <div className="border-b border-[var(--color-border-default)]">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--color-bg-raised)] transition-colors"
      >
        {expanded ? (
          <ChevronDown
            size={10}
            className="text-[var(--color-text-muted)] shrink-0"
          />
        ) : (
          <ChevronRight
            size={10}
            className="text-[var(--color-text-muted)] shrink-0"
          />
        )}
        <Users
          size={12}
          className="text-[var(--color-accent-secondary)] shrink-0"
        />
        <span className="text-xs text-[var(--color-text-primary)] truncate flex-1">
          {team.config.name ?? team.dirName}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {team.config.members.length} members
        </span>
      </button>

      {expanded && (
        <div className="pl-6 pb-2">
          {/* Task summary */}
          {tasks && tasks.length > 0 && (
            <div className="px-3 py-1 flex gap-3 text-[10px] text-[var(--color-text-muted)]">
              <span className="text-[var(--color-status-success)]">
                {activeTasks.length} active
              </span>
              <span>{pendingTasks.length} pending</span>
              <span>
                {tasks.filter((t) => t.status === "completed").length} done
              </span>
            </div>
          )}
          {/* Members */}
          {team.config.members.map((member) => (
            <div key={member.name} className="flex items-center gap-2 px-3 py-1">
              <Circle
                size={6}
                className="shrink-0"
                style={{
                  color: member.color ?? "var(--color-text-muted)",
                  fill: "currentColor",
                }}
              />
              <span className="text-xs text-[var(--color-text-secondary)] truncate flex-1">
                {member.name}
              </span>
              {member.agentId === team.config.leadAgentId && (
                <Crown
                  size={10}
                  className="text-[var(--color-status-warning)] shrink-0"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
