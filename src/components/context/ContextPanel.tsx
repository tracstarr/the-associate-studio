import { useState } from "react";
import { CheckSquare, Brain, ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTodos, useSessionTasks } from "../../hooks/useClaudeData";
import { useActiveProjectTabs } from "../../hooks/useActiveProjectTabs";
import { useProjectsStore } from "../../stores/projectsStore";
import { useSessionStore } from "../../stores/sessionStore";
import type { FileEntry, SessionTaskEvent, Task, TaskStatus } from "../../lib/tauri";
import { getHomeDir, listDir } from "../../lib/tauri";
import { cn, pathToProjectId } from "@/lib/utils";
import { ExtensionsSection } from "./ExtensionsSection";

function deriveCurrentTasks(events: SessionTaskEvent[]): Task[] {
  const tasks = new Map<string, Task>();
  let createCount = 0;

  for (const event of events) {
    if (event.toolName === "TaskCreate") {
      createCount++;
      const id = String(createCount);
      tasks.set(id, {
        id,
        subject: event.input.subject as string | undefined,
        description: event.input.description as string | undefined,
        status: "pending",
        owner: undefined,
        blocks: [],
        blockedBy: [],
        activeForm: event.input.activeForm as string | undefined,
      });
    } else if (event.toolName === "TaskUpdate") {
      const taskId = String(event.input.taskId);
      const task = tasks.get(taskId);
      if (task) {
        if (event.input.status !== undefined) {
          task.status = event.input.status as TaskStatus;
        }
        if (event.input.subject !== undefined) {
          task.subject = event.input.subject as string;
        }
        if (event.input.owner !== undefined) {
          task.owner = event.input.owner as string;
        }
        if (event.input.activeForm !== undefined) {
          task.activeForm = event.input.activeForm as string;
        }
        if (event.input.description !== undefined) {
          task.description = event.input.description as string;
        }
        if (event.input.status === "deleted") {
          tasks.delete(taskId);
        }
      }
    }
  }

  return Array.from(tasks.values());
}

export function ContextPanel() {
  const { openTabs, activeTabId } = useActiveProjectTabs();
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const activeProjectId = useProjectsStore((s) => s.activeProjectId ?? "");
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
    homeDir && activeProjectId && effectiveSessionId
      ? `${homeDir}/.claude/projects/${activeProjectId}/${effectiveSessionId}.jsonl`
      : null;

  const { data: sessionTaskEvents } = useSessionTasks(sessionPath);
  const { data: todos } = useTodos();

  const allDerived = deriveCurrentTasks(sessionTaskEvents ?? []);
  const statusOrder: Record<string, number> = { in_progress: 0, pending: 1, completed: 2 };
  const displayTasks = [...allDerived]
    .sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3))
    .slice(0, 8);

  if (!activeTab) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        No active session
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Session tasks section */}
      {displayTasks.length > 0 && (
        <div className="border-b border-[var(--color-border-muted)]">
          <div className="flex items-center gap-2 px-3 py-2">
            <CheckSquare
              size={12}
              className="text-[var(--color-status-warning)]"
            />
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              Tasks
            </span>
          </div>
          <div className="pb-2">
            {displayTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-2 px-4 py-0.5">
                <span className="text-[10px] mt-0.5 shrink-0 font-mono text-[var(--color-text-muted)]">
                  {task.status === "completed"
                    ? "+"
                    : task.status === "in_progress"
                      ? ">"
                      : "o"}
                </span>
                <span
                  className={cn(
                    "text-xs truncate flex-1",
                    task.status === "completed"
                      ? "line-through text-[var(--color-text-muted)]"
                      : "text-[var(--color-text-secondary)]"
                  )}
                >
                  {task.status === "in_progress" && task.activeForm
                    ? task.activeForm
                    : (task.subject ?? "(untitled)")}
                </span>
                {task.owner && (
                  <span className="text-[10px] shrink-0 text-[var(--color-text-muted)] font-mono">
                    {task.owner}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global todos fallback */}
      {displayTasks.length === 0 && todos && todos.length > 0 && (
        <div className="border-b border-[var(--color-border-muted)]">
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

      {/* Memory section */}
      {activeProjectDir && homeDir && (
        <MemorySection
          homeDir={homeDir}
          activeProjectDir={activeProjectDir}
          activeProjectId={activeProjectId}
        />
      )}

      {/* Extensions section (plugins, skills, agents) */}
      <ExtensionsSection />
    </div>
  );
}

function MemorySection({
  homeDir,
  activeProjectDir,
  activeProjectId,
}: {
  homeDir: string;
  activeProjectDir: string;
  activeProjectId: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const openTab = useSessionStore((s) => s.openTab);

  const projectId = pathToProjectId(activeProjectDir);

  const autoMemDir = `${homeDir}/.claude/projects/${projectId}/memory`;
  const userClaudeDir = `${homeDir}/.claude`;
  const userRulesDir = `${homeDir}/.claude/rules`;
  const projDotDir = `${activeProjectDir}/.claude`;
  const projRulesDir = `${activeProjectDir}/.claude/rules`;

  const { data: autoMemEntries } = useQuery({
    queryKey: ["list-dir", autoMemDir],
    queryFn: () => listDir(autoMemDir),
    retry: false,
    staleTime: 30_000,
    enabled: !!homeDir && !!activeProjectDir,
  });

  const { data: userEntries } = useQuery({
    queryKey: ["list-dir", userClaudeDir],
    queryFn: () => listDir(userClaudeDir),
    retry: false,
    staleTime: 30_000,
    enabled: !!homeDir,
  });

  const { data: userRulesEntries } = useQuery({
    queryKey: ["list-dir", userRulesDir],
    queryFn: () => listDir(userRulesDir),
    retry: false,
    staleTime: 30_000,
    enabled: !!homeDir,
  });

  const { data: projRootEntries } = useQuery({
    queryKey: ["list-dir", activeProjectDir],
    queryFn: () => listDir(activeProjectDir),
    retry: false,
    staleTime: 30_000,
    enabled: !!activeProjectDir,
  });

  const { data: projDotEntries } = useQuery({
    queryKey: ["list-dir", projDotDir],
    queryFn: () => listDir(projDotDir),
    retry: false,
    staleTime: 30_000,
    enabled: !!activeProjectDir,
  });

  const { data: projRulesEntries } = useQuery({
    queryKey: ["list-dir", projRulesDir],
    queryFn: () => listDir(projRulesDir),
    retry: false,
    staleTime: 30_000,
    enabled: !!activeProjectDir,
  });

  const hasFile = (entries: FileEntry[] | undefined, name: string) =>
    entries?.some((f) => !f.is_dir && f.name === name) ?? false;

  const getFilePath = (entries: FileEntry[] | undefined, name: string) =>
    entries?.find((f) => !f.is_dir && f.name === name)?.path;

  const openMemFile = (filePath: string, fileName: string, isProjectClaudeMd = false, isProjectReadme = false) => {
    openTab(
      isProjectClaudeMd
        ? {
            id: `claude:${activeProjectId}`,
            type: "readme",
            title: "CLAUDE.md",
            filePath,
            projectDir: activeProjectDir,
          }
        : isProjectReadme
        ? {
            id: `readme:${activeProjectId}`,
            type: "readme",
            title: "README.md",
            filePath,
            projectDir: activeProjectDir,
          }
        : {
            id: `file:${filePath}`,
            type: "file",
            title: fileName,
            filePath,
            projectDir: activeProjectDir,
          },
      activeProjectId
    );
  };

  const autoMemExists = hasFile(autoMemEntries, "MEMORY.md");
  const autoMemPath = getFilePath(autoMemEntries, "MEMORY.md") ?? `${autoMemDir}/MEMORY.md`;

  const userClaudeExists = hasFile(userEntries, "CLAUDE.md");
  const userClaudePath = getFilePath(userEntries, "CLAUDE.md") ?? `${userClaudeDir}/CLAUDE.md`;
  const userRulesMd = (userRulesEntries ?? []).filter((f) => !f.is_dir && f.name.endsWith(".md"));

  const projClaudeExists = hasFile(projRootEntries, "CLAUDE.md");
  const projClaudePath = getFilePath(projRootEntries, "CLAUDE.md") ?? `${activeProjectDir}/CLAUDE.md`;
  const projReadmeExists = hasFile(projRootEntries, "README.md");
  const projReadmePath = getFilePath(projRootEntries, "README.md") ?? `${activeProjectDir}/README.md`;
  const projDotClaudeExists = hasFile(projDotEntries, "CLAUDE.md");
  const projDotClaudePath = getFilePath(projDotEntries, "CLAUDE.md") ?? `${projDotDir}/CLAUDE.md`;
  const projLocalExists = hasFile(projRootEntries, "CLAUDE.local.md");
  const projLocalPath = getFilePath(projRootEntries, "CLAUDE.local.md") ?? `${activeProjectDir}/CLAUDE.local.md`;
  const projRulesMd = (projRulesEntries ?? []).filter((f) => !f.is_dir && f.name.endsWith(".md"));

  return (
    <div className="border-b border-[var(--color-border-muted)]">
      <button
        className="flex items-center gap-2 px-3 py-2 w-full hover:bg-[var(--color-bg-raised)] text-left"
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? (
          <ChevronRight size={10} className="text-[var(--color-text-muted)]" />
        ) : (
          <ChevronDown size={10} className="text-[var(--color-text-muted)]" />
        )}
        <Brain size={12} className="text-[var(--color-accent-primary)]" />
        <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
          Memory
        </span>
      </button>

      {!collapsed && (
        <div className="pb-2">
          <div className="px-4 pt-1 pb-0.5">
            <span className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider opacity-60">
              Auto
            </span>
          </div>
          <MemFileRow
            label="MEMORY.md"
            exists={autoMemExists}
            onClick={autoMemExists ? () => openMemFile(autoMemPath, "MEMORY.md") : undefined}
          />

          <div className="px-4 pt-2 pb-0.5">
            <span className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider opacity-60">
              User
            </span>
          </div>
          <MemFileRow
            label="CLAUDE.md"
            exists={userClaudeExists}
            onClick={userClaudeExists ? () => openMemFile(userClaudePath, "CLAUDE.md") : undefined}
          />
          {userRulesMd.map((f) => (
            <MemFileRow
              key={f.path}
              label={`rules/${f.name}`}
              exists={true}
              onClick={() => openMemFile(f.path, f.name)}
            />
          ))}

          <div className="px-4 pt-2 pb-0.5">
            <span className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider opacity-60">
              Project
            </span>
          </div>
          <MemFileRow
            label="CLAUDE.md"
            exists={projClaudeExists}
            onClick={projClaudeExists ? () => openMemFile(projClaudePath, "CLAUDE.md", true) : undefined}
          />
          <MemFileRow
            label="README.md"
            exists={projReadmeExists}
            onClick={projReadmeExists ? () => openMemFile(projReadmePath, "README.md", false, true) : undefined}
          />
          <MemFileRow
            label=".claude/CLAUDE.md"
            exists={projDotClaudeExists}
            onClick={projDotClaudeExists ? () => openMemFile(projDotClaudePath, "CLAUDE.md") : undefined}
          />
          <MemFileRow
            label="CLAUDE.local.md"
            exists={projLocalExists}
            onClick={projLocalExists ? () => openMemFile(projLocalPath, "CLAUDE.local.md") : undefined}
          />
          {projRulesMd.map((f) => (
            <MemFileRow
              key={f.path}
              label={`.claude/rules/${f.name}`}
              exists={true}
              onClick={() => openMemFile(f.path, f.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemFileRow({
  label,
  exists,
  onClick,
}: {
  label: string;
  exists: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-0.5",
        exists && onClick ? "cursor-pointer rounded-lg hover:bg-[var(--color-bg-raised)]" : ""
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "text-[10px] shrink-0",
          exists
            ? "text-[var(--color-accent-primary)]"
            : "text-[var(--color-text-muted)] opacity-40"
        )}
      >
        ●
      </span>
      <span
        className={cn(
          "text-xs truncate",
          exists
            ? "text-[var(--color-text-secondary)]"
            : "text-[var(--color-text-muted)] opacity-40"
        )}
      >
        {label}
      </span>
    </div>
  );
}


