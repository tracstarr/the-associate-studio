import { useState, useEffect } from "react";
import { X, StickyNote, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note, IssueRef, LinearTeam, JiraProject } from "@/lib/tauri";
import {
  createGithubIssue,
  getLinearTeams,
  createLinearIssue,
  getJiraProjects,
  createJiraIssue,
} from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";

type Provider = "github" | "linear" | "jira";

interface CreateIssueModalProps {
  note: Note;
  activeProjectDir: string | null;
  onCreated: (ref: IssueRef) => void;
  onClose: () => void;
}

export function CreateIssueModal({
  note,
  activeProjectDir,
  onCreated,
  onClose,
}: CreateIssueModalProps) {
  const githubToken = useSettingsStore((s) => s.githubToken);
  const linearApiKey = useSettingsStore((s) => s.linearApiKey);
  const jiraBaseUrl = useSettingsStore((s) => s.jiraBaseUrl);
  const jiraEmail = useSettingsStore((s) => s.jiraEmail);
  const jiraApiToken = useSettingsStore((s) => s.jiraApiToken);

  const availableProviders: Provider[] = [];
  if (githubToken && activeProjectDir) availableProviders.push("github");
  if (linearApiKey) availableProviders.push("linear");
  if (jiraBaseUrl && jiraEmail && jiraApiToken) availableProviders.push("jira");

  const [activeProvider, setActiveProvider] = useState<Provider | null>(
    availableProviders[0] ?? null
  );
  const [title, setTitle] = useState(note.title || "Untitled");
  const [body, setBody] = useState(note.content);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Linear teams
  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  // Jira projects
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>("");
  const [issueType, setIssueType] = useState<string>("Task");

  // Load Linear teams when switching to linear
  useEffect(() => {
    if (activeProvider !== "linear" || teams.length > 0) return;
    setTeamsLoading(true);
    getLinearTeams()
      .then((t) => {
        setTeams(t);
        if (t.length > 0) setSelectedTeamId(t[0].id);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setTeamsLoading(false));
  }, [activeProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load Jira projects when switching to jira
  useEffect(() => {
    if (activeProvider !== "jira" || projects.length > 0) return;
    setProjectsLoading(true);
    getJiraProjects(jiraBaseUrl, jiraEmail, jiraApiToken)
      .then((p) => {
        setProjects(p);
        if (p.length > 0) setSelectedProjectKey(p[0].key);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setProjectsLoading(false));
  }, [activeProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!activeProvider) return;
    setCreating(true);
    setError(null);
    try {
      let ref: IssueRef;
      if (activeProvider === "github") {
        ref = await createGithubIssue(activeProjectDir!, title, body);
      } else if (activeProvider === "linear") {
        if (!selectedTeamId) throw new Error("Select a team");
        ref = await createLinearIssue(title, body, selectedTeamId);
      } else {
        if (!selectedProjectKey) throw new Error("Select a project");
        ref = await createJiraIssue(
          jiraBaseUrl,
          jiraEmail,
          jiraApiToken,
          title,
          body,
          selectedProjectKey,
          issueType
        );
      }
      onCreated(ref);
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const providerLabel: Record<Provider, string> = {
    github: "GitHub",
    linear: "Linear",
    jira: "Jira",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg shadow-xl w-[480px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border-default)] shrink-0">
          <StickyNote size={14} className="text-[var(--color-accent-primary)]" />
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            Create Issue from Note
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {availableProviders.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              No issue trackers configured — open Settings to add GitHub, Linear, or Jira.
            </p>
          ) : (
            <>
              {/* Provider tabs */}
              {availableProviders.length > 1 && (
                <div className="flex gap-1">
                  {availableProviders.map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setActiveProvider(p);
                        setError(null);
                      }}
                      className={cn(
                        "px-3 py-1 text-[11px] rounded border transition-colors",
                        activeProvider === p
                          ? "border-[var(--color-accent-primary)] text-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10"
                          : "border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                      )}
                    >
                      {providerLabel[p]}
                    </button>
                  ))}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] rounded px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] transition-colors"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  className="w-full bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] rounded px-3 py-1.5 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] transition-colors resize-none"
                />
              </div>

              {/* Provider-specific section */}
              {activeProvider === "linear" && (
                <div>
                  <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Team</label>
                  {teamsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <Loader2 size={10} className="animate-spin" />
                      Loading teams…
                    </div>
                  ) : (
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="w-full bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] rounded px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] transition-colors"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.key})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {activeProvider === "jira" && (
                <>
                  <div>
                    <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Project</label>
                    {projectsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                        <Loader2 size={10} className="animate-spin" />
                        Loading projects…
                      </div>
                    ) : (
                      <select
                        value={selectedProjectKey}
                        onChange={(e) => setSelectedProjectKey(e.target.value)}
                        className="w-full bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] rounded px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] transition-colors"
                      >
                        {projects.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.name} ({p.key})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Issue Type</label>
                    <select
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value)}
                      className="w-full bg-[var(--color-bg-raised)] border border-[var(--color-border-default)] rounded px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)] transition-colors"
                    >
                      <option value="Task">Task</option>
                      <option value="Story">Story</option>
                      <option value="Bug">Bug</option>
                      <option value="Subtask">Subtask</option>
                    </select>
                  </div>
                </>
              )}

              {/* Error */}
              {error && (
                <p className="text-[10px] text-[var(--color-status-error)]">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border-default)] shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
          >
            Cancel
          </button>
          {availableProviders.length > 0 && (
            <button
              onClick={handleCreate}
              disabled={creating || !activeProvider}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[var(--color-accent-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {creating && <Loader2 size={10} className="animate-spin" />}
              {creating ? "Creating…" : "Create Issue"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
