use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use tauri::{AppHandle, Emitter, State};

pub struct PtyState(pub Arc<Mutex<HashMap<String, PtySession>>>);

pub struct PtySession {
    pub writer: Box<dyn Write + Send>,
    pub master: Box<dyn portable_pty::MasterPty + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[tauri::command]
pub async fn pty_spawn(
    session_id: String,
    resume_session_id: Option<String>,
    cwd: String,
    rows: u16,
    cols: u16,
    app_handle: AppHandle,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new("claude");
    cmd.cwd(&cwd);

    // Remove env vars that cause Claude to detect it's running nested inside another session
    cmd.env_remove("CLAUDECODE");
    cmd.env_remove("CLAUDE_CODE_SESSION_ID");
    cmd.env_remove("CLAUDE_SESSION_ID");
    cmd.env_remove("CLAUDE_CODE_ENTRYPOINT");
    cmd.env_remove("ANTHROPIC_CLAUDE_ENTRYPOINT");
    cmd.env_remove("CLAUDE_CODE_IS_SIDE_CHANNEL");

    if let Some(ref id) = resume_session_id {
        cmd.args(["--resume", id]);
    }

    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn claude: {}", e))?;

    let writer = match pair.master.take_writer() {
        Ok(w) => w,
        Err(e) => {
            let _ = child.kill();
            return Err(format!("Failed to get PTY writer: {}", e));
        }
    };

    let reader = match pair.master.try_clone_reader() {
        Ok(r) => r,
        Err(e) => {
            let _ = child.kill();
            return Err(format!("Failed to get PTY reader: {}", e));
        }
    };

    {
        let mut sessions = state.0.lock().map_err(|e| e.to_string())?;
        sessions.insert(session_id.clone(), PtySession { writer, master: pair.master, child });
    }

    // Stream PTY output to frontend as raw bytes (xterm.js handles ANSI sequences natively)
    let sid = session_id.clone();
    let app = app_handle.clone();
    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        // Carry buffer for incomplete UTF-8 sequences split across reads
        let mut carry: Vec<u8> = Vec::new();
        // Track which plan filenames have already been emitted for this session
        // so we fire plan-linked exactly once per plan (Claude's TUI redraws continuously)
        let mut emitted_plans = std::collections::HashSet::<String>::new();
        // Track last question to avoid spamming (same question across buffer reads)
        let mut last_question: Option<(String, std::time::Instant)> = None;
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    carry.extend_from_slice(&buf[..n]);
                    // Find the longest valid UTF-8 prefix
                    let valid_up_to = match std::str::from_utf8(&carry) {
                        Ok(_) => carry.len(),
                        Err(e) => {
                            let valid = e.valid_up_to();
                            // If no valid bytes and carry is getting large, drain
                            // the incomplete sequence to avoid unbounded growth
                            if valid == 0 && carry.len() >= 4 {
                                carry.clear();
                                continue;
                            }
                            valid
                        }
                    };
                    if valid_up_to == 0 {
                        // Not enough bytes yet for a valid character, wait for more
                        continue;
                    }
                    // SAFETY: we just validated that carry[..valid_up_to] is valid UTF-8
                    let data = unsafe { std::str::from_utf8_unchecked(&carry[..valid_up_to]) }.to_string();
                    // Keep the remainder (incomplete trailing bytes) for the next read
                    let remainder = carry[valid_up_to..].to_vec();
                    carry = remainder;
                    // Detect plan file references and emit once per filename
                    if let Some(filename) = find_plan_filename(&data) {
                        if emitted_plans.insert(filename.clone()) {
                            let _ = app.emit("plan-linked", serde_json::json!({
                                "tab_id": sid,
                                "filename": filename
                            }));
                        }
                    }
                    // Detect Claude CLI question prompts and notify the frontend
                    if let Some(question) = find_claude_question(&data) {
                        let should_emit = match &last_question {
                            None => true,
                            Some((prev, t)) => prev != &question || t.elapsed().as_secs() > 10,
                        };
                        if should_emit {
                            last_question = Some((question.clone(), std::time::Instant::now()));
                            app.emit("claude-question", QuestionPayload {
                                tab_id: sid.clone(),
                                question,
                            }).ok();
                        }
                    }
                    let _ = app.emit(&format!("pty-data-{}", sid), data);
                }
                Err(_) => break,
            }
        }
        let _ = app.emit(&format!("pty-exit-{}", sid), ());
    });

    Ok(())
}

#[tauri::command]
pub async fn pty_resize(
    session_id: String,
    rows: u16,
    cols: u16,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let sessions = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(session) = sessions.get(&session_id) {
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("No session with id {}", session_id))
    }
}

#[tauri::command]
pub async fn pty_write(
    session_id: String,
    data: String,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let mut sessions = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(session) = sessions.get_mut(&session_id) {
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        session.writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("Session {} not found", session_id))
    }
}

#[tauri::command]
pub async fn pty_kill(
    session_id: String,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    let mut sessions = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&session_id) {
        let _ = session.child.kill();
    }
    Ok(())
}

/// Strip ANSI escape sequences from a string.
fn strip_ansi(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            match chars.next() {
                Some('[') => { while let Some(c) = chars.next() { if c.is_ascii_alphabetic() { break; } } }
                Some(']') => { while let Some(c) = chars.next() { if c == '\x07' || c == '\\' { break; } } }
                _ => {}
            }
        } else {
            result.push(c);
        }
    }
    result
}

/// Detect Claude CLI question prompts (enquirer.js / Y/N style).
/// Returns the extracted question text if found.
fn find_claude_question(data: &str) -> Option<String> {
    let clean = strip_ansi(data);
    // Split on both \n and \r — PTY output uses \r\n and ANSI cursor codes
    // leave bare \r characters that prevent clean line matching.
    let lines: Vec<&str> = clean.split(|c: char| c == '\n' || c == '\r').collect();

    for line in &lines {
        let t = line.trim();
        // enquirer.js / inquirer style: "? question text"
        // Exclude known Claude CLI UI hint strings that share this prefix but are not questions.
        const KNOWN_UI_HINTS: &[&str] = &["for shortcuts"];
        if t.starts_with("? ") && t.len() > 2 {
            let extracted = &t[2..];
            if !KNOWN_UI_HINTS.iter().any(|hint| extracted.starts_with(hint)) {
                return Some(extracted.to_string());
            }
        }
        // Y/N confirmation prompts
        if !t.is_empty()
            && (t.ends_with("[Y/n]")
                || t.ends_with("[y/N]")
                || t.ends_with("(Y/n)")
                || t.ends_with("(y/N)"))
        {
            return Some(t.to_string());
        }
    }

    // Fallback: enquirer navigation hint is a reliable indicator of an interactive
    // selection prompt (rendered as a full-screen TUI box without a leading "? ").
    if clean.contains("Enter to select") && clean.contains("navigate") {
        // Try to find the question text — look for a line ending with "?"
        for line in &lines {
            let t = line.trim();
            if t.ends_with('?') && t.len() > 4 && !t.starts_with("Enter") {
                return Some(t.to_string());
            }
        }
        return Some("Interactive selection prompt".to_string());
    }

    None
}

#[derive(Clone, serde::Serialize)]
struct QuestionPayload {
    tab_id: String,
    question: String,
}

/// Scan a PTY output chunk for a ~/.claude/plans/*.md file reference.
/// Returns just the filename (e.g. "enchanted-herding-koala.md") when found.
fn find_plan_filename(data: &str) -> Option<String> {
    for marker in [".claude\\plans\\", ".claude/plans/"] {
        if let Some(pos) = data.find(marker) {
            let rest = &data[pos + marker.len()..];
            let end = rest
                .find(|c: char| c.is_ascii_control() || c == ' ' || c == '\'' || c == '"')
                .unwrap_or(rest.len());
            let filename = &rest[..end];
            if filename.ends_with(".md") && filename.len() > 3 {
                return Some(filename.to_string());
            }
        }
    }
    None
}
