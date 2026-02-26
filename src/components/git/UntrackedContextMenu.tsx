import { useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGitAction } from "@/hooks/useGitAction";
import { gitAdd, gitIgnore, gitExclude } from "@/lib/tauri";
import type { GitFileEntry } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface FileContextMenuProps {
  x: number;
  y: number;
  cwd: string;
  file: GitFileEntry | null;
  section?: string;
  onClose: () => void;
}

export function UntrackedContextMenu({
  x,
  y,
  cwd,
  file,
  section,
  onClose,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const runGitAction = useGitAction();
  const queryClient = useQueryClient();

  const isUntracked = section === "Untracked" || file?.section === "Untracked";
  const isHeader = file === null;

  const menuWidth = 200;
  const menuHeight = isHeader ? 60 : isUntracked ? 140 : 100;
  const left = Math.min(x, window.innerWidth - menuWidth - 8);
  const top = Math.min(y, window.innerHeight - menuHeight - 8);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleAddAll = async () => {
    onClose();
    await runGitAction("git add .", () => gitAdd(cwd, "."));
    queryClient.invalidateQueries({ queryKey: ["git-status", cwd] });
  };

  const handleAddFile = async () => {
    if (!file) return;
    onClose();
    await runGitAction(`git add ${file.path}`, () => gitAdd(cwd, file.path));
    queryClient.invalidateQueries({ queryKey: ["git-status", cwd] });
  };

  const handleIgnoreFile = async () => {
    if (!file) return;
    onClose();
    await runGitAction(`add ${file.path} to .gitignore`, () => gitIgnore(cwd, file.path));
    queryClient.invalidateQueries({ queryKey: ["git-status", cwd] });
  };

  const handleExcludeFile = async () => {
    if (!file) return;
    onClose();
    await runGitAction(`add ${file.path} to .git/info/exclude`, () => gitExclude(cwd, file.path));
    queryClient.invalidateQueries({ queryKey: ["git-status", cwd] });
  };

  return (
    <div
      ref={menuRef}
      style={{ left, top, zIndex: 9999 }}
      className="fixed min-w-[200px] py-1 panel-card-overlay"
    >
      {isHeader ? (
        <MenuItem onClick={handleAddAll}>Add all to git</MenuItem>
      ) : (
        <>
          {isUntracked && (
            <>
              <MenuItem onClick={handleAddFile}>Add to git</MenuItem>
              <div className="my-1 border-t border-[var(--color-border-muted)]" />
            </>
          )}
          <MenuItem onClick={handleIgnoreFile}>Add to .gitignore</MenuItem>
          <MenuItem onClick={handleExcludeFile}>Add to .git/info/exclude</MenuItem>
        </>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={cn(
        "w-full text-left px-3 py-1.5 text-xs transition-all duration-200 rounded-lg mx-1",
        disabled
          ? "text-[var(--color-text-muted)] cursor-default"
          : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
      )}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
