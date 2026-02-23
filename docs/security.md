# Security

## Secret storage

Sensitive credentials are **never** written to disk in plain text. They are stored in the Windows Credential Manager via the `keyring` crate.

| Secret | Keyring key | What it unlocks |
|--------|-------------|-----------------|
| GitHub token | `claude-ide / github-token` | GitHub API + gh CLI |
| Linear API key | `claude-ide / linear-api-key` | Linear GraphQL API |
| Jira API token | `claude-ide / jira-api-token` | Jira REST API |

### What goes where

| Data | Storage | Reason |
|------|---------|--------|
| API tokens / OAuth tokens | Windows Credential Manager | Encrypted with DPAPI, tied to user login |
| GitHub OAuth client ID | `settings.json` | Not sensitive — public identifier |
| Jira base URL + email | `settings.json` | Not sensitive — account metadata |
| Font size / family | `settings.json` | Preference data |

### settings.json location

`%APPDATA%\com.claude-ide\settings.json` (managed by `tauri-plugin-store`).

This file is intentionally free of secrets. If it is read by any process, no credentials are exposed.

## Windows Credential Manager

Credentials stored under the service name `claude-ide` are visible in:

**Control Panel → Credential Manager → Windows Credentials**

They are DPAPI-encrypted, meaning they can only be decrypted by the same Windows user account on the same machine (or with the user's domain roaming profile). This is the same mechanism used by:
- Git Credential Manager
- VS Code secret storage
- Azure CLI

## keyring crate API used

```rust
// Store
keyring::Entry::new("claude-ide", "github-token")?.set_password(&token)?;

// Retrieve
keyring::Entry::new("claude-ide", "github-token")?.get_password()?;

// Delete (on disconnect)
keyring::Entry::new("claude-ide", "github-token")?.delete_credential()?;
```

## In-memory token lifetime

On startup, `cmd_load_integration_secrets` reads all three tokens from keyring and hydrates `settingsStore` in memory. Tokens live in React component state only — they are never serialized back to disk by the frontend.

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

## Threat model

This is a single-user desktop tool. The primary threats are:
1. **Other local processes reading settings.json** — mitigated by keeping secrets out of it
2. **Backup/sync tools uploading settings.json** — same mitigation
3. **Accidental token exposure in dotfiles sync** — same mitigation

The threat model does **not** include:
- Multi-user systems where other users might access the Credential Manager (Windows already restricts this per-user)
- Network attackers (no network-accessible surface)
