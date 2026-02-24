import { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, ListPlus } from "lucide-react";
import type { FileEntry } from "@/lib/tauri";

interface FileTreeNodeProps {
  entry: FileEntry;
  depth: number;
  expanded: boolean;
  onFileClick: (entry: FileEntry) => void;
  onToggle: (path: string) => void;
  onAddToCopyList?: (relativePath: string) => void;
}

export function FileTreeNode({
  entry,
  depth,
  expanded,
  onFileClick,
  onToggle,
  onAddToCopyList,
}: FileTreeNodeProps) {
  const indent = depth * 12;
  const [addedFlash, setAddedFlash] = useState(false);

  const handleAddToCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAddToCopyList) return;
    onAddToCopyList(entry.path);
    setAddedFlash(true);
    setTimeout(() => setAddedFlash(false), 1500);
  };

  if (entry.is_dir) {
    return (
      <button
        onClick={() => onToggle(entry.path)}
        className="flex items-center gap-1.5 w-full px-2 py-0.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)] hover:text-[var(--color-text-primary)] transition-all duration-200 text-left group rounded-md mx-0.5"
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        <span className="shrink-0 text-[var(--color-text-muted)]">
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
        <span className="shrink-0 text-[var(--color-accent-secondary)]">
          {expanded ? <FolderOpen size={12} /> : <Folder size={12} />}
        </span>
        <span className="truncate flex-1">{entry.name}</span>
        {onAddToCopyList && (
          <span
            onClick={handleAddToCopy}
            className={`
              opacity-0 group-hover:opacity-100 shrink-0 transition-all cursor-pointer
              ${addedFlash ? "text-status-success opacity-100" : "text-[var(--color-text-muted)] hover:text-accent-primary"}
            `}
            title="Add to worktree copy list"
            role="button"
          >
            <ListPlus size={11} />
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => onFileClick(entry)}
      className="flex items-center gap-1.5 w-full px-2 py-0.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)] hover:text-[var(--color-text-primary)] transition-all duration-200 text-left group rounded-md mx-0.5"
      style={{ paddingLeft: `${8 + indent + 14}px` }}
    >
      <span className="shrink-0 text-[var(--color-text-muted)]">
        <File size={12} />
      </span>
      <span className="truncate flex-1">{entry.name}</span>
      {onAddToCopyList && (
        <span
          onClick={handleAddToCopy}
          className={`
            opacity-0 group-hover:opacity-100 shrink-0 transition-all cursor-pointer
            ${addedFlash ? "text-status-success opacity-100" : "text-[var(--color-text-muted)] hover:text-accent-primary"}
          `}
          title="Add to worktree copy list"
          role="button"
        >
          <ListPlus size={11} />
        </span>
      )}
    </button>
  );
}
