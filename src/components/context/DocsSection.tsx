import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  Loader2,
  AlertTriangle,
  FileText,
  Folder,
} from "lucide-react";
import {
  listDir,
  readFile,
  writeFile,
  getProjectSettings,
  setProjectSettings,
  detectDocsFolder,
  runDocsIndexGen,
  type FileEntry,
} from "../../lib/tauri";
import { useSessionStore } from "../../stores/sessionStore";

interface DocsSectionProps {
  activeProjectDir: string;
  activeProjectId: string;
}

function humanizeName(raw: string): string {
  // Strip file extension
  const base = raw.replace(/\.[^.]+$/, "");
  return base
    // Insert space before uppercase letter following lowercase (camelCase)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // Insert space before uppercase run followed by lowercase (e.g. "HTMLParser")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    // Split on hyphens, underscores, dots, existing spaces
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function DocsSection({ activeProjectDir, activeProjectId }: DocsSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [generatingIndex, setGeneratingIndex] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [addingToClaude, setAddingToClaude] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirContents, setDirContents] = useState<Record<string, FileEntry[]>>({});

  const openTab = useSessionStore((s) => s.openTab);
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["project-settings", activeProjectDir],
    queryFn: () => getProjectSettings(activeProjectDir),
    staleTime: 30_000,
    enabled: !!activeProjectDir,
  });

  // Auto-detect docs folder when none is configured
  const { data: detectedFolder } = useQuery({
    queryKey: ["detect-docs-folder", activeProjectDir],
    queryFn: () => detectDocsFolder(activeProjectDir),
    staleTime: 60_000,
    enabled: !!activeProjectDir && !settings?.docsFolder,
  });

  const configuredFolder = settings?.docsFolder;
  const docsFolder = configuredFolder ?? detectedFolder ?? undefined;
  const isAutoDetected = !configuredFolder && !!detectedFolder;
  const docsFolderAbs = docsFolder ? `${activeProjectDir}/${docsFolder}` : null;

  const { data: docsEntries } = useQuery({
    queryKey: ["list-dir", docsFolderAbs],
    queryFn: () => listDir(docsFolderAbs!),
    enabled: !!docsFolderAbs,
    retry: false,
    staleTime: 30_000,
  });

  // Detect if index.md or README.md exists at docs root
  const hasIndex = docsEntries?.some(
    (f) => !f.is_dir && ["index.md", "readme.md", "INDEX.md", "README.md"].includes(f.name)
  );

  // Read project CLAUDE.md to check if docs reference exists
  const claudeMdPath = `${activeProjectDir}/CLAUDE.md`;
  const { data: claudeMdContent, refetch: refetchClaudeMd } = useQuery({
    queryKey: ["read-file", claudeMdPath],
    queryFn: () => readFile(claudeMdPath),
    enabled: !!docsFolder,
    retry: false,
    staleTime: 30_000,
  });

  const claudeMdHasDocs =
    !docsFolder ||
    (claudeMdContent != null && claudeMdContent.includes(docsFolder));

  // ---- Save auto-detected folder to settings ----
  const confirmDetected = async () => {
    if (!detectedFolder) return;
    await setProjectSettings(activeProjectDir, { ...settings, docsFolder: detectedFolder });
    queryClient.invalidateQueries({ queryKey: ["project-settings", activeProjectDir] });
  };

  // ---- Folder edit ----
  const startEdit = () => {
    setDraft(docsFolder ?? "");
    setEditing(true);
  };

  const saveFolder = async () => {
    const trimmed = draft.trim().replace(/\\/g, "/").replace(/^\/|\/$/g, "");
    await setProjectSettings(activeProjectDir, { ...settings, docsFolder: trimmed || undefined });
    queryClient.invalidateQueries({ queryKey: ["project-settings", activeProjectDir] });
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  // ---- File tree ----
  const handleToggle = useCallback(async (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) { next.delete(path); } else { next.add(path); }
      return next;
    });
    if (!dirContents[path]) {
      try {
        const entries = await listDir(path);
        setDirContents((prev) => ({ ...prev, [path]: entries }));
      } catch { /* dir may not exist */ }
    }
  }, [dirContents]);

  const handleFileClick = useCallback((entry: FileEntry) => {
    const isMarkdown = entry.name.toLowerCase().endsWith(".md");
    openTab(
      {
        id: `${isMarkdown ? "readme" : "file"}:${entry.path}`,
        type: isMarkdown ? "readme" : "file",
        title: humanizeName(entry.name),
        filePath: entry.path,
        projectDir: activeProjectDir,
      },
      activeProjectId
    );
  }, [openTab, activeProjectDir, activeProjectId]);

  const renderEntries = (entries: FileEntry[], depth: number): React.ReactNode =>
    entries.map((entry) => {
      const indent = depth * 12;
      if (entry.is_dir) {
        const isOpen = expandedDirs.has(entry.path);
        return (
          <div key={entry.path}>
            <button
              onClick={() => handleToggle(entry.path)}
              className="flex items-center gap-1.5 w-full text-left px-3 py-1 rounded-md mx-1 hover:bg-[var(--color-bg-raised)] transition-colors"
              style={{ paddingLeft: `${12 + indent}px` }}
            >
              {isOpen
                ? <ChevronDown size={10} className="text-[var(--color-text-muted)] shrink-0" />
                : <ChevronRight size={10} className="text-[var(--color-text-muted)] shrink-0" />}
              <Folder size={11} className="text-[var(--color-accent-primary)] shrink-0" />
              <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                {humanizeName(entry.name)}
              </span>
            </button>
            {isOpen && dirContents[entry.path] && (
              <div>{renderEntries(dirContents[entry.path], depth + 1)}</div>
            )}
          </div>
        );
      }
      return (
        <div
          key={entry.path}
          onClick={() => handleFileClick(entry)}
          className="flex items-center gap-2 px-3 py-1 mx-1 rounded-md cursor-pointer hover:bg-[var(--color-bg-raised)] group transition-colors"
          style={{ paddingLeft: `${12 + indent}px` }}
        >
          <FileText size={11} className="text-[var(--color-text-muted)] shrink-0 group-hover:text-[var(--color-accent-primary)]" />
          <span className="text-xs text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] truncate">
            {humanizeName(entry.name)}
          </span>
        </div>
      );
    });

  // ---- Generate index ----
  const generateIndex = async () => {
    if (!docsFolder) return;
    setGeneratingIndex(true);
    setGenError(null);
    try {
      await runDocsIndexGen(activeProjectDir, docsFolder);
      queryClient.invalidateQueries({ queryKey: ["list-dir", docsFolderAbs] });
    } catch (e) {
      setGenError(String(e));
    } finally {
      setGeneratingIndex(false);
    }
  };

  // ---- Add to CLAUDE.md ----
  const addToClaudeMd = async () => {
    if (!docsFolder) return;
    setAddingToClaude(true);
    try {
      const existing = claudeMdContent ?? "";
      const addition = `\n## Documentation\n\nProject documentation is in \`${docsFolder}/\`. Start with \`${docsFolder}/index.md\` for an overview and a map to all other docs. Read individual doc files as needed — do not load all docs upfront.\n`;
      await writeFile(claudeMdPath, existing + addition);
      refetchClaudeMd();
      queryClient.invalidateQueries({ queryKey: ["read-file", claudeMdPath] });
    } catch { /* ignore */ } finally {
      setAddingToClaude(false);
    }
  };

  if (settingsLoading) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border-muted)] shrink-0">
        <button
          className="flex items-center gap-2 flex-1 text-left hover:bg-[var(--color-bg-surface)] -mx-1 px-1 rounded-lg"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? (
            <ChevronRight size={10} className="text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown size={10} className="text-[var(--color-text-muted)]" />
          )}
          <BookOpen size={12} className="text-[var(--color-accent-primary)]" />
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Docs
          </span>
        </button>

        {/* Folder configurator */}
        {!collapsed && !editing && (
          <div className="flex items-center gap-1">
            <button
              onClick={startEdit}
              title={docsFolder ? `Docs folder: ${docsFolder}${isAutoDetected ? " (auto-detected)" : ""}` : "Set docs folder"}
              className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all duration-200 max-w-[120px]"
            >
              <span className="truncate">{docsFolder ?? "set folder"}</span>
              <Pencil size={9} className="shrink-0" />
            </button>
            {isAutoDetected && (
              <button
                onClick={confirmDetected}
                title="Save auto-detected folder to settings"
                className="text-[9px] text-[var(--color-accent-primary)] hover:underline shrink-0"
              >
                save
              </button>
            )}
          </div>
        )}

        {!collapsed && editing && (
          <div className="flex items-center gap-1 flex-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveFolder();
                if (e.key === "Escape") cancelEdit();
              }}
              placeholder="e.g. docs"
              className="flex-1 min-w-0 bg-[var(--color-bg-raised)] border border-[var(--color-border-muted)] rounded-lg px-1.5 py-0.5 text-[10px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
            />
            <button onClick={saveFolder} className="text-[var(--color-accent-primary)] hover:opacity-80">
              <Check size={11} />
            </button>
            <button onClick={cancelEdit} className="text-[var(--color-text-muted)] hover:opacity-80">
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto py-1">
          {!docsFolder ? (
            <div className="px-4 py-1 text-[10px] text-[var(--color-text-muted)] italic">
              No docs folder found
            </div>
          ) : (
            <>
              {/* File tree */}
              {docsEntries && docsEntries.length > 0 && (
                <div className="mb-1">
                  {renderEntries(docsEntries, 0)}
                </div>
              )}
              {docsEntries && docsEntries.length === 0 && (
                <div className="px-4 py-1 text-[10px] text-[var(--color-text-muted)] italic">
                  Folder is empty
                </div>
              )}
              {!docsEntries && (
                <div className="px-4 py-1 text-[10px] text-[var(--color-text-muted)] italic">
                  Folder not found: {docsFolder}
                </div>
              )}

              {/* Index prompt */}
              {docsEntries && !hasIndex && (
                <div className="mx-3 mt-1 mb-1 rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-bg-raised)] px-2 py-1.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={10} className="text-[var(--color-status-warning)] shrink-0" />
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      No <code className="font-mono">index.md</code> found
                    </span>
                  </div>
                  {generatingIndex ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
                      <Loader2 size={10} className="animate-spin" />
                      Generating index…
                    </div>
                  ) : (
                    <>
                      {genError && (
                        <p className="text-[10px] text-[var(--color-status-error)] mb-1 break-words">{genError}</p>
                      )}
                      <button
                        onClick={generateIndex}
                        className="text-[10px] text-[var(--color-accent-primary)] hover:underline"
                      >
                        Generate with Claude
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* CLAUDE.md prompt */}
              {docsEntries && !claudeMdHasDocs && (
                <div className="mx-3 mt-1 rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-bg-raised)] px-2 py-1.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={10} className="text-[var(--color-status-warning)] shrink-0" />
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      <code className="font-mono">CLAUDE.md</code> missing docs reference
                    </span>
                  </div>
                  {addingToClaude ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
                      <Loader2 size={10} className="animate-spin" />
                      Updating…
                    </div>
                  ) : (
                    <button
                      onClick={addToClaudeMd}
                      className="text-[10px] text-[var(--color-accent-primary)] hover:underline"
                    >
                      Add progressive disclosure
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
