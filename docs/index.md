# Claude IDE — Documentation Index

> Start here. Each doc covers one concern in depth. Read only what you need.

## Core

| Doc | What it covers |
|-----|----------------|
| [Architecture](architecture.md) | System design, component tree, data flow, regions |
| [Tech Stack](tech-stack.md) | Every library/crate chosen, with rationale and alternatives rejected |
| [Build Setup](build.md) | Toolchain, PATH requirements, build commands, known issues |

## Implementation

| Doc | What it covers |
|-----|----------------|
| [Terminal & PTY](terminal.md) | How Claude CLI is spawned, ConPTY, xterm.js wiring, resize |
| [Data Formats](data-formats.md) | `~/.claude/` file layout, path encoding, session JSONL, teams JSON |
| [Integrations](integrations.md) | GitHub OAuth device flow, Linear API key, Jira token, `gh` CLI wiring |
| [Remote Run](remote-run.md) | GitHub Actions workflow triggered from issue tabs; prompt extraction, secrets setup, status polling |

## Design

| Doc | What it covers |
|-----|----------------|
| [Security](security.md) | Secret storage (Windows Credential Manager), what goes where and why |
| [Theming](theming.md) | Color system, CSS variables, Tailwind v4 CSS-first setup |
| [Keybindings](keybindings.md) | Full keybinding reference, how the system is wired |

## Decision log

Significant decisions with their rationale are captured at the bottom of each relevant doc under a **Decisions** section. For a quick summary of all non-obvious choices, see [Tech Stack → Decision Log](tech-stack.md#decision-log).

## Research (pre-build reference)

| Doc | What it covers |
|-----|----------------|
| [Architecture Spec](research/ARCHITECTURE-SPEC.md) | Original locked architecture plan (tech stack tables, color system, memory budget, phases) |
| [Architecture Draft](research/ARCHITECTURE-DRAFT.md) | Early architecture draft from research phase |
| [CLI Integration](research/cli-integration.md) | Claude Code CLI command reference, flags, session/resume behavior |
| [Tech Stack Research](research/tech-stack.md) | Pre-build library evaluation and alternatives considered |
| [UX Design](research/ux-design.md) | UX spec: layout regions, interaction patterns, VS Code / Zed / JetBrains influences |
| [Data Formats Research](research/data-formats.md) | `~/.claude/` deep-dive: all JSON schemas, JSONL formats, path encoding rules |
