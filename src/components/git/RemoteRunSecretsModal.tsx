import { useState, useEffect, useCallback } from "react";
import { X, CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { listRepoSecrets, setRepoSecret } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

interface RemoteRunSecretsModalProps {
  cwd: string;
  onClose: () => void;
}

const SECRET_DEFS = [
  { name: "CLAUDE_API_KEY", label: "Anthropic API Key" },
  { name: "JIRA_API_TOKEN", label: "Jira API Token" },
  { name: "JIRA_BASE_URL", label: "Jira Base URL" },
  { name: "JIRA_EMAIL", label: "Jira Email" },
  { name: "LINEAR_API_KEY", label: "Linear API Key" },
] as const;

type SecretName = (typeof SECRET_DEFS)[number]["name"];

type FieldState = Record<SecretName, string>;
type SaveState = Record<SecretName, "idle" | "saving" | "ok" | "error">;
type OverwriteState = Record<SecretName, boolean>;

export function RemoteRunSecretsModal({ cwd, onClose }: RemoteRunSecretsModalProps) {
  const jiraApiToken = useSettingsStore((s) => s.jiraApiToken);
  const jiraBaseUrl = useSettingsStore((s) => s.jiraBaseUrl);
  const jiraEmail = useSettingsStore((s) => s.jiraEmail);
  const linearApiKey = useSettingsStore((s) => s.linearApiKey);

  const [existingSecrets, setExistingSecrets] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fields, setFields] = useState<FieldState>({
    CLAUDE_API_KEY: "",
    JIRA_API_TOKEN: jiraApiToken,
    JIRA_BASE_URL: jiraBaseUrl,
    JIRA_EMAIL: jiraEmail,
    LINEAR_API_KEY: linearApiKey,
  });

  const [saveStates, setSaveStates] = useState<SaveState>({
    CLAUDE_API_KEY: "idle",
    JIRA_API_TOKEN: "idle",
    JIRA_BASE_URL: "idle",
    JIRA_EMAIL: "idle",
    LINEAR_API_KEY: "idle",
  });

  const [saveErrors, setSaveErrors] = useState<Partial<Record<SecretName, string>>>({});
  const [saving, setSaving] = useState(false);

  const [overwrite, setOverwrite] = useState<OverwriteState>({
    CLAUDE_API_KEY: false,
    JIRA_API_TOKEN: false,
    JIRA_BASE_URL: false,
    JIRA_EMAIL: false,
    LINEAR_API_KEY: false,
  });

  // Load existing secrets on mount
  useEffect(() => {
    listRepoSecrets(cwd)
      .then(setExistingSecrets)
      .catch((e) => setLoadError(String(e)));
  }, [cwd]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isSet = (name: string) => existingSecrets?.includes(name) ?? false;

  const hasSomethingToSave = SECRET_DEFS.some(({ name }) => {
    const value = fields[name].trim();
    if (!value) return false;
    if (isSet(name) && !overwrite[name]) return false;
    return true;
  });

  const handleSave = async () => {
    setSaving(true);
    const toSave = SECRET_DEFS.filter(({ name }) => {
      const value = fields[name].trim();
      if (!value) return false;
      if (isSet(name) && !overwrite[name]) return false;
      return true;
    });

    // Reset states for fields we're about to save
    const nextStates = { ...saveStates };
    const nextErrors = { ...saveErrors };
    for (const { name } of toSave) {
      nextStates[name] = "saving";
      delete nextErrors[name];
    }
    setSaveStates(nextStates);
    setSaveErrors(nextErrors);

    await Promise.all(
      toSave.map(async ({ name }) => {
        try {
          await setRepoSecret(cwd, name, fields[name].trim());
          setSaveStates((prev) => ({ ...prev, [name]: "ok" }));
          // Refresh existing secrets list
          setExistingSecrets((prev) =>
            prev ? (prev.includes(name) ? prev : [...prev, name]) : [name]
          );
        } catch (e) {
          setSaveStates((prev) => ({ ...prev, [name]: "error" }));
          setSaveErrors((prev) => ({ ...prev, [name]: String(e) }));
        }
      })
    );

    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg-surface border border-border-muted rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Remote Run — GitHub Secrets</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Set secrets on your GitHub repo so the workflow can run.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors shrink-0 ml-4"
          >
            <X size={14} />
          </button>
        </div>

        {/* GITHUB_TOKEN row */}
        <div className="px-5 py-2 border-t border-border-muted">
          <div className="flex items-center gap-2">
            <CheckCircle size={12} className="text-status-success shrink-0" />
            <span className="text-xs font-mono text-text-secondary">GITHUB_TOKEN</span>
            <span className="ml-auto text-[10px] text-status-success">Provided automatically by GitHub Actions</span>
          </div>
        </div>

        {/* Load error */}
        {loadError && (
          <div className="px-5 py-2 flex items-center gap-2 text-[10px] text-status-warning border-t border-border-muted">
            <AlertTriangle size={10} className="shrink-0" />
            Could not check existing secrets: {loadError}
          </div>
        )}

        {/* Secret rows */}
        <div className="px-5 py-3 space-y-3 border-t border-border-muted">
          {SECRET_DEFS.map(({ name, label }) => {
            const alreadySet = isSet(name);
            const state = saveStates[name];
            const err = saveErrors[name];

            return (
              <div key={name} className="space-y-1">
                <div className="flex items-center gap-2">
                  {state === "ok" ? (
                    <CheckCircle size={10} className="text-status-success shrink-0" />
                  ) : state === "error" ? (
                    <AlertTriangle size={10} className="text-status-error shrink-0" />
                  ) : alreadySet ? (
                    <CheckCircle size={10} className="text-status-success shrink-0" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full border border-border-muted shrink-0" />
                  )}
                  <span className="text-[11px] text-text-secondary">{label}</span>
                  <span className="text-[10px] font-mono text-text-muted ml-1">{name}</span>
                  {alreadySet && state === "idle" && (
                    <span className="text-[10px] text-status-success">Already set</span>
                  )}
                  {alreadySet && (
                    <label className="ml-auto flex items-center gap-1 text-[10px] text-text-muted cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={overwrite[name]}
                        onChange={(e) =>
                          setOverwrite((prev) => ({ ...prev, [name]: e.target.checked }))
                        }
                        className="w-3 h-3 accent-accent-primary"
                      />
                      overwrite
                    </label>
                  )}
                </div>
                <input
                  type="password"
                  value={fields[name]}
                  onChange={(e) =>
                    setFields((prev) => ({ ...prev, [name]: e.target.value }))
                  }
                  placeholder={alreadySet && !overwrite[name] ? "already set — check overwrite to change" : ""}
                  disabled={alreadySet && !overwrite[name]}
                  className={cn(
                    "w-full px-2.5 py-1.5 text-xs bg-bg-base border rounded-lg text-text-primary placeholder-text-muted focus:outline-none transition-colors",
                    alreadySet && !overwrite[name] && "opacity-50 cursor-not-allowed",
                    state === "error"
                      ? "border-status-error focus:border-status-error"
                      : "border-border-muted focus:border-border-focus"
                  )}
                />
                {err && (
                  <p className="text-[10px] text-status-error">{err}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border-muted">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasSomethingToSave}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-accent-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
