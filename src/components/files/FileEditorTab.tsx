import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Save, Loader2 } from "lucide-react";
import { readFile, writeFile } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";

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
  const [content, setContent] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<unknown>(null);
  const contentRef = useRef<string | null>(null);

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
    (editor as any).addCommand(
      // Ctrl+S: Monaco KeyMod.CtrlCmd | KeyCode.KeyS = 2048 | 49 = 2097
      2097,
      () => { void handleSave(); }
    );
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
      <div className="flex-1 overflow-hidden">
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
      </div>
    </div>
  );
}
