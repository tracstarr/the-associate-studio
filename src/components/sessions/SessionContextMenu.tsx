import { useEffect, useRef } from "react";

interface SessionContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  isLive: boolean;
  onClose: () => void;
  onResume: () => void;
  onFork: () => void;
  onDelete: () => void;
}

export function SessionContextMenu({
  x,
  y,
  isOpen,
  isLive,
  onClose,
  onResume,
  onFork,
  onDelete,
}: SessionContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const menuWidth = 180;
  const menuHeight = 120;
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

  const resumeLabel = isOpen ? "Switch to tab" : "Resume in terminal";

  return (
    <div
      ref={menuRef}
      style={{ left, top, zIndex: 9999 }}
      className="fixed min-w-[180px] py-1 panel-card-overlay"
    >
      <MenuItem onClick={onResume}>{resumeLabel}</MenuItem>
      <MenuItem onClick={onFork}>Fork into new session</MenuItem>
      <div className="my-1 border-t border-[var(--color-border-muted)]" />
      <MenuItem
        onClick={isLive ? undefined : onDelete}
        disabled={isLive}
        danger={!isLive}
      >
        Delete
      </MenuItem>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      className={
        disabled
          ? "w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-muted)] cursor-default rounded-lg mx-1"
          : danger
          ? "w-full text-left px-3 py-1.5 text-xs text-[var(--color-status-error)] hover:bg-[var(--color-bg-raised)] transition-all duration-200 rounded-lg mx-1"
          : "w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)] transition-all duration-200 rounded-lg mx-1"
      }
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
