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

// Issue creation
Command::new("gh").args(["issue", "create", "--title", "...", "--body", "...", "--json", "number,url,title"])
```

### Issue creation

`cmd_create_github_issue(cwd, title, body)` runs `gh issue create` in the project working directory. Returns an `IssueRef` with `provider: "github"` and `key` set to the issue number. Available from both the Notes editor ("+ Create issue") and the Issues tab ("+ New" button) via the shared `CreateIssueModal` component.

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

### Issue listing

`cmd_list_linear_issues(state)` queries the Linear GraphQL API for the authenticated user's issues. The `state` parameter maps to Linear state types:

| state | Linear filter |
|-------|--------------|
| `"open"` | `triage`, `backlog`, `unstarted`, `started` |
| `"closed"` | `completed`, `cancelled` |
| other | No filter (all issues) |

Returns up to 50 issues ordered by `updatedAt`. Each issue is mapped to the shared `Issue` struct with `source: "linear"` and `identifier` set to the Linear issue ID (e.g., `ENG-123`). `number` is set to 0 (not applicable for Linear). GraphQL-level errors (HTTP 200 with `errors` array) are detected and propagated.

The Issues panel (`IssueListPanel`) merges GitHub and Linear issues into a single list, distinguished by the `source` field. Linear issues are only fetched when a Linear API key is configured (checked via `hasKey` in the TanStack Query cache key).

### Issue creation

`cmd_create_linear_issue(title, body, team_id)` sends a GraphQL `issueCreate` mutation. The `CreateIssueModal` fetches available teams via `cmd_get_linear_teams` to populate a team selector. Returns an `IssueRef` with `provider: "linear"` and `key` set to the Linear identifier (e.g., `ENG-123`).

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

### Issue creation

`cmd_create_jira_issue(base_url, email, api_token, title, body, project_key, issue_type)` creates an issue via the Jira REST API (`POST /rest/api/3/issue`). The `CreateIssueModal` fetches available projects via `cmd_get_jira_projects` and offers issue type selection (Task, Story, Bug, Subtask). Returns an `IssueRef` with `provider: "jira"` and `key` set to the Jira issue key (e.g., `PROJ-123`).

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

## Remote Run — GitHub Actions secrets

The Remote Run feature requires secrets to be set in the GitHub repository's **Settings → Secrets and variables → Actions**. The IDE provides a **Remote Run Secrets** modal (opened automatically after workflow installation, or from the Git sidebar) to configure them from inside the IDE.

### How secrets are set

`cmd_set_repo_secret` pipes the secret value to `gh secret set {name}` via **stdin**. The value never appears as a command-line argument, preventing exposure in the process list.

```rust
// src-tauri/src/commands/remote_run.rs
let mut child = silent_command("gh")
    .args(["secret", "set", &name])
    .stdin(Stdio::piped())
    .spawn()?;
if let Some(mut stdin) = child.stdin.take() {
    let _ = stdin.write_all(value.as_bytes());
}
```

`cmd_list_repo_secrets` returns secret **names only** via `gh secret list --json name`. GitHub never exposes secret values through its API.

### Required secrets

| Secret | Integration |
|--------|-------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Always required |
| `JIRA_API_TOKEN` | Jira issues |
| `JIRA_BASE_URL` | Jira issues |
| `JIRA_EMAIL` | Jira issues |
| `LINEAR_API_KEY` | Linear issues |

`GITHUB_TOKEN` is provided automatically by GitHub Actions — no setup needed.

### Modal behaviour

The `RemoteRunSecretsModal` component:
- Loads existing secret names from `cmd_list_repo_secrets` on open
- Shows "Already set" for any secret already present; default is to skip those unless the user checks "Overwrite"
- Pre-fills Jira/Linear fields from local `settingsStore` credentials when available
- Sets secrets individually and shows per-secret success/error feedback

---

## Adding a new integration

1. Add auth commands to `src-tauri/src/commands/integrations.rs`
2. Add a keyring key (e.g., `the-associate-studio / my-service-token`)
3. Add `cmd_load_integration_secrets` to return the new secret
4. Register all new commands in `src-tauri/src/lib.rs`
5. Add fields to `settingsStore.ts` (token in-memory only, config in `persistConfig`)
6. Add a section component in `SettingsPanel.tsx`
7. **Update `docs/integrations.md`** with the new integration's auth flow and storage details
