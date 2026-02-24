import { useEffect, useRef } from "react";
import { useOutputStore } from "@/stores/outputStore";
import { cn } from "@/lib/utils";

export function OutputPanel() {
  const messages = useOutputStore((s) => s.messages);
  const clear = useOutputStore((s) => s.clear);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="flex flex-col h-full bg-bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-6 border-b border-border-muted/60 shrink-0">
        <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">
          Output
        </span>
        {messages.length > 0 && (
          <button
            onClick={clear}
            className="text-[10px] text-text-muted hover:text-text-primary transition-all duration-200"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px]">
        {messages.length === 0 ? (
          <p className="text-text-muted">No output yet.</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex gap-2 mb-0.5 leading-relaxed">
              <span className="text-text-muted shrink-0">{msg.timestamp}</span>
              <span className="text-text-muted shrink-0 max-w-28 truncate" title={msg.source}>
                [{msg.source}]
              </span>
              <span
                className={cn(
                  "flex-1 whitespace-pre-wrap break-all",
                  msg.level === "success" && "text-status-success",
                  msg.level === "error" && "text-status-error",
                  msg.level === "info" && "text-text-secondary"
                )}
              >
                {msg.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
