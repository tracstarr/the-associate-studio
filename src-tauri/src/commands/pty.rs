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

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn claude: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

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
        // Track which plan filenames have already been emitted for this session
        // so we fire plan-linked exactly once per plan (Claude's TUI redraws continuously)
        let mut emitted_plans = std::collections::HashSet::<String>::new();
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    // Detect plan file references and emit once per filename
                    if let Some(filename) = find_plan_filename(&data) {
                        if emitted_plans.insert(filename.clone()) {
                            let _ = app.emit("plan-linked", serde_json::json!({
                                "tab_id": sid,
                                "filename": filename
                            }));
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
    }
    Ok(())
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

#[tauri::command]
pub async fn pty_list(state: State<'_, PtyState>) -> Result<Vec<String>, String> {
    let sessions = state.0.lock().map_err(|e| e.to_string())?;
    Ok(sessions.keys().cloned().collect())
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
