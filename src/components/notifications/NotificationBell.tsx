import { memo, useEffect, useRef, useState } from "react";
import { Bell, BellRing, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notificationStore";
import type { QuestionNotification, CompletionNotification } from "@/stores/notificationStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { useSessionStore } from "@/stores/sessionStore";

function NotificationBellComponent() {
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const setActiveProject = useProjectsStore((s) => s.setActiveProject);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const openSummaryTab = useSessionStore((s) => s.openSummaryTab);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const pendingCount = notifications.filter((n) => !n.read).length;

  // Separate by type, pending first within each group
  const questions = notifications.filter((n): n is QuestionNotification => n.type === "question");
  const completions = notifications.filter((n): n is CompletionNotification => n.type === "completion");

  const sortedQuestions = [
    ...questions.filter((n) => !n.read).sort((a, b) => b.timestamp - a.timestamp),
    ...questions.filter((n) => n.read).sort((a, b) => b.timestamp - a.timestamp),
  ];
  const sortedCompletions = [
    ...completions.filter((n) => !n.read).sort((a, b) => b.timestamp - a.timestamp),
    ...completions.filter((n) => n.read).sort((a, b) => b.timestamp - a.timestamp),
  ];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleJumpToQuestion = (n: QuestionNotification) => {
    setActiveProject(n.projectId);
    setActiveTab(n.tabId, n.projectId);
    markRead(n.id);
    setOpen(false);
  };

  const handleViewSummary = (n: CompletionNotification) => {
    setActiveProject(n.projectId);
    // Derive encoded project dir from projectId (it already is the encoded form)
    openSummaryTab(n.sessionId, n.filename, n.projectId, n.projectId);
    markRead(n.id);
    setOpen(false);
  };

  const hasAny = sortedQuestions.length > 0 || sortedCompletions.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex items-center justify-center w-8 h-8 rounded transition-colors",
          open
            ? "bg-bg-overlay text-text-primary"
            : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary"
        )}
        aria-label={
          pendingCount > 0 ? `${pendingCount} pending notification${pendingCount > 1 ? "s" : ""}` : "Notifications"
        }
      >
        {pendingCount > 0 ? (
          <BellRing size={15} className="animate-pulse text-amber-400" />
        ) : (
          <Bell size={15} />
        )}
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-amber-400 text-[9px] font-bold text-black leading-none">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-bg-overlay border border-border-default rounded shadow-lg text-xs">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
            <span className="font-semibold text-text-primary">Notifications</span>
            {hasAny && (
              <button
                onClick={() => { clearAll(); setOpen(false); }}
                className="text-text-muted hover:text-text-secondary transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {!hasAny ? (
            <div className="px-3 py-4 text-center text-text-muted">No notifications</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {/* Completions section */}
              {sortedCompletions.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--color-status-success)] uppercase tracking-wide border-b border-border-default bg-[var(--color-bg-raised)]">
                    Completions
                  </div>
                  {sortedCompletions.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "flex flex-col gap-1 px-3 py-2.5 border-b border-border-default last:border-0 transition-colors",
                        n.read ? "opacity-50" : "hover:bg-bg-raised"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CheckCircle2 size={11} className="shrink-0 text-[var(--color-status-success)]" />
                          <span className={cn("font-semibold truncate", n.read ? "text-text-muted" : "text-text-primary")}>
                            {n.sessionTitle}
                          </span>
                        </div>
                        <button
                          onClick={() => removeNotification(n.id)}
                          className="shrink-0 text-text-muted hover:text-text-secondary transition-colors mt-0.5"
                          aria-label="Remove"
                        >
                          <X size={11} />
                        </button>
                      </div>
                      <p className={cn("line-clamp-2 leading-relaxed", n.read ? "text-text-muted" : "text-text-secondary")}>
                        {n.preview}
                      </p>
                      {!n.read && (
                        <button
                          onClick={() => handleViewSummary(n)}
                          className="self-start mt-0.5 px-2 py-0.5 rounded bg-[var(--color-status-success)]/15 text-[var(--color-status-success)] hover:bg-[var(--color-status-success)]/25 transition-colors font-medium"
                        >
                          View Summary
                        </button>
                      )}
                      {n.read && <span className="text-[10px] text-text-muted">Viewed</span>}
                    </div>
                  ))}
                </>
              )}

              {/* Questions section */}
              {sortedQuestions.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wide border-b border-border-default bg-[var(--color-bg-raised)]">
                    Questions
                  </div>
                  {sortedQuestions.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "flex flex-col gap-1 px-3 py-2.5 border-b border-border-default last:border-0 transition-colors",
                        n.read ? "opacity-50" : "hover:bg-bg-raised"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {!n.read && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />}
                          <span className={cn("font-semibold truncate", n.read ? "text-text-muted" : "text-text-primary")}>
                            {n.sessionTitle}
                          </span>
                        </div>
                        <button
                          onClick={() => removeNotification(n.id)}
                          className="shrink-0 text-text-muted hover:text-text-secondary transition-colors mt-0.5"
                          aria-label="Remove"
                        >
                          <X size={11} />
                        </button>
                      </div>
                      <p className={cn("line-clamp-2 leading-relaxed", n.read ? "text-text-muted" : "text-text-secondary")}>
                        {n.question}
                      </p>
                      {!n.read && (
                        <button
                          onClick={() => handleJumpToQuestion(n)}
                          className="self-start mt-0.5 px-2 py-0.5 rounded bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25 transition-colors font-medium"
                        >
                          Jump to Session
                        </button>
                      )}
                      {n.read && <span className="text-[10px] text-text-muted">Answered</span>}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const NotificationBell = memo(NotificationBellComponent);
