import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores/settingsStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { CheckCircle, AlertCircle, Loader, ExternalLink, Info, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkRemoteRunWorkflow, writeFile, getAppVersion } from "@/lib/tauri";
import { REMOTE_RUN_YAML_CONTENT } from "@/lib/remoteRunYaml";

const FONT_FAMILIES = [
  { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
  { label: "Cascadia Code", value: "'Cascadia Code', monospace" },
  { label: "Fira Code", value: "'Fira Code', monospace" },
  { label: "Consolas", value: "Consolas, monospace" },
  { label: "Monospace (system)", value: "monospace" },
];

// ── Small reusable components ─────────────────────────────────────────────────

function StatusBadge({
  connected,
  name,
}: {
  connected: boolean;
  name: string | null;
}) {
  if (connected && name) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-status-success">
        <CheckCircle size={11} />
        {name}
      </span>
    );
  }
  if (connected) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-status-success">
        <CheckCircle size={11} /> Connected
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] text-text-muted">
      <AlertCircle size={11} /> Not connected
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-3">
      {children}
    </p>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-bg-raised border border-border-muted text-text-primary placeholder:text-text-muted outline-none focus:border-border-focus"
    />
  );
}

function Btn({
  onClick,
  disabled,
  loading,
  children,
  variant = "default",
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 disabled:opacity-50",
        variant === "danger"
          ? "border-status-error text-status-error hover:bg-status-error/10"
          : "border-border-muted text-text-secondary hover:bg-bg-overlay hover:text-text-primary"
      )}
    >
      {loading && <Loader size={11} className="animate-spin" />}
      {children}
    </button>
  );
}

// ── GitHub section ────────────────────────────────────────────────────────────

function GithubSection() {
  const {
    githubClientId,
    githubToken,
    githubUsername,
    setGithubClientId,
    setGithubToken,
    setGithubUsername,
  } = useSettingsStore();

  const [status, setStatus] = useState<"idle" | "polling" | "done">("idle");
  const [userCode, setUserCode] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [_deviceCode, setDeviceCode] = useState("");
  const [_pollInterval, setPollInterval] = useState(5);
  const [error, setError] = useState("");
  const [patInput, setPatInput] = useState("");
  const [mode, setMode] = useState<"oauth" | "pat">("oauth");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Check current gh auth status on mount
    invoke<{ connected: boolean; username: string | null }>(
      "cmd_github_auth_status"
    )
      .then((s) => {
        if (s.connected) setGithubUsername(s.username);
      })
      .catch(() => {});
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startDeviceFlow = async () => {
    if (!githubClientId.trim()) {
      setError("Enter your GitHub OAuth App Client ID first.");
      return;
    }
    setError("");
    setStatus("polling");
    try {
      const res = await invoke<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
      }>("cmd_github_device_flow_start", { clientId: githubClientId });

      setDeviceCode(res.device_code);
      setUserCode(res.user_code);
      setVerifyUrl(res.verification_uri);
      setPollInterval(res.interval);

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const token = await invoke<string | null>(
            "cmd_github_device_flow_poll",
            { clientId: githubClientId, deviceCode: res.device_code }
          );
          if (token) {
            stopPolling();
            setGithubToken(token);
            const s = await invoke<{ connected: boolean; username: string | null }>(
              "cmd_github_auth_status"
            );
            setGithubUsername(s.username);
            setStatus("done");
            setUserCode("");
          }
        } catch {
          // still pending
        }
      }, (res.interval + 1) * 1000);

      // Auto-stop after expires_in
      setTimeout(() => {
        stopPolling();
        if (status === "polling") {
          setStatus("idle");
          setError("Code expired. Try again.");
        }
      }, res.expires_in * 1000);
    } catch (e) {
      setStatus("idle");
      setError(String(e));
    }
  };

  const connectPat = async () => {
    if (!patInput.trim()) return;
    setError("");
    try {
      await invoke("cmd_github_set_token", { token: patInput });
      setGithubToken(patInput);
      const s = await invoke<{ connected: boolean; username: string | null }>(
        "cmd_github_auth_status"
      );
      setGithubUsername(s.username);
      setPatInput("");
    } catch (e) {
      setError(String(e));
    }
  };

  const disconnect = async () => {
    stopPolling();
    await invoke("cmd_github_logout").catch(() => {});
    setGithubToken("");
    setGithubUsername(null);
    setStatus("idle");
    setUserCode("");
  };

  const isConnected = !!githubUsername || !!githubToken;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>GitHub</SectionLabel>
        <StatusBadge connected={isConnected} name={githubUsername} />
      </div>

      {isConnected ? (
        <Btn variant="danger" onClick={disconnect}>
          Disconnect
        </Btn>
      ) : (
        <>
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border-muted overflow-hidden text-xs">
            {(["oauth", "pat"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 py-1 transition-all duration-200",
                  mode === m
                    ? "bg-accent-primary/20 text-accent-primary"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                {m === "oauth" ? "Device OAuth" : "Personal Access Token"}
              </button>
            ))}
          </div>

          {mode === "oauth" ? (
            <div className="space-y-2">
              <label className="text-[11px] text-text-muted block">
                GitHub OAuth App Client ID
                <a
                  href="https://github.com/settings/developers"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 inline-flex items-center gap-0.5 text-accent-primary hover:underline"
                >
                  (create one <ExternalLink size={9} />)
                </a>
              </label>
              <Input
                value={githubClientId}
                onChange={setGithubClientId}
                placeholder="Ov23li..."
              />

              {status === "polling" && userCode && (
                <div className="p-3 rounded-lg bg-bg-raised border border-border-focus space-y-2">
                  <p className="text-[11px] text-text-secondary">
                    Enter this code at{" "}
                    <span className="text-accent-primary">{verifyUrl}</span>
                  </p>
                  <p className="font-mono text-lg text-text-primary tracking-widest">
                    {userCode}
                  </p>
                  <p className="text-[10px] text-text-muted flex items-center gap-1">
                    <Loader size={10} className="animate-spin" />
                    Waiting for authorization...
                  </p>
                </div>
              )}

              <Btn
                onClick={startDeviceFlow}
                loading={status === "polling"}
                disabled={status === "polling"}
              >
                {status === "polling" ? "Waiting..." : "Connect with GitHub"}
              </Btn>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[11px] text-text-muted block">
                Personal Access Token — needs{" "}
                <code className="text-[10px] bg-bg-raised px-1 rounded-md">repo</code>
                {" + "}
                <code className="text-[10px] bg-bg-raised px-1 rounded-md">read:org</code>
              </label>
              <Input
                value={patInput}
                onChange={setPatInput}
                placeholder="ghp_..."
                type="password"
              />
              <Btn onClick={connectPat} disabled={!patInput.trim()}>
                Connect
              </Btn>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="text-[11px] text-status-error flex items-center gap-1">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Linear section ────────────────────────────────────────────────────────────

function LinearSection() {
  const { linearApiKey, linearUsername, setLinearApiKey, setLinearUsername } =
    useSettingsStore();
  const [input, setInput] = useState(linearApiKey);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const connect = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const name = await invoke<string | null>("cmd_linear_verify_key", {
        apiKey: input,
      });
      if (name) {
        setLinearApiKey(input);
        setLinearUsername(name);
      } else {
        setError("Invalid API key.");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    await invoke("cmd_linear_logout").catch(() => {});
    setLinearApiKey("");
    setLinearUsername(null);
    setInput("");
  };

  const isConnected = !!linearApiKey && !!linearUsername;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Linear</SectionLabel>
        <StatusBadge connected={isConnected} name={linearUsername} />
      </div>

      {isConnected ? (
        <Btn variant="danger" onClick={disconnect}>
          Disconnect
        </Btn>
      ) : (
        <div className="space-y-2">
          <label className="text-[11px] text-text-muted block">
            API Key — create at{" "}
            <span className="text-accent-primary">linear.app/settings/api</span>
          </label>
          <Input
            value={input}
            onChange={setInput}
            placeholder="lin_api_..."
            type="password"
          />
          <Btn onClick={connect} loading={loading} disabled={!input.trim()}>
            Connect
          </Btn>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-status-error flex items-center gap-1">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Jira section ──────────────────────────────────────────────────────────────

function JiraSection() {
  const {
    jiraBaseUrl,
    jiraEmail,
    jiraApiToken,
    jiraUsername,
    setJiraBaseUrl,
    setJiraEmail,
    setJiraApiToken,
    setJiraUsername,
  } = useSettingsStore();

  const [urlInput, setUrlInput] = useState(jiraBaseUrl);
  const [emailInput, setEmailInput] = useState(jiraEmail);
  const [tokenInput, setTokenInput] = useState(jiraApiToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const connect = async () => {
    if (!urlInput.trim() || !emailInput.trim() || !tokenInput.trim()) return;
    setLoading(true);
    setError("");
    try {
      const name = await invoke<string | null>("cmd_jira_verify_token", {
        baseUrl: urlInput,
        email: emailInput,
        apiToken: tokenInput,
      });
      if (name) {
        setJiraBaseUrl(urlInput);
        setJiraEmail(emailInput);
        setJiraApiToken(tokenInput);
        setJiraUsername(name);
      } else {
        setError("Invalid credentials. Check URL, email, and API token.");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    await invoke("cmd_jira_logout").catch(() => {});
    setJiraBaseUrl("");
    setJiraEmail("");
    setJiraApiToken("");
    setJiraUsername(null);
    setUrlInput("");
    setEmailInput("");
    setTokenInput("");
  };

  const isConnected = !!jiraApiToken && !!jiraUsername;
  const canConnect =
    urlInput.trim() && emailInput.trim() && tokenInput.trim();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Jira</SectionLabel>
        <StatusBadge connected={isConnected} name={jiraUsername} />
      </div>

      {isConnected ? (
        <Btn variant="danger" onClick={disconnect}>
          Disconnect
        </Btn>
      ) : (
        <div className="space-y-2">
          <label className="text-[11px] text-text-muted block">
            API Token — create at{" "}
            <span className="text-accent-primary">
              id.atlassian.net/manage-profile/security/api-tokens
            </span>
          </label>
          <Input
            value={urlInput}
            onChange={setUrlInput}
            placeholder="https://yourcompany.atlassian.net"
          />
          <Input
            value={emailInput}
            onChange={setEmailInput}
            placeholder="you@company.com"
          />
          <Input
            value={tokenInput}
            onChange={setTokenInput}
            placeholder="API token"
            type="password"
          />
          <Btn onClick={connect} loading={loading} disabled={!canConnect}>
            Connect
          </Btn>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-status-error flex items-center gap-1">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Session tracking section ──────────────────────────────────────────────────

function SessionTrackingSection() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<boolean>("cmd_hooks_configured")
      .then(setConfigured)
      .catch(() => setConfigured(false));
  }, []);

  const enable = async () => {
    setLoading(true);
    setError("");
    try {
      await invoke("cmd_setup_hooks");
      setConfigured(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    setError("");
    try {
      await invoke("cmd_remove_hooks");
      setConfigured(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <SectionLabel>Session Tracking</SectionLabel>
      <p className="text-[11px] text-text-muted">
        Tracks active sessions and subagents via Claude CLI hooks. Enables green live indicators and session-scoped team filtering.
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">Hook status</span>
        {configured === null ? (
          <span className="text-[11px] text-text-muted flex items-center gap-1">
            <Loader size={11} className="animate-spin" /> Checking...
          </span>
        ) : configured ? (
          <span className="flex items-center gap-1 text-[11px] text-status-success">
            <CheckCircle size={11} /> Configured
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-text-muted">
            <AlertCircle size={11} /> Not configured
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Btn onClick={enable} loading={loading} disabled={configured === true || loading}>
          Enable hooks
        </Btn>
        {configured && (
          <Btn variant="danger" onClick={disable} loading={loading} disabled={loading}>
            Remove hooks
          </Btn>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-status-error flex items-center gap-1">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Live dangerously section ──────────────────────────────────────────────────

function LiveDangerouslySection() {
  const { dangerouslySkipPermissions, setDangerouslySkipPermissions } = useSettingsStore();

  return (
    <div className="space-y-3">
      <SectionLabel>Permissions</SectionLabel>
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={dangerouslySkipPermissions}
            onChange={(e) => setDangerouslySkipPermissions(e.target.checked)}
            className="rounded-md"
          />
          <span className="text-xs font-medium text-text-secondary">
            Live dangerously (skip permissions)
          </span>
        </label>
        <p className="text-[11px] text-text-muted mt-1 ml-5">
          Passes <code className="text-[10px] bg-bg-raised px-1 rounded-md">--dangerously-skip-permissions</code> to every new Claude session. Skips all tool-use approval prompts.
        </p>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const { nativeNotificationsEnabled, setNativeNotificationsEnabled } = useSettingsStore();
  return (
    <div className="space-y-3">
      <SectionLabel>Native Notifications</SectionLabel>
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={nativeNotificationsEnabled}
            onChange={(e) => setNativeNotificationsEnabled(e.target.checked)}
            className="rounded-md"
          />
          <span className="text-xs font-medium text-text-secondary">
            Show Windows notifications when app is in background
          </span>
        </label>
        <p className="text-[11px] text-text-muted mt-1 ml-5">
          Sends a toast to Windows Notification Center for Claude questions and session completions, only while the app is not focused.
        </p>
      </div>
    </div>
  );
}

// ── File display section ──────────────────────────────────────────────────────

function FileDisplaySection() {
  const { showHiddenFilesByDefault, setShowHiddenFilesByDefault } = useSettingsStore();
  return (
    <div className="space-y-3">
      <SectionLabel>File Browser</SectionLabel>
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showHiddenFilesByDefault}
            onChange={(e) => setShowHiddenFilesByDefault(e.target.checked)}
            className="rounded-md"
          />
          <span className="text-xs font-medium text-text-secondary">
            Show hidden files by default
          </span>
        </label>
        <p className="text-[11px] text-text-muted mt-1 ml-5">
          When enabled, hidden files (dotfiles) are visible in the file browser for new projects. Per-project overrides are saved automatically.
        </p>
      </div>
    </div>
  );
}

// ── Remote Run section ────────────────────────────────────────────────────────

function RemoteRunSection() {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const projects = useProjectsStore((s) => s.projects);
  const cwd = projects.find((p) => p.id === activeProjectId)?.path ?? null;

  const [installed, setInstalled] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!cwd) { setInstalled(null); return; }
    checkRemoteRunWorkflow(cwd).then(setInstalled).catch(() => setInstalled(false));
  }, [cwd]);

  const handleInstall = async () => {
    if (!cwd) return;
    setInstalling(true);
    try {
      await writeFile(`${cwd}/.github/workflows/remote-run.yml`, REMOTE_RUN_YAML_CONTENT);
      setInstalled(true);
      setMsg("Installed! Commit and push the file to activate.");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="space-y-3">
      <SectionLabel>Remote Run</SectionLabel>
      <p className="text-[11px] text-text-muted">
        Install a GitHub Actions workflow that runs Claude Code on issue prompts and opens a PR.
      </p>
      {!cwd ? (
        <p className="text-[11px] text-text-muted italic">No active project selected.</p>
      ) : installed === null ? null : installed ? (
        <div className="flex items-center gap-2">
          <CheckCircle size={12} className="text-status-success" />
          <span className="text-[11px] text-status-success">Workflow installed in active project.</span>
        </div>
      ) : (
        <Btn onClick={handleInstall} loading={installing} disabled={!cwd || installing}>
          Install remote-run.yml
        </Btn>
      )}
      {msg && <p className="text-[11px] text-text-muted">{msg}</p>}
      {installed && (
        <div className="flex gap-2 rounded-md border border-[var(--color-border-muted)] bg-bg-raised p-3">
          <Info size={13} className="mt-0.5 shrink-0 text-text-muted" />
          <div className="space-y-1">
            <p className="text-[11px] text-text-secondary font-medium">Required: enable workflow permissions</p>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Go to your repo's <span className="font-mono text-[10px] bg-bg-overlay px-1 rounded">Settings → Actions → General</span> and set:
            </p>
            <ul className="text-[11px] text-text-muted space-y-0.5 list-none pl-0">
              <li>• <span className="text-text-secondary">Read and write permissions</span></li>
              <li>• <span className="text-text-secondary">Allow GitHub Actions to create and approve pull requests</span> ✓</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── About section ─────────────────────────────────────────────────────────────

const GITHUB_REPO = "tracstarr/the-associate-studio";

type UpdateStatus = "idle" | "checking" | "up-to-date" | "update-available";

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function AboutSection() {
  const [version, setVersion] = useState<string>("…");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null);

  const checkForUpdates = async (silent = false) => {
    if (!silent) setUpdateStatus("checking");
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      if (!res.ok) {
        if (!silent) setUpdateStatus("idle");
        return;
      }
      const data = await res.json() as { tag_name: string; html_url: string };
      const latest = data.tag_name.replace(/^v/, "");
      setLatestVersion(latest);
      setReleaseUrl(data.html_url);

      const current = await getAppVersion().catch(() => version);
      if (compareSemver(latest, current) > 0) {
        setUpdateStatus("update-available");
      } else {
        if (!silent) setUpdateStatus("up-to-date");
      }
    } catch {
      if (!silent) setUpdateStatus("idle");
    }
  };

  useEffect(() => {
    getAppVersion().then(setVersion).catch(() => setVersion("unknown"));
  }, []);

  // Auto-check on mount (silently — only surface if update found)
  useEffect(() => {
    checkForUpdates(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* Info rows */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="w-24 text-text-muted">App</span>
          <span className="text-text-secondary">The Associate Studio</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-24 text-text-muted">Version</span>
          <span className="font-mono text-text-secondary">{version}</span>
        </div>
      </div>

      {/* Update controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Btn
          onClick={() => checkForUpdates(false)}
          loading={updateStatus === "checking"}
          disabled={updateStatus === "checking"}
        >
          Check for updates
        </Btn>

        {updateStatus === "up-to-date" && (
          <span className="flex items-center gap-1.5 text-[11px] text-status-success">
            <CheckCircle size={11} /> Up to date
          </span>
        )}

        {updateStatus === "update-available" && latestVersion && releaseUrl && (
          <a
            href={releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-accent-primary hover:underline"
          >
            <ArrowUpCircle size={11} />
            v{latestVersion} available
            <ExternalLink size={9} />
          </a>
        )}
      </div>

      {/* GitHub link */}
      <a
        href={`https://github.com/${GITHUB_REPO}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
      >
        View on GitHub
        <ExternalLink size={9} />
      </a>
    </div>
  );
}

// ── Sticky section header ─────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 py-2 bg-[var(--color-bg-base)] border-b border-[var(--color-border-muted)] mb-6 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
      {children}
    </div>
  );
}

// ── Main settings tab ─────────────────────────────────────────────────────────

export function SettingsTab() {
  const { fontSize, fontFamily, setFontSize, setFontFamily, openStartupFiles, setOpenStartupFiles } =
    useSettingsStore();

  return (
    <div className="overflow-y-auto h-full bg-[var(--color-bg-base)]">
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-10">
        {/* Page title */}
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>

        {/* ── Appearance ─────────────────────────────────────────── */}
        <section>
          <SectionHeader>Appearance</SectionHeader>
          <div className="space-y-5">
            {/* Font size */}
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-2">
                Font Size: {fontSize}px
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFontSize(Math.max(fontSize - 1, 8))}
                  className="w-7 h-7 rounded-lg bg-bg-raised border border-border-muted text-text-secondary hover:bg-bg-overlay text-sm transition-all duration-200"
                >
                  -
                </button>
                <input
                  type="range"
                  min={8}
                  max={24}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="flex-1"
                />
                <button
                  onClick={() => setFontSize(Math.min(fontSize + 1, 24))}
                  className="w-7 h-7 rounded-lg bg-bg-raised border border-border-muted text-text-secondary hover:bg-bg-overlay text-sm transition-all duration-200"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => setFontSize(14)}
                className="mt-1 text-[10px] text-text-muted hover:text-text-secondary"
              >
                Reset to default
              </button>
            </div>

            {/* Startup files */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openStartupFiles}
                  onChange={(e) => setOpenStartupFiles(e.target.checked)}
                  className="rounded-md"
                />
                <span className="text-xs font-medium text-text-secondary">
                  Open CLAUDE.md &amp; README.md when switching projects
                </span>
              </label>
              <p className="text-[11px] text-text-muted mt-1 ml-5">
                When enabled, both files open automatically as tabs on project switch.
              </p>
            </div>

            {/* Font family */}
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-2">
                Font Family
              </label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-lg bg-bg-raised border border-border-muted text-text-secondary outline-none focus:border-border-focus"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview */}
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-2">
                Preview
              </label>
              <div
                className="p-3 rounded-lg bg-bg-terminal text-text-primary"
                style={{ fontFamily, fontSize }}
              >
                <span className="text-accent-primary">claude</span>
                <span> --help</span>
              </div>
            </div>

            {/* Keybindings */}
            <div>
              <p className="text-xs font-medium text-text-secondary mb-2">
                Keyboard Shortcuts
              </p>
              <div className="space-y-1">
                {[
                  ["Ctrl+P", "Command palette"],
                  ["Ctrl+N", "New session"],
                  ["Ctrl+W", "Close tab"],
                  ["Ctrl+B", "Toggle sidebar"],
                  ["Ctrl+J", "Toggle bottom panel"],
                  ["Ctrl+1-5", "Switch sidebar view"],
                  ["Ctrl+Tab", "Next tab"],
                  ["Ctrl+=/-", "Font size"],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center gap-2">
                    <kbd className="text-[10px] border border-border-muted px-1.5 py-0.5 rounded-md font-mono text-text-muted">
                      {key}
                    </kbd>
                    <span className="text-[10px] text-text-muted">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Integrations ───────────────────────────────────────── */}
        <section>
          <SectionHeader>Integrations</SectionHeader>
          <div className="space-y-6">
            <GithubSection />
            <div className="border-t border-border-muted" />
            <LinearSection />
            <div className="border-t border-border-muted" />
            <JiraSection />
            <div className="border-t border-border-muted" />
            <RemoteRunSection />
          </div>
        </section>

        {/* ── Session ────────────────────────────────────────────── */}
        <section>
          <SectionHeader>Session</SectionHeader>
          <div className="space-y-6">
            <SessionTrackingSection />
            <LiveDangerouslySection />
            <div className="border-t border-border-muted" />
            <NotificationsSection />
            <div className="border-t border-border-muted" />
            <FileDisplaySection />
          </div>
        </section>

        {/* ── About ──────────────────────────────────────────────── */}
        <section>
          <SectionHeader>About</SectionHeader>
          <AboutSection />
        </section>
      </div>
    </div>
  );
}
