# Backend Bug Report (Rust)
Generated: 2026-02-23

## HIGH severity (potential panics/data loss)

### [hooks] - Unwrap on `settings.as_object_mut()` can panic
- **File**: src-tauri/src/commands/hooks.rs:86
- **Issue**: `settings.as_object_mut().unwrap().remove("hooks")` will panic if `settings` is somehow not a JSON object. Although `settings` is initialized as `Value::Object`, the preceding code path calls `serde_json::from_str` which could return any JSON type (e.g., if settings.json contains `null` or `[]`), and the `unwrap_or` fallback only covers parse errors, not valid-but-wrong-type JSON.
- **Impact**: Application panic during startup when `cmd_setup_hooks()` is called in `lib.rs:21`. If `~/.claude/settings.json` contains valid JSON that is not an object (e.g., `null`, `[]`, `"string"`), the unwrap will panic and crash the app.
- **Fix**: Use `.and_then(|o| o.as_object_mut())` pattern or add a check before the unwrap.

### [hooks] - Second unwrap on `settings.as_object_mut()` in `cmd_remove_hooks`
- **File**: src-tauri/src/commands/hooks.rs:211
- **Issue**: Same pattern: `settings.as_object_mut().unwrap().remove("hooks")` can panic if settings is not an object.
- **Impact**: Panic when removing hooks if settings.json has unexpected JSON type.
- **Fix**: Same as above.

### [hooks] - Empty HOME/USERPROFILE yields invalid path
- **File**: src-tauri/src/commands/hooks.rs:5-8 (and duplicated in inbox.rs:5-8, plans.rs:5-8, projects.rs:11-14, sessions.rs:8-11, tasks.rs:5-8, teams.rs:5-8, todos.rs:5-8)
- **Issue**: `get_claude_home()` falls back to `unwrap_or_default()` which returns an empty string. `PathBuf::from("").join(".claude")` produces `.claude` as a relative path, which would resolve to the current working directory.
- **Impact**: If neither `USERPROFILE` nor `HOME` is set (unusual but possible on misconfigured systems), all file operations would target a `.claude` directory relative to CWD instead of the user's home. This could silently read/write wrong data or fail in confusing ways.
- **Fix**: Return an error if neither env var is set instead of using an empty default.

### [pty] - PTY child process leaked if reader/writer acquisition fails
- **File**: src-tauri/src/commands/pty.rs:54-72
- **Issue**: `pair.slave.spawn_command(cmd)` spawns the child process at line 54. If `pair.master.take_writer()` (line 59) or `pair.master.try_clone_reader()` (line 64) fails, the `?` operator returns an error but the spawned `child` is dropped without being killed. The child process becomes orphaned.
- **Impact**: Orphaned `claude` processes that consume system resources and cannot be terminated through the IDE.
- **Fix**: Wrap in a scope or use a guard pattern to ensure `child.kill()` is called if subsequent operations fail.

### [pty] - Reader thread never detects child exit; zombie detection relies on read returning 0
- **File**: src-tauri/src/commands/pty.rs:77-119
- **Issue**: The reader thread in `pty_spawn` loops on `reader.read()` and relies on read returning `Ok(0)` or `Err` to detect exit. However, the child handle is moved into the `PtySession` stored in state, not accessible from the reader thread. If the PTY master is kept alive in state but the child exits, the reader may block indefinitely on some platforms (particularly on Windows with ConPTY where the master handle can remain open).
- **Impact**: Reader threads may hang forever after a child process exits, leaking threads.
- **Fix**: Consider monitoring the child process status in the reader thread, or use `child.wait()` in a separate thread to trigger cleanup.

### [projects] - `cmd_read_file` and `cmd_write_file` have no path validation
- **File**: src-tauri/src/commands/projects.rs:44-55
- **Issue**: `cmd_read_file` and `cmd_write_file` accept arbitrary paths from the frontend with no validation or sandboxing. Unlike `cmd_read_plan`/`cmd_save_plan` which guard against path traversal, these commands can read or write any file accessible to the process.
- **Impact**: If the frontend is compromised (e.g., XSS), an attacker could read sensitive files (credentials, private keys) or write to arbitrary locations (overwrite system files, plant malware).
- **Fix**: Add path validation to restrict operations to known project directories, or at minimum validate the path is within expected boundaries.

### [projects] - `cmd_delete_project` has no path traversal protection
- **File**: src-tauri/src/commands/projects.rs:58-65
- **Issue**: The `id` parameter is used directly in `claude_home.join("projects").join(&id)`. A malicious `id` like `../../` could escape the projects directory. `PathBuf::join` with `..` components will traverse upward.
- **Impact**: Could delete arbitrary directories on the filesystem if the frontend sends a crafted `id` parameter.
- **Fix**: Add `starts_with` check similar to `cmd_read_plan`, or sanitize the `id` to ensure it contains no path separators.

### [teams] - `cmd_delete_team` has no path traversal protection
- **File**: src-tauri/src/commands/teams.rs:19-30
- **Issue**: `team_name` is used directly in `claude_home.join("teams").join(&team_name)` and `claude_home.join("tasks").join(&team_name)`. A crafted `team_name` with `..` could escape these directories.
- **Impact**: Could delete arbitrary directories via `remove_dir_all`.
- **Fix**: Validate that the resolved path starts with the expected parent directory.

### [git] - `cmd_git_ignore` vulnerable to newline injection
- **File**: src-tauri/src/commands/git.rs:390-401
- **Issue**: The `file_path` parameter from the frontend is written directly to `.gitignore` with `writeln!`. If `file_path` contains newlines, an attacker could inject arbitrary gitignore rules.
- **Impact**: Could manipulate which files are tracked/ignored by git by injecting multi-line content.
- **Fix**: Validate that `file_path` does not contain newline characters.

## MEDIUM severity

### [inbox] - Race condition in `send_inbox_message` (read-modify-write without locking)
- **File**: src-tauri/src/data/inboxes.rs:36-84
- **Issue**: The function reads the inbox file, modifies the in-memory array, and writes it back. If two messages are sent concurrently (e.g., from different agents writing to the same inbox), one message could be lost because there is no file locking.
- **Impact**: Lost inbox messages under concurrent writes. The atomic rename at the end only prevents partial writes, not lost updates.
- **Fix**: Use file locking (e.g., `fs2::FileExt` or OS-level advisory locks) before reading.

### [watcher] - File watcher path classification uses naive string matching
- **File**: src-tauri/src/watcher/claude_watcher.rs:69-112
- **Issue**: The watcher classifies file events using `path_str.contains("teams")`, `path_str.contains("tasks")`, etc. This can misfire if the user's project path contains these strings (e.g., `C:\dev\teams-app\.claude\projects\...` would match `"teams"` and emit `team-changed` instead of `transcript-updated`).
- **Impact**: Wrong events emitted to the frontend, causing stale or incorrect UI state. The order of checks means some paths match the wrong category.
- **Fix**: Check path components more precisely, e.g., verify the segment is directly under `.claude/` rather than doing a substring search.

### [watcher] - `event.paths` could be empty, causing index-out-of-bounds
- **File**: src-tauri/src/watcher/claude_watcher.rs:87
- **Issue**: Line 62 uses `event.paths.first()` safely with `.map()`, but line 87 uses `&event.paths[0]` which will panic if `paths` is empty. Although `notify` typically provides at least one path, the `paths` vector is not guaranteed to be non-empty for all event types.
- **Impact**: Potential panic in the watcher thread, killing file watching.
- **Fix**: Use `event.paths.first()` consistently, or add a guard.

### [git] - Worktree copy silently ignores errors
- **File**: src-tauri/src/commands/git.rs:319-332
- **Issue**: In `cmd_create_worktree`, the post-creation file copy calls `fs::copy().ok()` and `copy_dir_recursive().ok()`, silently discarding all errors. If the user expects `.worktree_copy` entries to be present in the new worktree, they will be missing with no indication of failure.
- **Impact**: User gets a worktree without expected files (e.g., missing `.env` or config files) and may not realize it.
- **Fix**: Collect and report errors, or at minimum log them.

### [git] - `cmd_claude_git_action` and `cmd_git_rebase` use `--dangerously-skip-permissions`
- **File**: src-tauri/src/commands/git.rs:421, 461
- **Issue**: These commands spawn `claude -p ... --dangerously-skip-permissions`. This flag allows Claude to run arbitrary commands without user confirmation. The prompts instruct Claude to run git operations, but Claude could potentially execute other commands.
- **Impact**: Security risk - the Claude process runs with full permissions to execute arbitrary commands. If the prompt is somehow manipulated (e.g., through a crafted branch name in `cmd_git_rebase`), it could lead to command injection via the Claude CLI.
- **Fix**: Consider using direct git commands for well-defined operations (commit, push) instead of delegating to Claude with skip-permissions. For rebase conflict resolution, this may be acceptable with proper input sanitization.

### [git] - Branch name injection in `cmd_git_rebase` prompt
- **File**: src-tauri/src/commands/git.rs:410-416
- **Issue**: `onto_branch` is interpolated directly into the prompt string sent to Claude CLI. A crafted branch name like `main'; rm -rf /; echo '` could be embedded in the prompt, potentially influencing Claude's behavior.
- **Impact**: Prompt injection through branch names. While the damage is bounded by Claude's own safety filters, the `--dangerously-skip-permissions` flag means Claude won't ask for confirmation.
- **Fix**: Validate `onto_branch` to ensure it's a valid git branch name (alphanumeric, hyphens, slashes, dots only).

### [pty] - `from_utf8_lossy` may split multi-byte UTF-8 sequences at buffer boundary
- **File**: src-tauri/src/commands/pty.rs:89
- **Issue**: The read loop uses a fixed 4096-byte buffer. A multi-byte UTF-8 character (e.g., emoji, CJK character) may be split across two reads. `String::from_utf8_lossy` will replace the trailing incomplete bytes with the Unicode replacement character in the first chunk, and the leading continuation bytes in the second chunk, corrupting the text.
- **Impact**: Garbled display of non-ASCII text in the terminal. This affects text rendering in xterm.js.
- **Fix**: Use a UTF-8 aware buffering approach, or emit raw bytes instead of converting to String (xterm.js can handle raw bytes).

### [path_encoding] - `decode_dir_name` is lossy and non-reversible
- **File**: src-tauri/src/data/path_encoding.rs and src-tauri/src/data/projects.rs:172-180
- **Issue**: `encode_project_path` replaces `-` in paths with `-` (no-op), meaning paths containing hyphens encode identically to paths with path separators. `C:\dev\my-app` encodes to `C--dev-my-app`, same as `C:\dev\my\app`. The `decode_dir_name` function then decodes both to `C:/dev/my/app`, which is wrong for the hyphenated path.
- **Impact**: Projects with hyphens in their directory names will decode to incorrect paths, causing "project not found" when the session data doesn't contain the project_path field. The fallback `decode_dir_name` is only used when no session has a `project_path`, so impact is limited to projects with no sessions.
- **Fix**: Use a different encoding for hyphens in the original path (e.g., URL encoding or double-hyphen for literal hyphens). Note: this matches Claude CLI's own encoding scheme, so the IDE cannot unilaterally change it.

### [hooks] - Hook events file grows unboundedly
- **File**: src-tauri/src/commands/hooks.rs:107-111 and hook.js (line 36)
- **Issue**: `hook-events.jsonl` is only ever appended to, never truncated or rotated. Over time (weeks/months of use), this file will grow indefinitely.
- **Impact**: Increasing memory usage when parsing the file (all lines are loaded into memory), slower startup, and wasted disk space.
- **Fix**: Implement rotation or truncation (e.g., keep only last N events, or truncate on startup after reading).

### [sessions] - `message_count` uses `u32` which could theoretically overflow
- **File**: src-tauri/src/data/sessions.rs:89
- **Issue**: `message_count: u32` is incremented for each user/assistant line in the first 30 lines. While 30 iterations cannot overflow u32, if `take(30)` is ever changed to a larger number or removed, this becomes a risk. More importantly, in the `SessionEntry` model, `message_count` is `Option<u32>`, but sessions-index.json may contain counts exceeding u32 for very long sessions.
- **Impact**: Low risk currently (capped at 30 iterations), but fragile.
- **Fix**: Consider using `usize` for consistency with Rust idioms, and add overflow-safe increment.

## LOW severity / Best Practice Issues

### [lib] - `.expect()` on `tauri::Builder::run()`
- **File**: src-tauri/src/lib.rs:89
- **Issue**: `.expect("error while running tauri application")` will panic if the Tauri application fails to run. This is standard Tauri boilerplate and the only option at this level, but worth noting.
- **Impact**: The application will crash with a panic message on startup failures. This is actually the desired behavior (can't continue without the runtime).
- **Fix**: None needed - this is idiomatic.

### [pty] - `pty_resize` silently succeeds for unknown session IDs
- **File**: src-tauri/src/commands/pty.rs:131-143
- **Issue**: If `session_id` doesn't exist in the sessions map, `pty_resize` returns `Ok(())` silently. This differs from `pty_write` which returns an error for unknown sessions.
- **Impact**: Frontend may think resize succeeded when the session doesn't exist. Inconsistent API behavior.
- **Fix**: Return an error for unknown session IDs, consistent with `pty_write`.

### [git] - `cmd_git_status` parsing assumes line length >= 3
- **File**: src-tauri/src/data/git.rs:27-29
- **Issue**: Lines shorter than 3 characters are skipped with `continue`, which is correct. But for lines exactly 3 characters, `&line[3..]` would be empty, which is safe but means the path is empty string.
- **Impact**: No real bug - git porcelain format always has paths after the 3-char prefix. Defensive coding.
- **Fix**: None needed, just noting the edge case handling.

### [teams] - Recursive fallback in `load_teams` could be confusing
- **File**: src-tauri/src/data/teams.rs:72-74
- **Issue**: If `project_cwd` is `Some(...)` but no teams match, the function recursively calls itself with `None` to return all teams. This is intentional behavior but could cause confusion if the function is called rapidly (though it's not recursive in a stack-overflow sense since it recurs at most once).
- **Impact**: No bug, but the semantics (return all teams when no CWD match) could surprise callers.
- **Fix**: Document this behavior clearly.

### [plans] - Path traversal guard uses `starts_with` which may have edge cases
- **File**: src-tauri/src/commands/plans.rs:23, 35
- **Issue**: `path.starts_with(&plans_dir)` is generally correct for path prefix checking in Rust's `PathBuf`. However, it's worth noting that this relies on `join` not normalizing `..` components. `PathBuf::join("../foo")` does create a path that resolves outside, but Rust's `starts_with` compares component-by-component and correctly rejects `..` traversal. This guard is correct.
- **Impact**: None - the guard works correctly.
- **Fix**: None needed.

### [watcher] - Poll interval of 500ms may cause high CPU usage
- **File**: src-tauri/src/watcher/claude_watcher.rs:19
- **Issue**: `with_poll_interval(Duration::from_millis(500))` sets the polling interval for the file watcher. On Windows, `RecommendedWatcher` uses `ReadDirectoryChangesW` (event-based), so the poll interval is only used as a fallback. However, if the event-based watcher fails and falls back to polling, 500ms polling across 6+ directories recursively could be CPU-intensive.
- **Impact**: Potentially high CPU usage on systems where event-based watching fails.
- **Fix**: Consider a longer fallback interval (e.g., 2000ms) or ensure event-based watching is working.

### [integrations] - `set_gh_token` doesn't check child exit status for errors
- **File**: src-tauri/src/commands/integrations.rs:170-173
- **Issue**: After writing the token to stdin and calling `child.wait()`, the exit status is not checked. If `gh auth login --with-token` fails (e.g., invalid token format), the error is silently ignored.
- **Impact**: User may think GitHub auth succeeded when it actually failed at the gh CLI level.
- **Fix**: Check the exit status from `child.wait()` and return an error if non-zero.

### [integrations] - `stdin.write_all` error is silently ignored
- **File**: src-tauri/src/commands/integrations.rs:170
- **Issue**: `let _ = stdin.write_all(...)` discards write errors.
- **Impact**: If the pipe to `gh` fails, the auth will silently fail.
- **Fix**: Propagate the error.

### [git] - `last_modified` sorting uses string comparison on numeric timestamps
- **File**: src-tauri/src/data/projects.rs:91
- **Issue**: `last_modified` is `Option<String>` containing Unix timestamps as strings. String comparison of numeric strings works correctly only when all strings have the same length. Timestamps like `"9999999999"` (10 digits) would sort before `"10000000000"` (11 digits) with string comparison.
- **Impact**: Projects may be sorted incorrectly when Unix timestamps cross digit boundaries (year 2001 vs 2286+). In practice, all current timestamps are 10 digits, so this is not an immediate issue but will become one around 2286.
- **Fix**: Parse to numeric before comparison, or use a fixed-width string format.

### [git] - `cmd_git_log` silently returns empty on git failure
- **File**: src-tauri/src/commands/git.rs:50-52
- **Issue**: If `git log` fails (e.g., not a git repo, corrupted repo), the function returns `Ok(vec![])` instead of an error. The caller cannot distinguish "no commits" from "git failed".
- **Impact**: UI shows empty history without indicating an error occurred.
- **Fix**: Consider returning the error for non-zero exit status.

## Summary
- **9 HIGH** severity issues found (panics, path traversal, resource leaks, missing input validation)
- **10 MEDIUM** severity issues found (race conditions, security concerns, data corruption)
- **9 LOW** severity issues found (inconsistencies, best practice, edge cases)

### Most Critical Issues to Fix First
1. Path traversal in `cmd_delete_project` and `cmd_delete_team` (easy fix, high impact)
2. Unrestricted `cmd_read_file` / `cmd_write_file` (security boundary issue)
3. Unwrap panics in hooks.rs (can crash app on startup)
4. PTY child process leak on error (resource leak)
5. Newline injection in `cmd_git_ignore` (input validation)
