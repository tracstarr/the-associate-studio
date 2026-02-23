import { useState } from "react";
import { Send } from "lucide-react";
import { useTeams, useInbox } from "../../hooks/useClaudeData";
import { sendInboxMessage } from "../../lib/tauri";
import type { InboxMessage } from "../../lib/tauri";
import { useActiveProjectTabs } from "../../hooks/useActiveProjectTabs";

export function InboxPanel() {
  const { data: teams } = useTeams();
  const { openTabs, activeTabId } = useActiveProjectTabs();
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const activeSessionId = activeTab?.resolvedSessionId;

  const filteredTeams = activeSessionId
    ? (teams?.filter((t) => t.config?.leadSessionId === activeSessionId) ?? [])
    : [];
  const displayTeams = filteredTeams.length > 0 ? filteredTeams : (teams ?? []);

  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);

  const { data: messages, refetch } = useInbox(
    selectedTeam ?? "",
    selectedAgent ?? ""
  );

  const team = displayTeams.find((t) => t.dirName === selectedTeam);
  const agents = team?.config.members.map((m) => m.name) ?? [];

  const handleSend = async () => {
    if (!composeText.trim() || !selectedTeam || !selectedAgent) return;
    setSending(true);
    try {
      await sendInboxMessage(
        selectedTeam,
        selectedAgent,
        "team-lead",
        composeText.trim()
      );
      setComposeText("");
      refetch();
    } catch (e) {
      console.error("Send failed:", e);
    } finally {
      setSending(false);
    }
  };

  const visibleMessages =
    messages?.filter((m) => {
      if (m.text.startsWith("{")) {
        try {
          const parsed = JSON.parse(m.text);
          return (
            parsed.type === "message" || parsed.type === "task_completed"
          );
        } catch {
          return true;
        }
      }
      return true;
    }) ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Team/Agent selector */}
      <div className="px-2 py-2 border-b border-[var(--color-border-default)] space-y-1.5">
        <select
          value={selectedTeam ?? ""}
          onChange={(e) => {
            setSelectedTeam(e.target.value || null);
            setSelectedAgent(null);
          }}
          className="w-full text-xs px-2 py-1 rounded bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-border-focus)]"
        >
          <option value="">Select team...</option>
          {displayTeams.map((t) => (
            <option key={t.dirName} value={t.dirName}>
              {t.config.name ?? t.dirName}
            </option>
          ))}
        </select>
        {selectedTeam && (
          <select
            value={selectedAgent ?? ""}
            onChange={(e) => setSelectedAgent(e.target.value || null)}
            className="w-full text-xs px-2 py-1 rounded bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="">Select agent...</option>
            {agents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {!selectedTeam && (
          <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
            Select a team and agent to view inbox
          </div>
        )}
        {visibleMessages.map((msg, i) => (
          <MessageRow key={i} message={msg} />
        ))}
        {selectedAgent && visibleMessages.length === 0 && (
          <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
            No messages
          </div>
        )}
      </div>

      {/* Compose area */}
      {selectedAgent && (
        <div className="p-2 border-t border-[var(--color-border-default)]">
          <div className="flex gap-2">
            <textarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              placeholder={`Message ${selectedAgent}...`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              className="flex-1 text-xs px-2 py-1.5 rounded bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-border-focus)] resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!composeText.trim() || sending}
              className="px-2 py-1 rounded bg-[var(--color-accent-primary)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <Send size={12} />
            </button>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
            Enter to send, Shift+Enter for newline
          </p>
        </div>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: InboxMessage }) {
  let displayText = message.text;
  if (message.text.startsWith("{")) {
    try {
      const parsed = JSON.parse(message.text);
      displayText =
        parsed.content ?? parsed.subject ?? parsed.text ?? message.text;
    } catch {
      /* use raw text */
    }
  }

  const timeStr = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="px-3 py-2 border-b border-[var(--color-border-default)]">
      <div className="flex items-center gap-2 mb-0.5">
        <span
          className="text-[10px] font-medium"
          style={{
            color: message.color ?? "var(--color-text-secondary)",
          }}
        >
          {message.from}
        </span>
        {timeStr && (
          <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
            {timeStr}
          </span>
        )}
      </div>
      <p className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
        {displayText}
      </p>
    </div>
  );
}
