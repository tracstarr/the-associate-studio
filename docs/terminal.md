# Terminal & PTY

## How it works

```
TerminalView (React)
  +-- xterm.js Terminal instance
  +-- FitAddon -> measures container -> rows x cols
  +-- WebLinksAddon (clickable URLs)
  +-- SearchAddon (Ctrl+F search)
  +-- invoke("pty_spawn", { sessionId, resumeSessionId?, forkSession?, cwd, rows, cols })
        +-- Rust: portable_pty::native_pty_system()
        +-- pty_system.openpty(PtySize { rows, cols })
        +-- CommandBuilder::new("claude").cwd(cwd)
        +-- if resumeSessionId: cmd.args(["--resume", id])
        +-- if forkSession && resumeSessionId: cmd.arg("--fork-session")
        +-- env_remove("CLAUDECODE") <-- critical
        +-- env("TERM", "xterm-256color")
        +-- env("COLORTERM", "truecolor")
        +-- slave.spawn_command(cmd) -> child process
        +-- master.take_writer() -> stored in PtySession
        +-- master.try_clone_reader() -> reader thread
              +-- reader.read(&mut buf) loop
              +-- find_plan_filename(data) -> emit("plan-linked", { tab_id, filename })
              +-- find_claude_question(data) -> emit("claude-question", { tab_id, question })
              +-- emit("pty-data-{id}", String::from_utf8_lossy(buf))
  +-- listen("pty-data-{id}") -> term.write(payload)
  +-- listen("pty-exit-{id}") -> term.writeln("[Process exited]")
  +-- term.onData(data) -> invoke("pty_write", { sessionId, data })
        +-- session.writer.write_all(data.as_bytes())
```

## Why portable-pty (not piped stdio)

Claude Code CLI calls `isatty()` on its stdin. If stdin is a pipe (`Stdio::piped()`), `isatty()` returns false and Claude switches to `--print` mode, which requires a prompt argument and exits immediately instead of running interactively.

`portable-pty` creates a Windows **ConPTY** (Console Pseudoconsole) — the same mechanism used by Windows Terminal, VS Code's integrated terminal, and WezTerm. The spawned process sees a real TTY.

## CLAUDECODE env var

Claude Code sets `CLAUDECODE=1` in its environment. Any child process that inherits this env var and is itself `claude` will refuse to start with:

> "Claude Code cannot be launched inside another Claude Code session. To bypass this check, unset the CLAUDECODE environment variable."

**Fix**: `cmd.env_remove("CLAUDECODE")` before spawning. See `pty.rs`, inside `pty_spawn`.

All related vars are also removed for safety:
- `CLAUDE_CODE_SESSION_ID`
- `CLAUDE_SESSION_ID`
- `CLAUDE_CODE_ENTRYPOINT`
- `ANTHROPIC_CLAUDE_ENTRYPOINT`
- `CLAUDE_CODE_IS_SIDE_CHANNEL`

Two env vars are explicitly set for proper terminal behavior:
- `TERM=xterm-256color`
- `COLORTERM=truecolor`

## Session resume

`pty_spawn` accepts an optional `resume_session_id`. When provided, the Claude CLI is spawned with `--resume {id}` to continue an existing conversation.

## Session fork

`pty_spawn` accepts an optional `fork_session: bool`. When `true` (and a `resume_session_id` is also provided), the CLI is spawned with `--resume {id} --fork-session`. This creates a new independent session that branches from the history of the resumed session — the original session is not modified. The fork is wired through the UI via the `forkSession?: boolean` field on `SessionTab`, set when the user chooses "Fork into new session" from the session context menu.

## Terminal sizing

The PTY opens at the real xterm.js dimensions (not a hardcoded size):

1. `FitAddon.proposeDimensions()` is called after the terminal mounts
2. `rows` and `cols` are passed to `pty_spawn`
3. When the container resizes (ResizeObserver), `FitAddon.fit()` runs and then `invoke("pty_resize", { rows, cols })` syncs the PTY size

If PTY and xterm.js sizes diverge, Claude's UI wraps incorrectly.

## Background tab ConPTY ping

Windows ConPTY (`ResizePseudoConsole`) only fires a `WINDOW_BUFFER_SIZE_EVENT` into the child process's input queue when the size *actually changes*. Sending the same dimensions repeatedly is a silent no-op.

When a tab goes to the background, the `TerminalView` periodically toggles the PTY height by +1 row and immediately restores it (every 5 seconds). This forces two real resize events, causing enquirer.js prompts inside Claude to redraw correctly even when the tab is not visible.

## Plan detection

The PTY reader thread scans each output chunk for references to `~/.claude/plans/*.md` files. When a plan filename is found, a `plan-linked` Tauri event is emitted (once per unique filename per session):

```json
{ "tab_id": "session-uuid", "filename": "enchanted-herding-koala.md" }
```

## Question detection

The PTY reader thread scans output for interactive prompts from Claude CLI (enquirer.js `? question` style, `[Y/n]` / `(y/N)` confirmations, and selection prompts with "Enter to select" hints). When detected, a `claude-question` event is emitted to the frontend. Duplicate suppression avoids re-emitting the same question within 10 seconds.

```json
{ "tab_id": "session-uuid", "question": "Do you want to proceed?" }
```

## Tab management — never unmount

Terminals are never unmounted when switching tabs. Unmounting `TerminalView` disposes the xterm.js instance and kills the PTY process. Instead, inactive tabs are hidden with CSS (`display: none`) while the component remains mounted.

## Session ID

Each tab has a UUID `sessionId` generated at tab creation time. This ID is used as:
- The key in the Rust `HashMap<String, PtySession>`
- The Tauri event suffix: `pty-data-{sessionId}`, `pty-exit-{sessionId}`

## StrictMode and double-spawn

React Strict Mode double-invokes `useEffect` in development. This spawns two Claude processes, both writing to the same xterm.js terminal — visually duplicated output.

**Fix**: Removed `<StrictMode>` from `src/main.tsx`. A `spawnedRef` guard also exists inside `TerminalView` as a secondary safeguard.

## PtySession struct

```rust
pub struct PtySession {
    pub writer: Box<dyn Write + Send>,        // stdin to claude process
    pub master: Box<dyn MasterPty + Send>,    // for resize
    pub child: Box<dyn Child + Send + Sync>,  // for kill
}
```

The reader is detached into a background thread and not stored in the struct (it only needs to run until EOF).

## Rust commands

| Command | Description |
|---------|-------------|
| `pty_spawn` | Open PTY, spawn `claude` (with optional `--resume` and `--fork-session`), start reader thread |
| `pty_write` | Write user input to PTY stdin, flush |
| `pty_resize` | Resize PTY to new rows/cols |
| `pty_kill` | Kill child process and remove session from map |
| `pty_list` | Return list of all active session IDs |
