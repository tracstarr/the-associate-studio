import { useEffect, useRef } from "react";
import type { SessionTab } from "@/stores/sessionStore";

export type TabCloseAction = "close" | "closeAll" | "closeOthers" | "closeLeft" | "closeRight";

interface TabContextMenuProps {
  x: number;
  y: number;
  tab: SessionTab;
  tabs: SessionTab[];
  onClose: () => void;
  onAction: (action: TabCloseAction) => void;
}

export function TabContextMenu({ x, y, tab, tabs, onClose, onAction }: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const tabIndex = tabs.findIndex((t) => t.id === tab.id);
  const isFirst = tabIndex === 0;
  const isLast = tabIndex === tabs.length - 1;
  const isOnly = tabs.length === 1;

  // Clamp position to viewport
  const menuWidth = 180;
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

  const handleAction = (action: TabCloseAction) => {
    onAction(action);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left, top, zIndex: 9999 }}
      className="fixed min-w-[180px] py-1 rounded-md shadow-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]"
    >
      <MenuItem onClick={() => handleAction("close")}>Close</MenuItem>
      <div className="my-1 border-t border-[var(--color-border-default)]" />
      <MenuItem onClick={() => handleAction("closeAll")}>Close All</MenuItem>
      <MenuItem
        onClick={() => !isOnly && handleAction("closeOthers")}
        disabled={isOnly}
      >
        Close Others
      </MenuItem>
      {!isFirst && (
        <MenuItem onClick={() => handleAction("closeLeft")}>Close to Left</MenuItem>
      )}
      {!isLast && (
        <MenuItem onClick={() => handleAction("closeRight")}>Close to Right</MenuItem>
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
      className={
        disabled
          ? "w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-muted)] cursor-default"
          : "w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)] transition-colors"
      }
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
