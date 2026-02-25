import { useState } from "react";
import { ChevronDown, ChevronRight, Puzzle, Zap, Bot, Shield } from "lucide-react";
import { useExtensions } from "@/hooks/useClaudeData";
import { useProjectsStore } from "@/stores/projectsStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { ClaudeExtension, ExtensionKind } from "@/lib/tauri";
import { cn } from "@/lib/utils";

const kindIcon: Record<ExtensionKind, React.ReactNode> = {
  mcp_server: <Puzzle size={10} className="text-[var(--color-accent-secondary)]" />,
  skill: <Zap size={10} className="text-[var(--color-status-warning)]" />,
  agent: <Bot size={10} className="text-[var(--color-accent-primary)]" />,
  allowed_tool: <Shield size={10} className="text-[var(--color-status-success)]" />,
};

const kindLabel: Record<ExtensionKind, string> = {
  mcp_server: "MCP Servers",
  skill: "Skills & Commands",
  agent: "Agents",
  allowed_tool: "Allowed Tools",
};

const levelBadge: Record<string, { label: string; color: string }> = {
  user: { label: "user", color: "text-[var(--color-text-muted)]" },
  project: { label: "proj", color: "text-[var(--color-accent-primary)]" },
};

export function ExtensionsSection() {
  const [collapsed, setCollapsed] = useState(false);
  const activeProjectDir = useProjectsStore(
    (s) => s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const activeProjectId = useProjectsStore((s) => s.activeProjectId ?? "");
  const openTab = useSessionStore((s) => s.openTab);

  const { data: extensions } = useExtensions(activeProjectDir);

  if (!extensions || extensions.length === 0) {
    return null;
  }

  // Group extensions by kind
  const groups = new Map<ExtensionKind, ClaudeExtension[]>();
  for (const ext of extensions) {
    const list = groups.get(ext.kind) ?? [];
    list.push(ext);
    groups.set(ext.kind, list);
  }

  const handleClick = (ext: ClaudeExtension) => {
    // If the extension has a file path and it's a markdown file, open as readme tab
    if (ext.filePath && (ext.filePath.endsWith(".md") || ext.filePath.endsWith(".mdx"))) {
      openTab(
        {
          id: `file:${ext.filePath}`,
          type: "readme",
          title: ext.name,
          filePath: ext.filePath,
          projectDir: activeProjectDir ?? "",
        },
        activeProjectId
      );
    } else {
      // Open as inline extension view with generated markdown
      openTab(
        {
          id: `extension:${ext.kind}:${ext.level}:${ext.name}`,
          type: "extension",
          title: ext.name,
          projectDir: activeProjectDir ?? "",
          markdownContent: ext.content,
        },
        activeProjectId
      );
    }
  };

  // Render order for kinds
  const kindOrder: ExtensionKind[] = ["mcp_server", "skill", "agent", "allowed_tool"];

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
        <Puzzle size={12} className="text-[var(--color-accent-secondary)]" />
        <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
          Extensions
        </span>
        <span className="text-[9px] text-[var(--color-text-muted)] ml-auto opacity-60">
          {extensions.length}
        </span>
      </button>

      {!collapsed && (
        <div className="pb-2">
          {kindOrder.map((kind) => {
            const items = groups.get(kind);
            if (!items || items.length === 0) return null;

            return (
              <div key={kind}>
                <div className="px-4 pt-2 pb-0.5">
                  <span className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider opacity-60">
                    {kindLabel[kind]}
                  </span>
                </div>
                {items.map((ext) => (
                  <ExtensionRow
                    key={`${ext.kind}:${ext.level}:${ext.name}`}
                    ext={ext}
                    onClick={() => handleClick(ext)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExtensionRow({
  ext,
  onClick,
}: {
  ext: ClaudeExtension;
  onClick: () => void;
}) {
  const badge = levelBadge[ext.level] ?? levelBadge.user;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-0.5 cursor-pointer rounded-lg hover:bg-[var(--color-bg-raised)]"
      )}
      onClick={onClick}
    >
      {kindIcon[ext.kind]}
      <span className="text-xs truncate flex-1 text-[var(--color-text-secondary)]">
        {ext.name}
      </span>
      <span
        className={cn(
          "text-[9px] shrink-0 font-mono px-1 py-0 rounded",
          badge.color,
          ext.level === "project"
            ? "bg-[var(--color-accent-primary)]/10"
            : "bg-[var(--color-bg-raised)]"
        )}
      >
        {badge.label}
      </span>
    </div>
  );
}
