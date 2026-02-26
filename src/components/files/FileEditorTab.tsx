import { useState, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { Save, Loader2, StickyNote, X } from "lucide-react";
import { readFile, writeFile } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { useGlobalNotes, useProjectNotes } from "@/hooks/useClaudeData";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.default }))
);

function getLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "py":
      return "python";
    case "rs":
      return "rust";
    case "go":
      return "go";
    case "java":
      return "java";
    case "c":
    case "h":
      return "c";
    case "cpp":
    case "hpp":
    case "cc":
      return "cpp";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "html":
    case "htm":
      return "html";
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "toml":
      return "ini";
    case "md":
    case "mdx":
      return "markdown";
    case "sh":
    case "bash":
      return "shell";
    case "sql":
      return "sql";
    case "xml":
      return "xml";
    default:
      return "plaintext";
  }
}

interface FileEditorTabProps {
  filePath: string;
  isActive: boolean;
  tabId: string;
}

export function FileEditorTab({ filePath, tabId, isActive }: FileEditorTabProps) {
  const setTabDirty = useSessionStore((s) => s.setTabDirty);
  const openNotesWithRef = useUIStore((s) => s.openNotesWithRef);
  const openNoteById = useUIStore((s) => s.openNoteById);
  const pendingAttachToNoteId = useUIStore((s) => s.pendingAttachToNoteId);
  const setPendingAttachToNoteId = useUIStore((s) => s.setPendingAttachToNoteId);
  const activeNoteId = useUIStore((s) => s.activeNoteId);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const activeRightTab = useUIStore((s) => s.activeRightTab);
  const activeProject = useProjectsStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const { data: globalNotes = [] } = useGlobalNotes();
  const { data: projectNotes = [] } = useProjectNotes(activeProject?.path ?? null);

  const autoAttachNoteId = (!pendingAttachToNoteId && rightPanelOpen && activeRightTab === "notes")
    ? activeNoteId
    : null;

  const attachTitle = useMemo(
    () => [...globalNotes, ...projectNotes]
      .find((n) => n.id === (pendingAttachToNoteId ?? autoAttachNoteId))?.title ?? "",
    [globalNotes, projectNotes, pendingAttachToNoteId, autoAttachNoteId]
  );

  const normalizedPath = useMemo(() => filePath.replace(/\\/g, "/").toLowerCase(), [filePath]);
  const fileNotes = useMemo(() =>
    [...globalNotes, ...projectNotes]
      .filter((n) => n.fileRefs.some((r) => r.filePath.replace(/\\/g, "/").toLowerCase() === normalizedPath))
      .sort((a, b) => b.modified - a.modified),
    [globalNotes, projectNotes, normalizedPath]
  );
  const hasNotes = fileNotes.length > 0;

  const handleNotesClick = () => {
    if (hasNotes) {
      openNoteById(fileNotes[0].id);
    } else {
      openNotesWithRef({ filePath, lineStart: 0, lineEnd: 0, quote: "" });
    }
  };
  const [content, setContent] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionInfo, setSelectionInfo] = useState<{ lineStart: number; lineEnd: number; quote: string; top: number } | null>(null);
  const [editorMounted, setEditorMounted] = useState(false);
  const editorRef = useRef<unknown>(null);
  const contentRef = useRef<string | null>(null);
  const decorationsRef = useRef<any>(null);
  const fileNotesRef = useRef(fileNotes);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    setDirty(false);
    readFile(filePath)
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        setEditContent(text);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { fileNotesRef.current = fileNotes; }, [fileNotes]);

  useEffect(() => {
    if (!editorMounted) return;
    const editor = editorRef.current as any;
    if (!editor) return;

    const decorations = fileNotes.flatMap((note) =>
      note.fileRefs
        .filter(
          (r) =>
            r.filePath.replace(/\\/g, "/").toLowerCase() === normalizedPath &&
            r.lineStart > 0
        )
        .map((r) => ({
          range: {
            startLineNumber: r.lineStart,
            startColumn: 1,
            endLineNumber: r.lineEnd,
            endColumn: 1,
          },
          options: {
            linesDecorationsClassName: "note-gutter-indicator",
            stickiness: 1, // NeverGrowsWhenTypingAtEdges
          },
        }))
    );

    if (decorationsRef.current) {
      decorationsRef.current.set(decorations);
    } else {
      decorationsRef.current = editor.createDecorationsCollection(decorations);
    }
  }, [fileNotes, editorMounted, normalizedPath]);

  useEffect(() => {
    if (!isActive || dirty) return;
    const id = setInterval(async () => {
      try {
        const fresh = await readFile(filePath);
        if (fresh !== contentRef.current) {
          setContent(fresh);
          setEditContent(fresh);
        }
      } catch (_) {}
    }, 2000);
    return () => clearInterval(id);
  }, [isActive, dirty, filePath]);

  useEffect(() => {
    setTabDirty(tabId, dirty);
    return () => { setTabDirty(tabId, false); };
  }, [dirty, tabId, setTabDirty]);

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await writeFile(filePath, editContent);
      setContent(editContent);
      setDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (e) {
      console.error("[FileEditorTab] save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleEditorMount = (editor: unknown) => {
    editorRef.current = editor;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = editor as any;
    e.addCommand(
      // Ctrl+S: Monaco KeyMod.CtrlCmd | KeyCode.KeyS = 2048 | 49 = 2097
      2097,
      () => { void handleSave(); }
    );
    e.onDidChangeCursorSelection(() => {
      const sel = e.getSelection();
      if (
        !sel ||
        (sel.startLineNumber === sel.endLineNumber && sel.startColumn === sel.endColumn)
      ) {
        setSelectionInfo(null);
        return;
      }
      const text: string = e.getModel()?.getValueInRange(sel) ?? "";
      if (!text.trim()) {
        setSelectionInfo(null);
        return;
      }
      // Position button ~1 line above selection start
      const lineHeight = 13 * 1.6; // fontSize * lineHeight from options
      const scrollTop = e.getScrollTop();
      const top = (sel.startLineNumber - 1) * lineHeight - scrollTop - 28;
      setSelectionInfo({
        lineStart: sel.startLineNumber,
        lineEnd: sel.endLineNumber,
        quote: text.slice(0, 200),
        top: Math.max(4, top),
      });
    });
    // Gutter click → jump to note
    e.onMouseDown((event: any) => {
      // MouseTargetType.GUTTER_LINE_DECORATIONS === 3
      if (event.target.type !== 3) return;
      const lineNumber = event.target.position?.lineNumber;
      if (!lineNumber) return;
      for (const note of fileNotesRef.current) {
        const hit = note.fileRefs.find(
          (r) =>
            r.filePath.replace(/\\/g, "/").toLowerCase() === normalizedPath &&
            r.lineStart > 0 &&
            r.lineStart <= lineNumber &&
            r.lineEnd >= lineNumber
        );
        if (hit) {
          openNoteById(note.id);
          return;
        }
      }
    });
    setEditorMounted(true);
  };

  const language = getLanguage(filePath);
  const isWordWrap = language === "markdown" || language === "plaintext";

  // Truncate path for display — show last 3 segments
  const segments = filePath.replace(/\\/g, "/").split("/");
  const displayPath = segments.length > 3
    ? "…/" + segments.slice(-3).join("/")
    : segments.join("/");

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-[var(--color-border-muted)] bg-[var(--color-bg-surface)] shrink-0">
        <span
          className="font-mono text-xs text-[var(--color-text-secondary)] truncate flex-1"
          title={filePath}
        >
          {displayPath}
        </span>
        {dirty && (
          <span className="text-[var(--color-status-warning)] text-xs font-bold" title="Unsaved changes">
            ●
          </span>
        )}
        {pendingAttachToNoteId && (
          <span className="text-[10px] text-[var(--color-accent-primary)] bg-bg-raised px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
            Attaching to: {attachTitle || "note"}
            <button
              onClick={() => setPendingAttachToNoteId(null)}
              className="hover:text-text-primary transition-colors duration-200"
              title="Cancel attach mode"
            >
              <X size={8} />
            </button>
          </span>
        )}
        <button
          onClick={handleNotesClick}
          title={hasNotes ? `${fileNotes.length} note${fileNotes.length === 1 ? "" : "s"} for this file` : "Create note for this file"}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all duration-200",
            hasNotes
              ? "text-[var(--color-accent-primary)] hover:bg-bg-raised"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-bg-raised"
          )}
        >
          <StickyNote size={10} />
          Notes{hasNotes ? ` (${fileNotes.length})` : ""}
        </button>
        <button
          onClick={() => { void handleSave(); }}
          disabled={!dirty || saving}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all duration-200",
            dirty && !saving
              ? "bg-[var(--color-accent-primary)] text-white hover:opacity-90"
              : "text-[var(--color-text-muted)] cursor-default"
          )}
        >
          {saving ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <Save size={10} />
          )}
          {savedFlash ? "Saved" : "Save"}
        </button>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden relative">
        {error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-[var(--color-status-error)] max-w-md px-4">
              <p className="text-sm font-medium mb-1">Failed to open file</p>
              <p className="text-xs text-[var(--color-text-muted)] font-mono break-all">{error}</p>
            </div>
          </div>
        ) : content === null ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={16} className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 size={16} className="animate-spin text-[var(--color-text-muted)]" />
              </div>
            }
          >
            <MonacoEditor
              height="100%"
              language={language}
              theme="vs-dark"
              value={editContent}
              onChange={(v) => {
                const val = v ?? "";
                setEditContent(val);
                setDirty(val !== content);
              }}
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                lineHeight: 1.6,
                wordWrap: isWordWrap ? "on" : "off",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                fontFamily: "'Cascadia Code', 'JetBrains Mono', monospace",
                renderLineHighlight: "none",
                overviewRulerLanes: 0,
                folding: true,
              }}
            />
          </Suspense>
        )}
        {selectionInfo && (
          <div
            className="absolute left-4 z-50 pointer-events-auto"
            style={{ top: selectionInfo.top }}
          >
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                const targetId = pendingAttachToNoteId ?? autoAttachNoteId;
                if (targetId) setPendingAttachToNoteId(targetId);
                openNotesWithRef({
                  filePath,
                  lineStart: selectionInfo.lineStart,
                  lineEnd: selectionInfo.lineEnd,
                  quote: selectionInfo.quote,
                });
                setSelectionInfo(null);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-[var(--color-accent-primary)] text-white shadow-lg hover:opacity-90 transition-all duration-200"
            >
              {pendingAttachToNoteId
                ? "+ Attach to note"
                : autoAttachNoteId
                  ? "+ Add to open note"
                  : "+ Add to note"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
