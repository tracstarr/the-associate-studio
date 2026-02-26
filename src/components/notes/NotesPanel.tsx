import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NotesList } from "./NotesList";
import { NoteEditor } from "./NoteEditor";
import { useGlobalNotes, useProjectNotes } from "@/hooks/useClaudeData";
import { useUIStore } from "@/stores/uiStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { useSessionStore } from "@/stores/sessionStore";
import { pathToProjectId } from "@/lib/utils";
import * as tauri from "@/lib/tauri";
import type { Note } from "@/lib/tauri";

type Scope = "all" | "project" | "global";
type View = "list" | "editor";

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function NotesPanel() {
  const queryClient = useQueryClient();
  const activeProject = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  );
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const openTab = useSessionStore((s) => s.openTab);
  const pendingNoteRef = useUIStore((s) => s.pendingNoteRef);
  const setPendingNoteRef = useUIStore((s) => s.setPendingNoteRef);
  const pendingNoteId = useUIStore((s) => s.pendingNoteId);
  const setPendingNoteId = useUIStore((s) => s.setPendingNoteId);
  const pendingAttachToNoteId = useUIStore((s) => s.pendingAttachToNoteId);
  const setPendingAttachToNoteId = useUIStore((s) => s.setPendingAttachToNoteId);
  const setActiveNoteId = useUIStore((s) => s.setActiveNoteId);

  const [view, setView] = useState<View>("list");
  const [scope, setScope] = useState<Scope>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: globalNotes = [] } = useGlobalNotes();
  const { data: projectNotes = [] } = useProjectNotes(activeProject?.path ?? null);

  const allNotes = useMemo(() => {
    const map = new Map<string, Note>();
    for (const n of [...globalNotes, ...projectNotes]) {
      map.set(n.id, n);
    }
    return Array.from(map.values());
  }, [globalNotes, projectNotes]);

  const visibleNotes = useMemo(() => {
    let notes: Note[];
    if (scope === "global") {
      notes = globalNotes;
    } else if (scope === "project") {
      notes = projectNotes;
    } else {
      notes = allNotes;
    }
    return [...notes].sort((a, b) => b.modified - a.modified);
  }, [allNotes, globalNotes, projectNotes, scope]);

  const selectedNote = useMemo(
    () => visibleNotes.find((n) => n.id === selectedId) ?? null,
    [visibleNotes, selectedId]
  );

  const saveMutation = useMutation({
    mutationFn: (note: Note) => tauri.saveNote(note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (note: Note) => {
      const encodedProjectId = note.projectPath
        ? pathToProjectId(note.projectPath)
        : null;
      return tauri.deleteNote(note.id, encodedProjectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setSelectedId(null);
      setView("list");
    },
  });

  // Sync view+selectedId → activeNoteId in uiStore so FileEditorTab can auto-attach
  useEffect(() => {
    setActiveNoteId(view === "editor" ? selectedId : null);
    return () => setActiveNoteId(null);
  }, [view, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle pendingNoteRef: attach to existing note if pendingAttachToNoteId is set,
  // otherwise create a new note pre-filled with the file ref
  useEffect(() => {
    if (!pendingNoteRef) return;
    if (pendingAttachToNoteId) {
      const target = allNotes.find((n) => n.id === pendingAttachToNoteId);
      if (target) {
        const newRef = {
          id: generateId(),
          filePath: pendingNoteRef.filePath,
          lineStart: pendingNoteRef.lineStart,
          lineEnd: pendingNoteRef.lineEnd,
          quote: pendingNoteRef.quote,
        };
        const updated = {
          ...target,
          fileRefs: [...target.fileRefs, newRef],
          modified: Date.now(),
        };
        saveMutation.mutate(updated, {
          onSuccess: () => {
            setSelectedId(target.id);
            setView("editor");
            setPendingNoteRef(null);
            setPendingAttachToNoteId(null);
          },
        });
        return;
      }
    }
    const now = Date.now();
    const newNote: Note = {
      id: generateId(),
      title: "",
      content: "",
      projectPath: activeProject?.path ?? null,
      fileRefs: [
        {
          id: generateId(),
          filePath: pendingNoteRef.filePath,
          lineStart: pendingNoteRef.lineStart,
          lineEnd: pendingNoteRef.lineEnd,
          quote: pendingNoteRef.quote,
        },
      ],
      created: now,
      modified: now,
    };
    saveMutation.mutate(newNote, {
      onSuccess: () => {
        setSelectedId(newNote.id);
        setView("editor");
        setPendingNoteRef(null);
      },
    });
  }, [pendingNoteRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle pendingNoteId: jump directly to an existing note in editor view
  useEffect(() => {
    if (!pendingNoteId) return;
    setSelectedId(pendingNoteId);
    setView("editor");
    setPendingNoteId(null);
  }, [pendingNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewNote = () => {
    const now = Date.now();
    const newNote: Note = {
      id: generateId(),
      title: "",
      content: "",
      projectPath: scope === "global" ? null : (activeProject?.path ?? null),
      fileRefs: [],
      created: now,
      modified: now,
    };
    saveMutation.mutate(newNote, {
      onSuccess: () => {
        setSelectedId(newNote.id);
        setView("editor");
      },
    });
  };

  const handleSelectNote = (id: string) => {
    setSelectedId(id);
    setView("editor");
  };

  const handleSave = (note: Note) => {
    saveMutation.mutate(note);
  };

  const handleDelete = (note: Note) => {
    deleteMutation.mutate(note);
  };

  const handleGoToFile = (filePath: string) => {
    if (!activeProjectId) return;
    const fileName = filePath.replace(/\\/g, "/").split("/").pop() ?? filePath;
    const tabId = `file:${filePath}`;
    openTab(
      {
        id: tabId,
        type: "file",
        title: fileName,
        filePath,
        projectDir: activeProject?.path ?? "",
      },
      activeProjectId
    );
  };

  if (view === "editor" && selectedNote) {
    return (
      <NoteEditor
        note={selectedNote}
        onBack={() => setView("list")}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <NotesList
      notes={visibleNotes}
      selectedId={selectedId}
      scope={scope}
      hasProject={!!activeProject}
      onSelectNote={handleSelectNote}
      onNewNote={handleNewNote}
      onSetScope={setScope}
      onGoToFile={handleGoToFile}
    />
  );
}
