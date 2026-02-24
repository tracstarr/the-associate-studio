import { useState, useEffect, useCallback, useRef } from "react";
import Markdown from "react-markdown";
import { Pencil, Save, X, FilePlus, Sparkles, Loader2 } from "lucide-react";
import { readFile, writeFile, runClaudeInit, runReadmeGen } from "@/lib/tauri";
import { debugLog } from "@/stores/debugStore";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";

interface ReadmeTabProps {
  filePath: string;
  projectDir: string;
  isActive: boolean;
  tabId: string;
}

export function ReadmeTab({ filePath, projectDir, isActive, tabId }: ReadmeTabProps) {
  const resolvedPath = filePath ?? projectDir.replace(/\\/g, "/") + "/README.md";
  const [content, setContent] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dirty, setDirty] = useState(false);

  const setTabDirty = useSessionStore((s) => s.setTabDirty);

  useEffect(() => {
    setTabDirty(tabId, dirty);
    return () => { setTabDirty(tabId, false); };
  }, [dirty, tabId, setTabDirty]);

  const tabInitStatus = useUIStore((s) => s.tabInitStatus[tabId]);
  const tabInitError = useUIStore((s) => s.tabInitError[tabId]);
  const reloadKey = useUIStore((s) => s.tabReloadKey[tabId]);
  const setTabInitStatus = useUIStore((s) => s.setTabInitStatus);
  const setTabInitError = useUIStore((s) => s.setTabInitError);
  const bumpReloadKey = useUIStore((s) => s.bumpReloadKey);

  const isInitializing = tabInitStatus === 'initializing';
  const initError = tabInitError ?? null;

  const isClaudeMd = resolvedPath.endsWith("CLAUDE.md");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setNotFound(false);
    debugLog("ReadmeTab", "Loading file", { filePath: resolvedPath }, "info");
    readFile(resolvedPath)
      .then((text) => {
        debugLog("ReadmeTab", "File loaded", { bytes: text.length }, "success");
        setContent(text);
        setLoading(false);
      })
      .catch((error) => {
        debugLog("ReadmeTab", "File load error", { error: String(error) }, "error");
        setNotFound(true);
        setContent(null);
        setLoading(false);
      });
  }, [resolvedPath]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (!isActive) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <span className="text-xs text-[var(--color-text-muted)]">Loading...</span>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-secondary)]">
        <Loader2 size={24} className="animate-spin text-[var(--color-accent-primary)]" />
        <p className="text-sm">{isClaudeMd ? "Running claude /init..." : "Generating README.md with Claude..."}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{projectDir}</p>
      </div>
    );
  }

  if (notFound && !editing) {
    if (isClaudeMd) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <div className="text-center text-[var(--color-text-muted)]">
            <Sparkles size={20} className="mx-auto mb-2 text-[var(--color-accent-primary)]" />
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">CLAUDE.md not found</p>
            <p className="text-xs mt-1 mb-4">{resolvedPath}</p>
            {initError && (
              <div className="mb-4 px-4 py-2 rounded text-xs text-[var(--color-status-error)] bg-[var(--color-bg-raised)] border border-[var(--color-status-error)]/30 max-w-sm mx-auto">
                <p className="font-medium mb-1">{isClaudeMd ? "Error running claude /init" : "Error generating README.md"}</p>
                <p className="whitespace-pre-wrap">{initError}</p>
              </div>
            )}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={async () => {
                  setTabInitStatus(tabId, 'initializing');
                  setTabInitError(tabId, null);
                  debugLog("ReadmeTab", "Running claude init", { projectDir }, "info");
                  try {
                    const output = await runClaudeInit(projectDir);
                    debugLog("ReadmeTab", "Claude init complete", { output }, "success");
                    setTabInitStatus(tabId, null);
                    setTabInitError(tabId, null);
                    bumpReloadKey(tabId);
                  } catch (err) {
                    debugLog("ReadmeTab", "Claude init failed", { error: String(err) }, "error");
                    setTabInitError(tabId, String(err));
                    setTabInitStatus(tabId, 'error');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-[var(--color-accent-primary)] text-white hover:opacity-80 transition-opacity"
              >
                <Sparkles size={12} />
                {initError ? "Try again" : "Create with Claude CLI"}
              </button>
              <button
                onClick={() => {
                  setEditContent("");
                  setEditing(true);
                  setNotFound(false);
                  setDirty(false);
                  setTabInitError(tabId, null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors border border-[var(--color-border-muted)]"
              >
                <FilePlus size={12} />
                Create empty file
              </button>
            </div>
          </div>
        </div>
      );
    }

    const isReadmeMd = resolvedPath.endsWith("README.md");

    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-center text-[var(--color-text-muted)]">
          {isReadmeMd ? (
            <Sparkles size={20} className="mx-auto mb-2 text-[var(--color-accent-primary)]" />
          ) : null}
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {isReadmeMd ? "README.md not found" : "File not found"}
          </p>
          <p className="text-xs mt-1 mb-4">{resolvedPath}</p>
          {initError && isReadmeMd && (
            <div className="mb-4 px-4 py-2 rounded text-xs text-[var(--color-status-error)] bg-[var(--color-bg-raised)] border border-[var(--color-status-error)]/30 max-w-sm mx-auto">
              <p className="font-medium mb-1">Error generating README.md</p>
              <p className="whitespace-pre-wrap">{initError}</p>
            </div>
          )}
          <div className="flex items-center justify-center gap-2">
            {isReadmeMd && (
              <button
                onClick={async () => {
                  debugLog("ReadmeTab", "Generating README", { projectDir }, "info");
                  setTabInitStatus(tabId, 'initializing');
                  setTabInitError(tabId, null);
                  try {
                    const output = await runReadmeGen(projectDir);
                    debugLog("ReadmeTab", "README generation complete", { output }, "success");
                    setTabInitStatus(tabId, null);
                    setTabInitError(tabId, null);
                    bumpReloadKey(tabId);
                  } catch (err) {
                    debugLog("ReadmeTab", "README generation failed", { error: String(err) }, "error");
                    setTabInitStatus(tabId, 'error');
                    setTabInitError(tabId, String(err));
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-[var(--color-accent-primary)] text-white hover:opacity-80 transition-opacity"
              >
                <Sparkles size={12} />
                {initError ? "Try again" : "Generate with Claude"}
              </button>
            )}
            <button
              onClick={() => {
                setEditContent("");
                setEditing(true);
                setNotFound(false);
                setDirty(false);
                setTabInitError(tabId, null);
              }}
              className={isReadmeMd
                ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors border border-[var(--color-border-muted)]"
                : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-[var(--color-accent-primary)] text-white hover:opacity-80 transition-opacity"
              }
            >
              <FilePlus size={12} />
              Create empty file
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-col w-full h-full bg-[var(--color-bg-surface)]">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border-muted)] shrink-0">
          {dirty && (
            <span className="text-[10px] text-[var(--color-status-warning)]">Unsaved changes</span>
          )}
          <div className="flex-1" />
          <button
            onClick={async () => {
              debugLog("ReadmeTab", "Saving file", { filePath: resolvedPath, bytes: editContent.length }, "info");
              await writeFile(resolvedPath, editContent);
              setContent(editContent);
              setEditing(false);
              setDirty(false);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-[var(--color-status-success)] text-white hover:opacity-80 transition-opacity"
          >
            <Save size={11} />
            Save
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setDirty(false);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors border border-[var(--color-border-muted)]"
          >
            <X size={11} />
            Cancel
          </button>
        </div>
        {/* Editor */}
        <textarea
          value={editContent}
          onChange={(e) => {
            setEditContent(e.target.value);
            setDirty(true);
          }}
          className="flex-1 w-full p-4 resize-none bg-[var(--color-bg-base)] text-[var(--color-text-primary)] text-sm font-mono leading-relaxed outline-none border-none"
          spellCheck={false}
          autoFocus
        />
      </div>
    );
  }

  // View mode
  return (
    <div className="w-full h-full overflow-auto bg-[var(--color-bg-surface)] relative">
      <button
        onClick={() => {
          setEditContent(content ?? "");
          setEditing(true);
          setDirty(false);
        }}
        title="Edit"
        className="absolute top-4 right-4 z-10 p-1.5 rounded bg-[var(--color-bg-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-muted)] transition-colors"
      >
        <Pencil size={14} />
      </button>
      <div className="p-8 max-w-3xl mx-auto readme-content">
        <Markdown components={markdownComponents}>{content ?? ""}</Markdown>
      </div>
    </div>
  );
}

const markdownComponents = {
  h1: (props: React.ComponentProps<"h1">) => (
    <h1
      className="text-2xl font-bold text-[var(--color-text-primary)] mt-6 mb-4 pb-2 border-b border-[var(--color-border-muted)]"
      {...props}
    />
  ),
  h2: (props: React.ComponentProps<"h2">) => (
    <h2
      className="text-xl font-semibold text-[var(--color-text-primary)] mt-6 mb-3 pb-1.5 border-b border-[var(--color-border-muted)]"
      {...props}
    />
  ),
  h3: (props: React.ComponentProps<"h3">) => (
    <h3
      className="text-lg font-semibold text-[var(--color-text-primary)] mt-5 mb-2"
      {...props}
    />
  ),
  h4: (props: React.ComponentProps<"h4">) => (
    <h4
      className="text-base font-semibold text-[var(--color-text-primary)] mt-4 mb-2"
      {...props}
    />
  ),
  h5: (props: React.ComponentProps<"h5">) => (
    <h5
      className="text-sm font-semibold text-[var(--color-text-primary)] mt-3 mb-1"
      {...props}
    />
  ),
  h6: (props: React.ComponentProps<"h6">) => (
    <h6
      className="text-sm font-semibold text-[var(--color-text-muted)] mt-3 mb-1"
      {...props}
    />
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p className="text-sm text-[var(--color-text-primary)] leading-relaxed my-3" {...props} />
  ),
  a: (props: React.ComponentProps<"a">) => (
    <a
      className="text-[var(--color-accent-primary)] hover:underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  strong: (props: React.ComponentProps<"strong">) => (
    <strong className="font-semibold text-[var(--color-text-primary)]" {...props} />
  ),
  em: (props: React.ComponentProps<"em">) => (
    <em className="italic text-[var(--color-text-secondary)]" {...props} />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul className="list-disc list-inside my-3 space-y-1 text-sm text-[var(--color-text-primary)]" {...props} />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol className="list-decimal list-inside my-3 space-y-1 text-sm text-[var(--color-text-primary)]" {...props} />
  ),
  li: (props: React.ComponentProps<"li">) => (
    <li className="text-sm text-[var(--color-text-primary)] leading-relaxed" {...props} />
  ),
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="border-l-4 border-[var(--color-border-muted)] pl-4 my-3 text-sm text-[var(--color-text-secondary)] italic"
      {...props}
    />
  ),
  code: ({ className, children, ...props }: React.ComponentProps<"code"> & { inline?: boolean }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code
          className={`block text-xs font-mono text-[var(--color-text-primary)] ${className ?? ""}`}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="px-1.5 py-0.5 rounded text-xs font-mono bg-[var(--color-bg-raised)] text-[var(--color-accent-secondary)] border border-[var(--color-border-muted)]"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: (props: React.ComponentProps<"pre">) => (
    <pre
      className="my-3 p-4 rounded-md bg-[var(--color-bg-base)] border border-[var(--color-border-muted)] overflow-x-auto text-xs leading-relaxed"
      {...props}
    />
  ),
  hr: (props: React.ComponentProps<"hr">) => (
    <hr className="my-6 border-[var(--color-border-muted)]" {...props} />
  ),
  table: (props: React.ComponentProps<"table">) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-sm border-collapse border border-[var(--color-border-muted)]" {...props} />
    </div>
  ),
  thead: (props: React.ComponentProps<"thead">) => (
    <thead className="bg-[var(--color-bg-raised)]" {...props} />
  ),
  th: (props: React.ComponentProps<"th">) => (
    <th
      className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-primary)] border border-[var(--color-border-muted)]"
      {...props}
    />
  ),
  td: (props: React.ComponentProps<"td">) => (
    <td
      className="px-3 py-2 text-xs text-[var(--color-text-primary)] border border-[var(--color-border-muted)]"
      {...props}
    />
  ),
  img: (props: React.ComponentProps<"img">) => (
    <img className="max-w-full h-auto rounded my-3" {...props} />
  ),
};
