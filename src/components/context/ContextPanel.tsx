import { useState } from "react";
import { Wrench, CheckSquare, Brain, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranscript, useTodos, useTeams, useTasks } from "../../hooks/useClaudeData";
import { useActiveProjectTabs } from "../../hooks/useActiveProjectTabs";
import { useProjectsStore } from "../../stores/projectsStore";
import { useSessionStore } from "../../stores/sessionStore";
import type { TranscriptItem, FileEntry } from "../../lib/tauri";
import { getHomeDir, listDir } from "../../lib/tauri";
import { cn, pathToProjectId } from "@/lib/utils";

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
    effectiveSessionId && activeProjectDir && homeDir
      ? `${homeDir}/.claude/projects/${pathToProjectId(activeProjectDir)}/${effectiveSessionId}.jsonl`
      : null;

  const { data: transcriptResult } = useTranscript(sessionPath ?? "", 0);
  const items = transcriptResult?.[0] ?? [];

  const { data: teams } = useTeams(activeProjectDir ?? undefined);
  const activeTeam = effectiveSessionId
    ? teams?.find((t) => t.config?.leadSessionId === effectiveSessionId)
    : undefined;
  const { data: teamTasks } = useTasks(activeTeam?.dirName ?? "");
  const { data: todos } = useTodos();

  const statusOrder: Record<string, number> = { in_progress: 0, pending: 1, completed: 2 };
  const sortedTasks = [...(teamTasks ?? [])].sort(
    (a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
  );
  const displayTasks = sortedTasks.slice(0, 8);

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
      {/* Team tasks section */}
      {activeTeam && teamTasks && (
        <div className="border-b border-[var(--color-border-default)]">
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
            {displayTasks.length === 0 && (
              <div className="px-4 py-0.5 text-xs text-[var(--color-text-muted)]">
                No tasks
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global todos fallback */}
      {!activeTeam && todos && todos.length > 0 && (
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

      {/* Memory section */}
      {activeProjectDir && homeDir && (
        <MemorySection
          homeDir={homeDir}
          activeProjectDir={activeProjectDir}
          activeProjectId={activeProjectId}
        />
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
    <div className="border-b border-[var(--color-border-default)]">
      <button
        className="flex items-center gap-2 px-3 py-2 w-full hover:bg-[var(--color-bg-surface)] text-left"
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
        exists && onClick ? "cursor-pointer hover:bg-[var(--color-bg-surface)]" : ""
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

