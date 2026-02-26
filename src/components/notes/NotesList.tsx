import { memo } from "react";
import { StickyNote, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "@/lib/tauri";

type Scope = "all" | "project" | "global";

interface NotesListProps {
  notes: Note[];
  selectedId: string | null;
  scope: Scope;
  hasProject: boolean;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onSetScope: (scope: Scope) => void;
  onGoToFile: (filePath: string) => void;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function NotesListComponent({
  notes,
  selectedId,
  scope,
  hasProject,
  onSelectNote,
  onNewNote,
  onSetScope,
  onGoToFile,
}: NotesListProps) {
  const scopes: { id: Scope; label: string }[] = [
    { id: "all", label: "All" },
    ...(hasProject ? [{ id: "project" as Scope, label: "Project" }] : []),
    { id: "global", label: "Global" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Filter + New bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border-muted shrink-0">
        <div className="flex items-center gap-1 flex-1">
          {scopes.map((s) => (
            <button
              key={s.id}
              onClick={() => onSetScope(s.id)}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-200",
                scope === s.id
                  ? "bg-[var(--color-accent-primary)] text-white"
                  : "bg-bg-raised text-text-muted hover:text-text-secondary"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={onNewNote}
          title="New note"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-[var(--color-accent-primary)] text-white hover:opacity-90 transition-all duration-200"
        >
          <Plus size={10} />
          New
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted px-4 text-center">
            <StickyNote size={24} className="opacity-30" />
            <p className="text-xs">No notes yet</p>
            <button
              onClick={onNewNote}
              className="text-[10px] text-[var(--color-accent-primary)] hover:underline"
            >
              Create your first note
            </button>
          </div>
        ) : (
          notes.map((note) => {
            const isSelected = selectedId === note.id;
            const preview = stripMarkdown(note.content);
            const visibleRefs = note.fileRefs.slice(0, 3);
            const extraRefs = note.fileRefs.length - 3;
            return (
              <div
                key={note.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectNote(note.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectNote(note.id);
                }}
                className={cn(
                  "w-full text-left px-3 py-2.5 border-b border-border-muted transition-all duration-200 cursor-pointer",
                  isSelected ? "bg-bg-raised" : "hover:bg-bg-surface"
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <StickyNote
                    size={10}
                    className={isSelected ? "text-[var(--color-accent-primary)] shrink-0" : "text-text-muted shrink-0"}
                  />
                  <span className={cn(
                    "text-xs font-medium truncate flex-1",
                    isSelected ? "text-text-primary" : "text-text-secondary"
                  )}>
                    {note.title || "(untitled)"}
                  </span>
                  <span className="text-[10px] text-text-muted shrink-0">
                    {relativeTime(note.modified)}
                  </span>
                </div>
                {preview && (
                  <p className="text-[10px] text-text-muted line-clamp-1 ml-3.5">
                    {preview}
                  </p>
                )}
                {note.fileRefs.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 ml-3.5 flex-wrap">
                    {visibleRefs.map((ref) => {
                      const fileName = ref.filePath.replace(/\\/g, "/").split("/").pop() ?? ref.filePath;
                      return (
                        <button
                          key={ref.id}
                          onClick={(e) => { e.stopPropagation(); onGoToFile(ref.filePath); }}
                          title={ref.filePath}
                          className="text-[9px] px-1.5 py-0.5 rounded-full bg-bg-raised text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)] hover:text-white transition-all duration-200 font-mono truncate max-w-[80px]"
                        >
                          {fileName}
                        </button>
                      );
                    })}
                    {extraRefs > 0 && (
                      <span className="text-[9px] text-text-muted">+{extraRefs} more</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export const NotesList = memo(NotesListComponent);
