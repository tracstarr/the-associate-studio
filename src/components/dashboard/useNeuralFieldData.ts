import { useMemo } from "react";
import { useProjectsStore } from "@/stores/projectsStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTeams } from "@/hooks/useClaudeData";

export type FieldNodeType = "project" | "session" | "agent";

export interface FieldNode {
  id: string;
  type: FieldNodeType;
  label: string;
  sublabel?: string;
  color: string;
  glowIntensity: number; // 0–1
  isActive: boolean;
  parentId?: string;
  projectId?: string; // root project this node belongs to
}

const PROJECT_COLOR = "#61afef";
const SESSION_COLOR = "#98c379";
const TEAM_COLOR = "#e5c07b";
const AGENT_COLOR = "#c678dd";
const MEMBER_COLOR = "#d19a66";

export function useNeuralFieldData(): FieldNode[] {
  const projects = useProjectsStore((s) => s.projects);
  const activeSubagents = useSessionStore((s) => s.activeSubagents);
  const knownSessions = useSessionStore((s) => s.knownSessions);
  const tabsByProject = useSessionStore((s) => s.tabsByProject);
  const { data: teams } = useTeams();

  return useMemo(() => {
    const nodes: FieldNode[] = [];

    // Project nodes
    for (const project of projects) {
      nodes.push({
        id: `project:${project.id}`,
        type: "project",
        label: project.name,
        sublabel: project.path.replace(/\\/g, "/").split("/").slice(-2).join("/"),
        color: PROJECT_COLOR,
        glowIntensity: 0.4,
        isActive: false,
        projectId: `project:${project.id}`,
      });
    }

    // Active/idle session nodes + their subagent nodes
    const visibleSessionEntries = Object.entries(knownSessions)
      .filter(([, status]) => status === "active" || status === "idle");

    for (const [sessionId, status] of visibleSessionEntries) {
      // Find the project this session belongs to
      let projectNodeId: string | undefined;
      outer: for (const [projectId, tabs] of Object.entries(tabsByProject)) {
        for (const tab of tabs) {
          if (tab.resolvedSessionId === sessionId) {
            projectNodeId = `project:${projectId}`;
            break outer;
          }
        }
      }

      if (!projectNodeId) continue; // skip sessions with no project tie

      const agents = activeSubagents[sessionId] ?? [];
      const isIdle = status === "idle";
      const sublabel = isIdle
        ? "waiting"
        : agents.length > 0
          ? `${agents.length} agent${agents.length !== 1 ? "s" : ""}`
          : "running";
      const glowIntensity = isIdle
        ? 0.3
        : agents.length > 0 ? 0.8 : 0.4;
      nodes.push({
        id: `session:${sessionId}`,
        type: "session",
        label: sessionId.slice(0, 8),
        sublabel,
        color: SESSION_COLOR,
        glowIntensity,
        isActive: !isIdle,
        parentId: projectNodeId,
        projectId: projectNodeId,
      });

      for (const agent of agents) {
        nodes.push({
          id: `agent:${agent.agent_id}`,
          type: "agent",
          label: agent.agent_type ?? "agent",
          sublabel: agent.agent_id.slice(0, 8),
          color: AGENT_COLOR,
          glowIntensity: 0.9,
          isActive: true,
          parentId: `session:${sessionId}`,
          projectId: projectNodeId,
        });
      }
    }

    // Team nodes + member nodes
    for (const team of teams ?? []) {
      const teamId = `team:${team.dirName}`;

      // Resolve team to a project via leadSessionId (only if lead is active or idle)
      const leadStatus = team.config.leadSessionId ? knownSessions[team.config.leadSessionId] : undefined;
      if (!leadStatus || (leadStatus !== "active" && leadStatus !== "idle")) continue;
      let teamProjectId: string | undefined;
      outer: for (const [pid, tabs] of Object.entries(tabsByProject)) {
        for (const tab of tabs) {
          if (tab.resolvedSessionId === team.config.leadSessionId) {
            teamProjectId = `project:${pid}`;
            break outer;
          }
        }
      }
      if (!teamProjectId) continue; // skip team — no clear project tie

      nodes.push({
        id: teamId,
        type: "session",
        label: team.dirName,
        sublabel: team.config.description ?? `${team.config.members.length} members`,
        color: TEAM_COLOR,
        glowIntensity: team.config.members.length > 0 ? 0.6 : 0.2,
        isActive: team.config.members.length > 0,
        projectId: teamProjectId,
      });

      for (const member of team.config.members) {
        nodes.push({
          id: `member:${team.dirName}:${member.name}`,
          type: "agent",
          label: member.name,
          sublabel: member.agentType,
          color: member.color ?? MEMBER_COLOR,
          glowIntensity: 0.5,
          isActive: true,
          parentId: teamId,
          projectId: teamProjectId,
        });
      }
    }

    return nodes;
  }, [projects, activeSubagents, knownSessions, tabsByProject, teams]);
}
