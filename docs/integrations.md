# Integrations

## GitHub

### Authentication methods

Two methods are offered in Settings -> Integrations -> GitHub:

**1. Device OAuth (recommended)**
Uses the [GitHub Device Authorization Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow), designed for CLI/desktop apps without a redirect URI.

Flow:
1. User provides their GitHub OAuth App **Client ID**
2. App POSTs to `https://github.com/login/device/code` -> gets `user_code` + `device_code`
3. App opens `https://github.com/login/device` in system browser
4. UI displays the `user_code` (e.g., `A3F5-K2PQ`) for the user to type in the browser
5. App polls `https://github.com/login/oauth/access_token` every `interval+1` seconds
6. On success: token stored in Windows Credential Manager + fed to `gh auth login --with-token`

Required OAuth App scopes: `repo read:org`

**Setting up a GitHub OAuth App** (one-time):
- Go to `github.com/Settings -> Developer Settings -> OAuth Apps -> New OAuth App`
- Enable "Device Flow" checkbox
- Copy the Client ID into Settings -> Integrations

**2. Personal Access Token**
User creates a PAT at `github.com/Settings -> Developer Settings -> Personal access tokens` with `repo` and `read:org` scopes, pastes it into the settings field.

PAT is stored in Windows Credential Manager and fed to `gh auth login --with-token`.

### gh CLI integration

Both auth methods configure the `gh` CLI tool. After authentication, all `gh` CLI commands work without additional setup:

```rust
// Used in issues.rs for PR/Issue listing
Command::new("gh").args(["pr", "list", "--json", "..."])
Command::new("gh").args(["issue", "list", "--json", "..."])
```

### Token storage

- **Keyring**: service `the-associate-studio`, key `github-token`
- **In-memory**: `settingsStore.githubToken`
- **settings.json**: `githubClientId` only (not sensitive)

### Status check

`cmd_github_auth_status` runs `gh auth status` and parses the output for "Logged in" and "account {username}". This reflects the real `gh` CLI state, not just what's in the keyring.

### Logout

`cmd_github_logout` deletes the keyring entry and runs `gh auth logout --hostname github.com`.

---

## Linear

### Authentication

Linear uses **personal API keys** (not OAuth). Users create one at `linear.app/settings/api`.

Key format: `lin_api_...`

On connect, `cmd_linear_verify_key` calls:
```
POST https://api.linear.app/graphql
Authorization: {api_key}
{"query": "{ viewer { name } }"}
```

If the response contains a display name, the key is valid and stored in Windows Credential Manager.

### Token storage

- **Keyring**: service `the-associate-studio`, key `linear-api-key`
- **In-memory**: `settingsStore.linearApiKey`

### Logout

`cmd_linear_logout` deletes the keyring entry.

### Usage

The Linear API key is available in-memory for the Issues panel (`IssueListPanel`) to query Linear issues. Implementation in `src-tauri/src/commands/issues.rs`.

---

## Jira

### Authentication

Jira Cloud uses **API tokens** (not passwords). Users create one at:
`id.atlassian.net/manage-profile/security/api-tokens`

Three fields required:
- **Base URL**: `https://yourcompany.atlassian.net`
- **Email**: The Atlassian account email
- **API Token**: The generated token

Authentication is Basic Auth: `email:api_token` base64-encoded.

On connect, `cmd_jira_verify_token` calls:
```
GET {base_url}/rest/api/3/myself
Authorization: Basic base64(email:token)
```

If the response includes a `displayName`, credentials are valid.

### Token storage

- **Keyring**: service `the-associate-studio`, key `jira-api-token` (token only)
- **settings.json**: `jiraBaseUrl` + `jiraEmail` (not sensitive)
- **In-memory**: `settingsStore.jiraApiToken`, `settingsStore.jiraBaseUrl`, `settingsStore.jiraEmail`

### Logout

`cmd_jira_logout` deletes the keyring entry.

### Why not Jira OAuth?

Jira's OAuth 2.0 (3LO) requires a redirect URI — it cannot use device flow. Supporting it would require either:
- A local HTTP server to catch the redirect
- A custom URL scheme registered with the OS

API tokens are simpler, universally supported, and what the majority of Jira integrations use (Postman, Insomnia, most CLI tools).

---

## Claude CLI Hooks (session tracking)

The IDE integrates with Claude CLI's hook system to track live session state.

### How it works

Claude CLI supports lifecycle hooks that fire JSON payloads to stdin of a configured command.
The IDE writes a Node.js script (`~/.claude/theassociate/hook.js`) and registers it for 5 hook events
via `~/.claude/settings.json`. Setup runs automatically on IDE launch (idempotent).

### Hook configuration

`cmd_setup_hooks` (Rust) writes `hook.js` then merges into `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart":  [{ "hooks": [{ "type": "command", "command": "node C:/Users/Keith/.claude/theassociate/hook.js" }] }],
    "SessionEnd":    [{ "hooks": [{ "type": "command", "command": "node C:/Users/Keith/.claude/theassociate/hook.js" }] }],
    "SubagentStart": [{ "hooks": [{ "type": "command", "command": "node C:/Users/Keith/.claude/theassociate/hook.js" }] }],
    "SubagentStop":  [{ "hooks": [{ "type": "command", "command": "node C:/Users/Keith/.claude/theassociate/hook.js" }] }],
    "Stop":          [{ "hooks": [{ "type": "command", "command": "node C:/Users/Keith/.claude/theassociate/hook.js" }] }]
  }
}
```

`hook.js` reads stdin and appends the JSON line to `~/.claude/theassociate/hook-events.jsonl`.

### Why Node.js script file (not inline PowerShell)

**Critical Windows gotcha**: Claude CLI invokes hooks via `cmd.exe /d /s /c "COMMAND"`.
With `/s /c`, cmd.exe strips the outermost quotes and treats the rest as a command.
Any inner double-quote in COMMAND terminates the string early.

This means `powershell -Command "$d=..."` silently does nothing — PowerShell receives
an empty `-Command` argument. The hook fires and exits without reading stdin.

Using a Node.js script file (`node /absolute/path/hook.js`) has no inner quotes and
works reliably. Node.js is always available since Claude CLI requires it.

### Migration from `.claude/ide/` to `.claude/theassociate/`

`cmd_setup_hooks` includes migration logic: it detects and removes stale hook entries that reference the old `~/.claude/ide/hook.js` path, cleans up empty arrays/objects, and deletes the old `~/.claude/ide/` directory. `cmd_remove_hooks` also handles both paths.

### Merge strategy

`cmd_setup_hooks` does a **targeted merge** — it appends to existing hook event arrays only if our command isn't already present. Other settings and other hook events are preserved. `cmd_remove_hooks` strips only the IDE-owned hook entries (both `theassociate` and stale `ide` paths), leaves others intact, and removes the `hooks` key entirely if it becomes empty.

### Rust commands

| Command | Description |
|---------|-------------|
| `cmd_setup_hooks` | Creates `~/.claude/theassociate/`, writes `hook.js`, installs 5 hook entries in settings.json (migrates old `ide/` path) |
| `cmd_remove_hooks` | Removes IDE hook entries from settings.json (both `theassociate` and `ide` paths), cleans up old `ide/` dir |
| `cmd_get_active_sessions` | Reads `~/.claude/theassociate/hook-events.jsonl`, returns current `Vec<ActiveSession>` |
| `cmd_hooks_configured` | Checks if SessionStart hook entry is present in settings.json (for `theassociate` path) |

### UI

Settings -> Session tab -> "Enable hooks" / "Remove hooks" buttons.
Sessions list shows green pulsing dot for live sessions and N badge for active subagents.
TeamsPanel and InboxPanel filter teams by `leadSessionId` matching the active tab's resolved session.

---

## Keyring details

All integration secrets use the Windows Credential Manager via the `keyring` crate. The service name is `the-associate-studio` for all entries:

| Integration | Keyring key |
|-------------|-------------|
| GitHub | `github-token` |
| Linear | `linear-api-key` |
| Jira | `jira-api-token` |

On startup, `cmd_load_integration_secrets` reads all three keys at once and returns them to the frontend.

---

## Adding a new integration

1. Add auth commands to `src-tauri/src/commands/integrations.rs`
2. Add a keyring key (e.g., `the-associate-studio / my-service-token`)
3. Add `cmd_load_integration_secrets` to return the new secret
4. Register all new commands in `src-tauri/src/lib.rs`
5. Add fields to `settingsStore.ts` (token in-memory only, config in `persistConfig`)
6. Add a section component in `SettingsPanel.tsx`
7. **Update `docs/integrations.md`** with the new integration's auth flow and storage details
