import { useRef, useEffect } from "react";
import { useGitAction } from "@/hooks/useGitAction";
import { gitFetch, gitPull, gitRebase } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface BranchContextMenuProps {
  x: number;
  y: number;
  branchName: string;
  cwd: string;
  currentBranch: string;
  onClose: () => void;
  onAction: (action: "new-branch", branch: string) => void;
}

export function BranchContextMenu({
  x,
  y,
  branchName,
  cwd,
  currentBranch,
  onClose,
  onAction,
}: BranchContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const runGitAction = useGitAction();

  const menuWidth = 200;
  const menuHeight = 160;
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

  const handleFetch = async () => {
    onClose();
    await runGitAction("git fetch", () => gitFetch(cwd));
  };

  const handlePull = async () => {
    onClose();
    await runGitAction("git pull", () => gitPull(cwd));
  };

  const handleRebase = async () => {
    onClose();
    await runGitAction(`git rebase onto ${branchName}`, () => gitRebase(cwd, branchName));
  };

  const handleNewBranch = () => {
    onClose();
    onAction("new-branch", branchName);
  };

  const isCurrent = branchName === currentBranch;

  return (
    <div
      ref={menuRef}
      style={{ left, top, zIndex: 9999 }}
      className="fixed min-w-[200px] py-1 rounded-md shadow-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]"
    >
      <MenuItem onClick={handleFetch}>Fetch</MenuItem>
      <MenuItem onClick={handlePull}>Pull</MenuItem>
      <div className="my-1 border-t border-[var(--color-border-default)]" />
      <MenuItem onClick={handleRebase} disabled={isCurrent}>
        Rebase current onto this
      </MenuItem>
      <div className="my-1 border-t border-[var(--color-border-default)]" />
      <MenuItem onClick={handleNewBranch}>New branch from here…</MenuItem>
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
        "w-full text-left px-3 py-1.5 text-xs transition-colors",
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
