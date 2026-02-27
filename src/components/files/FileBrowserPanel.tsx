import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCw, Eye, EyeOff } from "lucide-react";
import { useProjectsStore } from "@/stores/projectsStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { listDir, getWorktreeCopy, setWorktreeCopy, getProjectSettings, setProjectSettings, type FileEntry } from "@/lib/tauri";
import { FileTreeNode } from "./FileTreeNode";

export function FileBrowserPanel() {
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const openTab = useSessionStore((s) => s.openTab);
  const queryClient = useQueryClient();
  const showHiddenFilesByDefault = useSettingsStore((s) => s.showHiddenFilesByDefault);

  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirContents, setDirContents] = useState<Record<string, FileEntry[]>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const loadRoot = useCallback(async () => {
    if (!activeProject?.path) return;
    setLoading(true);
    try {
      const entries = await listDir(activeProject.path, showHidden);
      setRootEntries(entries);
    } catch (e) {
      console.error("[files] load root failed:", e);
    } finally {
      setLoading(false);
    }
  }, [activeProject?.path, showHidden]);

  useEffect(() => {
    setExpandedDirs(new Set());
    setDirContents({});
    setFilter("");
    if (!activeProject?.path) return;
    getProjectSettings(activeProject.path).then((s) => {
      setShowHidden(s.showHiddenFiles ?? showHiddenFilesByDefault);
    }).catch(() => {
      setShowHidden(showHiddenFilesByDefault);
    });
  }, [activeProject?.path]);

  // Call loadRoot whenever it changes (i.e., when showHidden or activeProject.path changes)
  useEffect(() => {
    setDirContents({});
    loadRoot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRoot]);

  const handleToggle = async (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
        return next;
      }
      next.add(path);
      return next;
    });

    if (!dirContents[path]) {
      try {
        const entries = await listDir(path, showHidden);
        setDirContents((prev) => ({ ...prev, [path]: entries }));
      } catch (e) {
        console.error("[files] load dir failed:", e);
      }
    }
  };

  const handleFileClick = (entry: FileEntry) => {
    if (!activeProjectId || !activeProject) return;
    const tabId = `file:${entry.path}`;
    openTab(
      {
        id: tabId,
        type: "file",
        title: entry.name,
        filePath: entry.path,
        projectDir: activeProject.path,
      },
      activeProjectId
    );
  };

  const handleAddToCopyList = useCallback(async (absolutePath: string) => {
    if (!activeProject?.path) return;
    // Compute relative path by stripping the project root prefix
    const sep = absolutePath.includes("\\") ? "\\" : "/";
    const projectRoot = activeProject.path.replace(/\\/g, sep);
    const normalized = absolutePath.replace(/\\/g, sep);
    const relativePath = normalized.startsWith(projectRoot)
      ? normalized.slice(projectRoot.length).replace(/^[/\\]/, "")
      : absolutePath;

    try {
      const current = await getWorktreeCopy(activeProject.path);
      if (!current.includes(relativePath)) {
        await setWorktreeCopy(activeProject.path, [...current, relativePath]);
        queryClient.invalidateQueries({ queryKey: ["worktreeCopy", activeProject.path] });
      }
    } catch (e) {
      console.error("[files] add to copy list failed:", e);
    }
  }, [activeProject?.path, queryClient]);

  const filterLower = filter.toLowerCase();

  const renderEntries = (entries: FileEntry[], depth: number): React.ReactNode => {
    return entries
      .filter((e) => !filter || e.name.toLowerCase().includes(filterLower))
      .map((entry) => (
        <div key={entry.path}>
          <FileTreeNode
            entry={entry}
            depth={depth}
            expanded={expandedDirs.has(entry.path)}
            onFileClick={handleFileClick}
            onToggle={handleToggle}
            onAddToCopyList={!activeProject?.isWorktree ? handleAddToCopyList : undefined}
          />
          {entry.is_dir && expandedDirs.has(entry.path) && dirContents[entry.path] && (
            <div>
              {renderEntries(dirContents[entry.path], depth + 1)}
            </div>
          )}
        </div>
      ));
  };

  if (!activeProject) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        Open a project to browse files
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--color-border-muted)]">
        <Search size={11} className="text-[var(--color-text-muted)] shrink-0" />
        <input
          type="text"
          placeholder="Filter files..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 bg-transparent text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none"
        />
        <button
          onClick={async () => {
            const next = !showHidden;
            setShowHidden(next);
            if (activeProject?.path) {
              const current = await getProjectSettings(activeProject.path);
              await setProjectSettings(activeProject.path, { ...current, showHiddenFiles: next });
            }
          }}
          title={showHidden ? "Hide hidden files" : "Show hidden files"}
          className={`transition-all duration-200 rounded-md p-0.5 hover:bg-[var(--color-bg-raised)] ${showHidden ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"}`}
        >
          {showHidden ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
        <button
          onClick={loadRoot}
          title="Refresh"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all duration-200 rounded-md p-0.5 hover:bg-[var(--color-bg-raised)]"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">Loading...</div>
        ) : rootEntries.length === 0 ? (
          <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">No files found</div>
        ) : (
          renderEntries(rootEntries, 0)
        )}
      </div>
    </div>
  );
}
