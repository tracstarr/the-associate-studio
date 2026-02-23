import { useState } from "react";
import { useTeams, useInbox } from "../../hooks/useClaudeData";
import { sendInboxMessage } from "../../lib/tauri";
import { Send } from "lucide-react";

export function InboxRightPanel() {
  const { data: teams } = useTeams();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);

  const { data: messages, refetch } = useInbox(
    selectedTeam ?? "",
    selectedAgent ?? ""
  );
  const team = teams?.find((t) => t.dirName === selectedTeam);

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
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const visibleMessages =
    messages?.filter((m) => {
      if (!m.text.startsWith("{")) return true;
      try {
        const p = JSON.parse(m.text);
        return (
          p.type === "message" ||
          p.type === "task_completed" ||
          p.type === "plan_approval_request"
        );
      } catch {
        return true;
      }
    }) ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-2 py-2 border-b border-[var(--color-border-default)] space-y-1">
        <select
          value={selectedTeam ?? ""}
          onChange={(e) => {
            setSelectedTeam(e.target.value || null);
            setSelectedAgent(null);
          }}
          className="w-full text-xs px-2 py-1 rounded bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] outline-none"
        >
          <option value="">Select team...</option>
          {teams?.map((t) => (
            <option key={t.dirName} value={t.dirName}>
              {t.config.name ?? t.dirName}
            </option>
          ))}
        </select>
        {selectedTeam && (
          <select
            value={selectedAgent ?? ""}
            onChange={(e) => setSelectedAgent(e.target.value || null)}
            className="w-full text-xs px-2 py-1 rounded bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] outline-none"
          >
            <option value="">Select agent...</option>
            {team?.config.members.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {visibleMessages.map((msg, i) => {
          let text = msg.text;
          if (text.startsWith("{")) {
            try {
              text = JSON.parse(text).content ?? text;
            } catch {
              /* use raw */
            }
          }
          return (
            <div
              key={i}
              className="px-3 py-2 border-b border-[var(--color-border-default)]"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: msg.color ?? "var(--color-text-secondary)",
                  }}
                >
                  {msg.from}
                </span>
                {msg.timestamp && (
                  <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
                {text}
              </p>
            </div>
          );
        })}
        {selectedAgent && visibleMessages.length === 0 && (
          <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
            No messages
          </div>
        )}
      </div>

      {selectedAgent && (
        <div className="p-2 border-t border-[var(--color-border-default)]">
          <div className="flex gap-2">
            <input
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              placeholder={`Message ${selectedAgent}...`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 text-xs px-2 py-1.5 rounded bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-border-focus)]"
            />
            <button
              onClick={handleSend}
              disabled={!composeText.trim() || sending}
              className="px-2 py-1 rounded bg-[var(--color-accent-primary)] text-white disabled:opacity-40"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
