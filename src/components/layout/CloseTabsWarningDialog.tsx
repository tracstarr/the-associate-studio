import { useEffect } from "react";

interface CloseTabsWarningDialogProps {
  warnings: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function CloseTabsWarningDialog({ warnings, onConfirm, onCancel }: CloseTabsWarningDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg shadow-xl w-full max-w-sm mx-4 p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Close tabs?</h2>
        <ul className="space-y-1.5 mb-5">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
              <span className="shrink-0 text-[var(--color-status-warning)]">⚠</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-xs bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-default)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded text-xs bg-[var(--color-status-error)] text-white hover:opacity-90 transition-opacity"
          >
            Close Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
