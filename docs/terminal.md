# Terminal & PTY

## How it works

```
TerminalView (React)
  └─ xterm.js Terminal instance
  └─ FitAddon → measures container → rows × cols
  └─ invoke("pty_spawn", { sessionId, cwd, rows, cols })
        └─ Rust: portable_pty::native_pty_system()
        └─ pty_system.openpty(PtySize { rows, cols })
        └─ CommandBuilder::new("claude").cwd(cwd)
        └─ env_remove("CLAUDECODE") ← critical
        └─ slave.spawn_command(cmd) → child process
        └─ master.take_writer() → stored in PtySession
        └─ master.try_clone_reader() → reader thread
              └─ reader.read(&mut buf) loop
              └─ emit("pty-data-{id}", String::from_utf8_lossy(buf))
  └─ listen("pty-data-{id}") → term.write(payload)
  └─ term.onData(data) → invoke("pty_write", { sessionId, data })
        └─ session.writer.write_all(data.as_bytes())
```

## Why portable-pty (not piped stdio)

Claude Code CLI calls `isatty()` on its stdin. If stdin is a pipe (`Stdio::piped()`), `isatty()` returns false and Claude switches to `--print` mode, which requires a prompt argument and exits immediately instead of running interactively.

`portable-pty` creates a Windows **ConPTY** (Console Pseudoconsole) — the same mechanism used by Windows Terminal, VS Code's integrated terminal, and WezTerm. The spawned process sees a real TTY.

## CLAUDECODE env var

Claude Code sets `CLAUDECODE=1` in its environment. Any child process that inherits this env var and is itself `claude` will refuse to start with:

> "Claude Code cannot be launched inside another Claude Code session. To bypass this check, unset the CLAUDECODE environment variable."

**Fix**: `cmd.env_remove("CLAUDECODE")` before spawning. See `pty.rs:28`.

All related vars are also removed for safety:
- `CLAUDE_CODE_SESSION_ID`
- `CLAUDE_SESSION_ID`
- `CLAUDE_CODE_ENTRYPOINT`
- `ANTHROPIC_CLAUDE_ENTRYPOINT`
- `CLAUDE_CODE_IS_SIDE_CHANNEL`

## Terminal sizing

The PTY opens at the real xterm.js dimensions (not a hardcoded size):

1. `FitAddon.proposeDimensions()` is called after the terminal mounts
2. `rows` and `cols` are passed to `pty_spawn`
3. When the container resizes (ResizeObserver), `FitAddon.fit()` runs and then `invoke("pty_resize", { rows, cols })` syncs the PTY size

If PTY and xterm.js sizes diverge, Claude's UI wraps incorrectly.

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
