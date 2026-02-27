# Remote Run

Remote Run lets you trigger a GitHub Actions workflow directly from any issue detail tab (GitHub, Jira, or Linear) in the IDE. Claude Code runs in the CI environment, implements the changes described in the issue, and opens a pull request automatically.

---

## Overview

```
Issue Detail Tab
  → [Remote Run] button
  → gh workflow run remote-run.yml
  → GitHub Actions: fetch issue → extract prompt → run Claude Code → commit → PR
  → Poll status every 15s → badge: Queued | In Progress | Passed | Failed
```

---

## Setup

### 1. Install the workflow

Open the **Git** sidebar view. The "Remote Run" section at the bottom shows whether `.github/workflows/remote-run.yml` is present.

Click **Install Workflow** to write the file. After installing:
- Commit and push the file to your repository (the workflow must exist on the remote before it can be triggered)
- The **Remote Run Secrets** modal opens automatically

Alternatively, run the Command Palette command: **Project → Install Remote Run Workflow** (`project.install-remote-run`).

### 2. Configure GitHub Actions secrets

The workflow requires several secrets set in your GitHub repository's **Settings → Secrets and variables → Actions**:

| Secret | Required | Purpose |
|--------|----------|---------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Always | Authenticates Claude Code in CI |
| `JIRA_API_TOKEN` | Jira issues only | Jira REST API access |
| `JIRA_BASE_URL` | Jira issues only | e.g. `https://yourcompany.atlassian.net` |
| `JIRA_EMAIL` | Jira issues only | Atlassian account email |
| `LINEAR_API_KEY` | Linear issues only | Linear GraphQL API access |
| `GITHUB_TOKEN` | Auto | Provided automatically by GitHub Actions |

The **Remote Run Secrets** modal (accessible from the Git sidebar) lets you set these secrets from inside the IDE. It:
- Lists which secrets are already configured (names only — GitHub never exposes values)
- Pre-fills Jira and Linear credentials from your local settings if available
- Sets each secret by piping the value through stdin to `gh secret set` (the value never appears as a command-line argument)

---

## Triggering a run

Open any issue detail tab. A **Remote Run** button appears in the top-right of the issue header.

- The button is disabled if `.github/workflows/remote-run.yml` is not installed
- Click the button to trigger the workflow with the current issue's identifier and type
- The button is replaced by a status badge that updates every 15 seconds

### Status badges

| Badge | Meaning |
|-------|---------|
| Queued | Workflow accepted, waiting for a runner |
| In Progress | Claude Code is executing |
| Passed | Workflow completed successfully (PR may have been created) |
| Failed | Workflow encountered an error |
| Cancelled | Run was cancelled on GitHub |

Clicking a badge opens the GitHub Actions run URL in the browser.

### Issue identifier formats

The workflow accepts any of these issue identifiers:

| Source | Example |
|--------|---------|
| GitHub | `42` |
| Linear | `LIN-456` |
| Jira | `PROJ-123` |

---

## Prompt extraction

The workflow fetches the issue body from the relevant API. It then looks for a prompt delimited by:

```
**Prompt Start**

Your instructions to Claude go here.

**Prompt End**
```

If those markers are not found, the entire issue body is used as the prompt.

This lets you keep a human-readable issue description while providing precise AI instructions in a separate section.

---

## What the workflow does

The workflow (`.github/workflows/remote-run.yml`) runs the following steps:

1. **Checkout** — full history (`fetch-depth: 0`)
2. **Setup Node 20**
3. **Fetch issue and extract prompt**
   - GitHub: uses `gh issue view`
   - Jira: calls `{JIRA_BASE_URL}/rest/api/3/issue/{id}?expand=renderedFields`, strips HTML tags
   - Linear: queries `https://api.linear.app/graphql`
   - Extracts text between `**Prompt Start**` / `**Prompt End**` markers, or uses full body
   - Writes prompt to `$GITHUB_OUTPUT` using a random hex delimiter (avoids heredoc injection)
4. **Configure git** — sets bot identity: `Remote Run <remote-run[bot]@users.noreply.github.com>`
5. **Create branch** — `remote-run/{sanitized-issue-identifier}` (lowercase, non-alphanumeric chars replaced with `-`)
6. **Run Claude Code** — via `anthropics/claude-code-action@main` with allowed tools: `Bash, View, GlobTool, GrepTool, Write, Edit, BatchTool`
7. **Commit and open PR** — stages all changes; if there are changes, commits with `feat: {issue title}`, force-pushes with `--force-with-lease`, and creates a PR. If no changes were produced, exits silently.

**Workflow permissions:** `contents: write`, `pull-requests: write`

---

## Implementation details

### Rust backend (`src-tauri/src/commands/remote_run.rs`)

| Command | Description |
|---------|-------------|
| `cmd_check_remote_run_workflow(cwd)` | Returns `true` if `.github/workflows/remote-run.yml` exists |
| `cmd_trigger_remote_run(cwd, issue_number, issue_type)` | Runs `gh workflow run remote-run.yml --field ...`; retries up to 3 times (2s apart) to resolve the run ID from `gh run list`; returns `RemoteRunResult { runId, runUrl }` |
| `cmd_get_remote_run_status(cwd, run_id)` | Runs `gh run view {id} --json status,conclusion,url`; returns `WorkflowRunStatus { status, conclusion, url }` |
| `cmd_list_repo_secrets(cwd)` | Returns secret names only via `gh secret list --json name` |
| `cmd_set_repo_secret(cwd, name, value)` | Pipes value to `gh secret set {name}` via stdin |

Input validation in `cmd_trigger_remote_run`:
- `issue_type` must be one of `"github"`, `"jira"`, `"linear"`
- `issue_number` must be non-empty and contain only alphanumeric characters, `-`, or `_`

Input validation in `cmd_set_repo_secret`:
- `name` must be non-empty and contain only alphanumeric characters or `_`

### Frontend components

| Component / hook | File | Description |
|-----------------|------|-------------|
| `useRemoteRun` | `src/components/issues/IssueDetailView.tsx` | Checks workflow existence on mount; polls status every 15s while a run is active; persists run state to tab |
| `RemoteRunControls` | `src/components/issues/IssueDetailView.tsx` | Renders the trigger button and status badge |
| Remote Run section | `src/components/git/GitStatusPanel.tsx` | Installation UI in the Git sidebar |
| `RemoteRunSecretsModal` | `src/components/git/RemoteRunSecretsModal.tsx` | Modal for configuring GitHub Actions secrets |
| `REMOTE_RUN_YAML_CONTENT` | `src/lib/remoteRunYaml.ts` | The workflow YAML as a TypeScript string constant |

### Tab state (`sessionStore`)

Run state is persisted per-tab so it survives panel switches:

```typescript
interface SessionTab {
  remoteRunId?: number;       // GitHub Actions run ID
  remoteRunUrl?: string;      // Link to the run on github.com
  remoteRunStatus?: "queued" | "in_progress" | "completed";
  remoteRunConclusion?: "success" | "failure" | "cancelled" | null;
}
```

### Idempotency

The branch is force-pushed with `--force-with-lease` on every run, so triggering Remote Run multiple times on the same issue replaces the previous branch and PR rather than accumulating new ones.

---

## Decisions

**2026-02-27 — Random heredoc delimiter for `$GITHUB_OUTPUT`**
The extracted prompt may contain arbitrary text (backticks, dollar signs, etc.). Using a static delimiter like `EOF` risks a line in the prompt body closing the heredoc early and truncating the output. A random 32-hex-character delimiter from `openssl rand -hex 16` makes early termination practically impossible. See the workflow's "Fetch issue and extract prompt" step.

**2026-02-27 — Secrets via stdin, not shell args**
`gh secret set` accepts the value on stdin. Passing the secret as a command argument would expose it in the process list and shell history. `cmd_set_repo_secret` uses `child.stdin.take()` to write the value and never includes it in the `args` array.

**2026-02-27 — Force-push with `--force-with-lease`**
Re-running the workflow for the same issue re-uses the same branch name. `--force-with-lease` ensures the push only succeeds if the remote branch matches our expectation, preventing accidental overwrite of concurrent changes from other sources while still allowing the re-run to update the branch.

**2026-02-27 — Tool restriction**
Claude Code in CI is limited to `Bash, View, GlobTool, GrepTool, Write, Edit, BatchTool`. This excludes browser, web-fetch, and other high-privilege tools that are unnecessary for code changes and would increase surface area in an automated context.
