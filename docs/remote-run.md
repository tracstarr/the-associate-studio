# Remote Run

Remote Run lets you trigger a GitHub Actions workflow directly from any issue detail tab (GitHub, Jira, or Linear) in the IDE. Claude Code runs in the CI environment, implements the changes described in the issue, and opens a pull request automatically.

**Scheduled Remote Run** extends this with an automated nightly schedule — issues labeled `scheduled-run` are processed hourly overnight without manual intervention.

---

## Overview

```
Manual:
  Issue Detail Tab
    → [Remote Run] button
    → gh workflow run remote-run.yml
    → GitHub Actions: fetch issue → extract prompt → run Claude Code → commit → PR
    → Poll status every 15s → badge: Queued | In Progress | Passed | Failed

Scheduled:
  Cron (hourly 10 PM–6 AM UTC)
    → Find open GitHub issues labeled "scheduled-run"
    → For each issue: checkout → extract prompt → run Claude Code → commit → PR
    → Runs unattended overnight via matrix strategy
```

---

## Setup

### 1. Install the workflow

Open the **Git** sidebar view. The "Remote Run" section at the bottom shows whether `.github/workflows/remote-run.yml` is present.

Click **Install Workflow** to write the file. After installing:
- Commit and push the file to your repository (the workflow must exist on the remote before it can be triggered)
- The **Remote Run Secrets** modal opens automatically

Alternatively, run the Command Palette command: **Project → Install Remote Run Workflow** (`project.install-remote-run`).

### 1b. Install the scheduled workflow (optional)

In the same "Remote Run" section, a **Scheduled** sub-section shows whether `.github/workflows/scheduled-remote-run.yml` is present.

Click **Install scheduled-remote-run.yml** to write the file. This also installs `remote-run.yml` if not already present (since both share the same secrets). After installing:
- Commit and push both workflow files
- Add the **`scheduled-run`** label to any GitHub issues you want processed overnight

Alternatively, run the Command Palette command: **Project → Install Scheduled Remote Run Workflow** (`project.install-scheduled-remote-run`).

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

## Scheduled Remote Run

The scheduled workflow (`.github/workflows/scheduled-remote-run.yml`) runs Claude Code automatically on a cron schedule for issues you've labeled.

### How it works

1. **Cron trigger** — runs every hour from 10 PM to 6 AM UTC (`0 22-23,0-6 * * *`). Also supports `workflow_dispatch` for manual testing.
2. **Find issues** — queries GitHub for open issues with the `scheduled-run` label
3. **Matrix dispatch** — creates a parallel job for each issue (up to 2 concurrent, `fail-fast: false`)
4. Each job runs the same steps as the manual Remote Run: checkout → fetch issue → extract prompt → run Claude Code → commit → open PR

### Using the scheduled workflow

1. Install both workflows (the Git sidebar installs them together)
2. Commit and push the workflow files
3. Ensure `CLAUDE_CODE_OAUTH_TOKEN` is set in your repo secrets
4. Add the **`scheduled-run`** label to any GitHub issue you want processed overnight
5. The workflow runs automatically — check the **Workflows** bottom panel tab for run history

### Customizing the schedule

Edit the `cron` expression in `.github/workflows/scheduled-remote-run.yml`. GitHub Actions cron is always UTC.

| Example cron | Schedule |
|-------------|----------|
| `0 22-23,0-6 * * *` | Every hour, 10 PM–6 AM UTC (default) |
| `0 * * * *` | Every hour, all day |
| `0 0-8 * * 1-5` | Every hour, midnight–8 AM UTC, weekdays only |
| `0 2 * * *` | Once per night at 2 AM UTC |

### Idempotency

Each issue gets a branch named `remote-run/{issue-number}`. If a PR already exists for that branch, the scheduled run pushes updates to it rather than creating a duplicate PR.

### Scope

The scheduled workflow currently supports **GitHub issues only** (since it uses GitHub's label query). Jira and Linear issues can be triggered manually via the issue detail tab's Remote Run button.

---

## Implementation details

### Rust backend (`src-tauri/src/commands/remote_run.rs`)

| Command | Description |
|---------|-------------|
| `cmd_check_remote_run_workflow(cwd)` | Returns `true` if `.github/workflows/remote-run.yml` exists |
| `cmd_check_scheduled_workflow(cwd)` | Returns `true` if `.github/workflows/scheduled-remote-run.yml` exists |
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
| Remote Run section | `src/components/git/GitStatusPanel.tsx` | Installation UI for both manual and scheduled workflows in the Git sidebar |
| `RemoteRunSecretsModal` | `src/components/git/RemoteRunSecretsModal.tsx` | Modal for configuring GitHub Actions secrets |
| `REMOTE_RUN_YAML_CONTENT` | `src/lib/remoteRunYaml.ts` | The manual workflow YAML as a TypeScript string constant |
| `SCHEDULED_REMOTE_RUN_YAML_CONTENT` | `src/lib/scheduledRemoteRunYaml.ts` | The scheduled workflow YAML as a TypeScript string constant |

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

**2026-02-27 — Separate scheduled workflow instead of modifying remote-run.yml**
The scheduled workflow is a separate file (`scheduled-remote-run.yml`) rather than adding a `schedule` trigger to the existing `remote-run.yml`. This keeps the manual workflow simple, avoids conditional logic for handling cron vs dispatch inputs, and allows users to opt in to scheduling independently. The scheduled workflow uses a matrix strategy to process multiple labeled issues in parallel.

**2026-02-27 — GitHub label approach for scheduling**
The scheduled workflow uses GitHub issue labels (`scheduled-run`) rather than a config file to determine which issues to process. Labels are native to GitHub, visible in the UI, and can be added/removed without commits. This limits scheduling to GitHub issues only (not Jira/Linear), but that's the natural fit since the workflow lives in GitHub Actions.

**2026-02-27 — Matrix strategy with max-parallel: 2 and fail-fast: false**
Each scheduled issue runs in its own matrix job to get isolated Claude Code execution. `max-parallel: 2` prevents overwhelming the runner pool. `fail-fast: false` ensures one failing issue doesn't cancel the others.

**2026-02-27 — Skip PR creation if one already exists**
The scheduled workflow checks for an existing PR on the branch before calling `gh pr create`. Since the workflow may run multiple times for the same issue (hourly), this prevents duplicate PR errors. Updates are pushed to the existing branch via `--force-with-lease`.
