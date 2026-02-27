import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Save, Trash2, ExternalLink, ChevronDown, ChevronRight, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note, FileRef, IssueRef } from "@/lib/tauri";
import { useSessionStore } from "@/stores/sessionStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { useUIStore } from "@/stores/uiStore";
import { CreateIssueModal } from "./CreateIssueModal";

interface NoteEditorProps {
  note: Note;
  onBack: () => void;
  onSave: (note: Note) => void;
  onDelete: (note: Note) => void;
}

function FileRefItem({ ref: fileRef }: { ref: FileRef }) {
  const openTab = useSessionStore((s) => s.openTab);
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);

  const fileName = fileRef.filePath.replace(/\\/g, "/").split("/").pop() ?? fileRef.filePath;

  const handleGoToFile = () => {
    if (!activeProjectId) return;
    const tabId = `file:${fileRef.filePath}`;
    openTab(
      {
        id: tabId,
        type: "file",
        title: fileName,
        filePath: fileRef.filePath,
        projectDir: activeProject?.path ?? "",
      },
      activeProjectId
    );
  };

  return (
    <div
      className="flex items-start gap-2 px-3 py-2 rounded-lg bg-bg-surface border border-border-muted cursor-pointer hover:border-[var(--color-accent-primary)] transition-colors duration-200"
      onClick={handleGoToFile}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[var(--color-accent-secondary)] truncate">
            {fileRef.lineStart === 0
              ? `${fileName} (whole file)`
              : `${fileName}:${fileRef.lineStart}${fileRef.lineEnd !== fileRef.lineStart ? `–${fileRef.lineEnd}` : ""}`}
          </span>
        </div>
        {fileRef.quote && (
          <pre className="text-[10px] text-text-muted mt-1 whitespace-pre-wrap font-mono line-clamp-3 bg-bg-raised px-2 py-1 rounded border border-border-muted">
            {fileRef.quote}
          </pre>
        )}
      </div>
      <ExternalLink size={10} className="text-text-muted shrink-0 mt-0.5" />
    </div>
  );
}

function IssueRefItem({ issueRef }: { issueRef: IssueRef }) {
  const openTab = useSessionStore((s) => s.openTab);
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);

  const handleOpen = () => {
    if (!activeProjectId) return;
    openTab(
      {
        id: `issue:${issueRef.provider}:${issueRef.key}`,
        type: "issue-detail",
        title: issueRef.key,
        projectDir: activeProject?.path ?? "",
        issueKey: issueRef.key,
        issueSource: issueRef.provider as "github" | "linear" | "jira",
        issueUrl: issueRef.url,
      },
      activeProjectId
    );
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface border border-border-muted cursor-pointer hover:border-[var(--color-accent-primary)] transition-colors duration-200"
      onClick={handleOpen}
    >
      <Link size={10} className="text-[var(--color-accent-secondary)] shrink-0" />
      <span className="text-[10px] font-mono text-[var(--color-accent-secondary)] shrink-0">
        {issueRef.key}
      </span>
      <span className="text-[10px] text-text-muted truncate flex-1">{issueRef.title}</span>
      <ExternalLink
        size={10}
        className="text-text-muted shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          window.open(issueRef.url, "_blank", "noopener,noreferrer");
        }}
      />
    </div>
  );
}

export function NoteEditor({ note, onBack, onSave, onDelete }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [refsOpen, setRefsOpen] = useState(true);
  const [issuesOpen, setIssuesOpen] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const setPendingAttachToNoteId = useUIStore((s) => s.setPendingAttachToNoteId);
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const openTab = useSessionStore((s) => s.openTab);

  // Reset when note changes and focus textarea
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = title !== note.title || content !== note.content;

  const handleSave = () => {
    if (!isDirty) return;
    onSave({
      ...note,
      title,
      content,
      modified: Date.now(),
    });
  };

  const handleIssueCreated = (ref: IssueRef) => {
    // Save note with new issueRef (bypasses isDirty guard — issueRefs changed, not title/content)
    const updated = {
      ...note,
      issueRefs: [...(note.issueRefs ?? []), ref],
      modified: Date.now(),
    };
    onSave(updated);

    // Open issue in center tab
    if (activeProjectId) {
      openTab(
        {
          id: `issue:${ref.provider}:${ref.key}`,
          type: "issue-detail",
          title: ref.key,
          projectDir: activeProject?.path ?? "",
          issueKey: ref.key,
          issueSource: ref.provider as "github" | "linear" | "jira",
          issueUrl: ref.url,
        },
        activeProjectId
      );
    }

    setShowCreateModal(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border-muted shrink-0">
        <button
          onClick={onBack}
          title="Back to list"
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-surface transition-all duration-200"
        >
          <ArrowLeft size={12} />
        </button>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={!isDirty}
          title="Save"
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all duration-200",
            isDirty
              ? "bg-[var(--color-accent-primary)] text-white hover:opacity-90"
              : "text-text-muted cursor-default"
          )}
        >
          <Save size={10} />
          Save
        </button>
        <button
          onClick={() => onDelete(note)}
          title="Delete note"
          className="p-1 rounded text-text-muted hover:text-[var(--color-status-error)] hover:bg-bg-surface transition-all duration-200"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title…"
        className="w-full bg-transparent border-b border-border-muted px-3 py-2 text-sm font-semibold text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[var(--color-accent-primary)] transition-colors duration-200 shrink-0"
      />

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your note in markdown…"
          className="flex-1 w-full bg-transparent px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none resize-none"
          spellCheck={false}
        />
      </div>

      {/* File refs section — always visible */}
      <div className="border-t border-border-muted shrink-0">
        <div className="flex items-center w-full px-3 py-1.5">
          <button
            onClick={() => setRefsOpen(!refsOpen)}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors duration-200 flex-1"
          >
            {refsOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            File references ({note.fileRefs.length})
          </button>
          <button
            onClick={() => setPendingAttachToNoteId(note.id)}
            className="text-[10px] text-[var(--color-accent-primary)] hover:underline transition-all duration-200"
          >
            + Attach
          </button>
        </div>
        {refsOpen && note.fileRefs.length > 0 && (
          <div className="px-3 pb-2 flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {note.fileRefs.map((fileRef) => (
              <FileRefItem key={fileRef.id} ref={fileRef} />
            ))}
          </div>
        )}
      </div>

      {/* Linked issues section */}
      <div className="border-t border-border-muted shrink-0">
        <div className="flex items-center w-full px-3 py-1.5">
          <button
            onClick={() => setIssuesOpen(!issuesOpen)}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors duration-200 flex-1"
          >
            {issuesOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Linked issues ({(note.issueRefs ?? []).length})
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-[10px] text-[var(--color-accent-primary)] hover:underline transition-all duration-200"
          >
            + Create issue
          </button>
        </div>
        {issuesOpen && (note.issueRefs ?? []).length > 0 && (
          <div className="px-3 pb-2 flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {(note.issueRefs ?? []).map((issueRef) => (
              <IssueRefItem key={issueRef.id} issueRef={issueRef} />
            ))}
          </div>
        )}
      </div>

      {/* Create issue modal */}
      {showCreateModal && (
        <CreateIssueModal
          initialTitle={note.title}
          initialBody={note.content}
          activeProjectDir={activeProject?.path ?? null}
          onCreated={handleIssueCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
