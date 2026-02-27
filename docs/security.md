# Security

## Secret storage

Sensitive credentials are **never** written to disk in plain text. They are stored in the Windows Credential Manager via the `keyring` crate (v3).

| Secret | Keyring key | What it unlocks |
|--------|-------------|-----------------|
| GitHub token | `the-associate-studio / github-token` | GitHub API + gh CLI |
| Linear API key | `the-associate-studio / linear-api-key` | Linear GraphQL API |
| Jira API token | `the-associate-studio / jira-api-token` | Jira REST API |

### What goes where

| Data | Storage | Reason |
|------|---------|--------|
| API tokens / OAuth tokens | Windows Credential Manager | Encrypted with DPAPI, tied to user login |
| GitHub OAuth client ID | `settings.json` | Not sensitive — public identifier |
| Jira base URL + email | `settings.json` | Not sensitive — account metadata |
| Font size / family | `settings.json` | Preference data |

### settings.json location

`%APPDATA%\com.keith.the-associate-studio\settings.json` (managed by `tauri-plugin-store`).

This file is intentionally free of secrets. If it is read by any process, no credentials are exposed.

## Windows Credential Manager

Credentials stored under the service name `the-associate-studio` are visible in:

**Control Panel → Credential Manager → Windows Credentials**

They are DPAPI-encrypted, meaning they can only be decrypted by the same Windows user account on the same machine (or with the user's domain roaming profile). This is the same mechanism used by:
- Git Credential Manager
- VS Code secret storage
- Azure CLI

## keyring crate API used

```rust
const KEYRING_SERVICE: &str = "the-associate-studio";

// Store
keyring::Entry::new(KEYRING_SERVICE, "github-token")?.set_password(&token)?;

// Retrieve
keyring::Entry::new(KEYRING_SERVICE, "github-token")?.get_password()?;

// Delete (on disconnect)
keyring::Entry::new(KEYRING_SERVICE, "github-token")?.delete_credential()?;
```

Helper functions `secret_set`, `secret_get`, and `secret_delete` in `src-tauri/src/commands/integrations.rs` wrap these calls.

## In-memory token lifetime

On startup, `cmd_load_integration_secrets` reads all three tokens from keyring and hydrates `settingsStore` in memory. Tokens live in React component state only — they are never serialized back to disk by the frontend.

## Tauri security configuration

### Content Security Policy (CSP)

CSP is currently set to `null` in `src-tauri/tauri.conf.json`, meaning no CSP restrictions are enforced. This is acceptable for a local desktop app with no remote content loading, but should be tightened before any release that loads external web content.

### Capabilities (Tauri v2 permissions model)

The app uses Tauri v2's capability-based permission system. The default capability (`src-tauri/capabilities/default.json`) grants the main window:

| Permission | Purpose |
|------------|---------|
| `core:default` | Base Tauri APIs |
| `opener:default` | Open URLs in default browser (for OAuth flows) |
| `shell:default` | Shell command execution (for `gh` CLI, PTY) |
| `fs:default` | Filesystem access (project files, Claude session data) |
| `store:default` | Persistent key-value store (settings.json) |
| `core:window:allow-start-dragging` | Custom titlebar drag |
| `core:window:allow-minimize` | Window minimize |
| `core:window:allow-maximize` | Window maximize |
| `core:window:allow-unmaximize` | Window unmaximize |
| `core:window:allow-close` | Window close |

Custom Tauri commands (PTY, integrations, git) are not gated by capabilities — they are registered directly via `tauri::Builder::invoke_handler`.

### Window configuration

- `decorations: false` — custom titlebar (no native frame)
- `transparent: false`
- `resizable: true`

## Remote Run — GitHub Actions secrets

The Remote Run feature manages secrets stored in **GitHub repository Actions secrets**, not in the Windows Credential Manager. These secrets are needed by the CI workflow (Claude OAuth token, Jira/Linear credentials).

### Secret transmission

`cmd_set_repo_secret` passes the secret value exclusively via **stdin** to `gh secret set`:

```rust
let mut child = silent_command("gh")
    .args(["secret", "set", &name])   // value NOT in args
    .stdin(Stdio::piped())
    .spawn()?;
if let Some(mut stdin) = child.stdin.take() {
    let _ = stdin.write_all(value.as_bytes());
}
```

This prevents the secret from appearing in the process list, shell history, or any logging that captures command arguments.

### Secret name validation

`cmd_set_repo_secret` rejects any `name` that is not purely alphanumeric + underscores. This prevents shell-injection-style attacks where a crafted name could manipulate the `gh` command.

`cmd_trigger_remote_run` validates `issue_number` (alphanumeric + `-_`) and `issue_type` (allowlist of `"github" | "jira" | "linear"`) before passing them to the shell.

### Secret visibility

`cmd_list_repo_secrets` uses `gh secret list --json name` — GitHub's API returns **names only**. Secret values are never retrievable through any GitHub API. The modal therefore can only confirm "this secret exists", not show or compare values.

### What is stored where

| Item | Storage |
|------|---------|
| `CLAUDE_CODE_OAUTH_TOKEN` | GitHub repo secret (CI only) |
| `JIRA_API_TOKEN` | GitHub repo secret (CI only) |
| `JIRA_BASE_URL`, `JIRA_EMAIL` | GitHub repo secret (CI only) |
| `LINEAR_API_KEY` | GitHub repo secret (CI only) |
| Local Jira/Linear credentials | Windows Credential Manager (IDE use) |

The IDE's local Jira/Linear credentials in Windows Credential Manager are separate from the CI secrets. The modal only pre-fills fields from the local keyring for convenience; local credentials are never automatically pushed to GitHub.

---

## What is NOT protected

- Terminal output (xterm.js scrollback buffer) — includes any secrets the user types or that Claude outputs
- `~/.claude/` files — Claude's own session transcripts, not encrypted

## GitHub OAuth — Device Flow

The GitHub Device Flow (`cmd_github_device_flow_start` / `cmd_github_device_flow_poll`) is initiated from Rust using `reqwest`. The flow:

1. POST `https://github.com/login/device/code` → get `device_code` + `user_code`
2. Open browser to `https://github.com/login/device` (via `open` crate)
3. User enters `user_code` in browser
4. Poll `https://github.com/login/oauth/access_token` until success
5. Store token in Windows Credential Manager
6. Feed token to `gh auth login --with-token` so `gh` CLI also works

The `client_id` for the OAuth App is user-supplied (configurable in Settings → Integrations). It is not sensitive (it's a public OAuth App identifier) and is stored in `settings.json`.

## Team/task deletion — symlink safety

`cmd_delete_team` in `commands/teams.rs` deletes `~/.claude/teams/<name>` and `~/.claude/tasks/<name>`. Before deletion, `clear_readonly_recursive` walks the tree to clear read-only flags (needed on Windows where `remove_dir_all` fails on read-only files).

**Decision (2026-02-25):** `clear_readonly_recursive` uses `symlink_metadata` and explicitly skips symlinks. This ensures the function never follows a symlink into files outside the validated `.claude/teams/` or `.claude/tasks/` boundary. `std::fs::remove_dir_all` already removes symlink entries without following them, so skipping symlinks in the permission-clearing pass is both safe and correct.

Previously this function used `std::fs::metadata` and `set_permissions`, both of which follow symlinks, allowing a crafted symlink inside a team directory to mutate permissions on arbitrary external files.

## Threat model

This is a single-user desktop tool. The primary threats are:
1. **Other local processes reading settings.json** — mitigated by keeping secrets out of it
2. **Backup/sync tools uploading settings.json** — same mitigation
3. **Accidental token exposure in dotfiles sync** — same mitigation

The threat model does **not** include:
- Multi-user systems where other users might access the Credential Manager (Windows already restricts this per-user)
- Network attackers (no network-accessible surface)
