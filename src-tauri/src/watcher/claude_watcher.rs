use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Component, PathBuf};
use std::time::Duration;
use tauri::Emitter;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct SummaryPayload {
    pub session_id: String,
    pub project_path: String,
    pub project_dir: String,  // encoded dir name under ~/.claude/projects/
    pub filename: String,
    pub preview: String,
}

/// Check whether the given path has a specific directory name as a direct child
/// of the `.claude` home directory.  For example, for `segment = "teams"` this
/// matches `~/.claude/teams/…` but NOT `~/.claude/projects/foo/teams`.
fn is_claude_child(path: &std::path::Path, segment: &str) -> bool {
    let mut components = path.components().peekable();
    while let Some(c) = components.next() {
        if c == Component::Normal(".claude".as_ref()) {
            // The very next component must be `segment`
            return components.next() == Some(Component::Normal(segment.as_ref()));
        }
    }
    false
}

fn get_claude_home() -> Option<PathBuf> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()
        .filter(|h| !h.is_empty())?;
    Some(PathBuf::from(home).join(".claude"))
}

pub fn start_claude_watcher(app_handle: tauri::AppHandle) {
    let claude_home = match get_claude_home() {
        Some(p) => p,
        None => {
            eprintln!("Cannot start claude watcher: neither USERPROFILE nor HOME is set");
            return;
        }
    };

    let (tx, rx) = std::sync::mpsc::channel();

    let mut watcher = match RecommendedWatcher::new(
        tx,
        Config::default().with_poll_interval(Duration::from_millis(500)),
    ) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to create file watcher: {:?}", e);
            return;
        }
    };

    // Watch key paths (ignore errors if dirs don't exist yet)
    let teams_dir = claude_home.join("teams");
    let tasks_dir = claude_home.join("tasks");
    let projects_dir = claude_home.join("projects");
    let todos_dir = claude_home.join("todos");
    let plans_dir = claude_home.join("plans");

    watcher
        .watch(&teams_dir, RecursiveMode::Recursive)
        .ok();
    watcher
        .watch(&tasks_dir, RecursiveMode::Recursive)
        .ok();
    watcher
        .watch(&projects_dir, RecursiveMode::Recursive)
        .ok();
    watcher
        .watch(&todos_dir, RecursiveMode::NonRecursive)
        .ok();
    watcher
        .watch(&plans_dir, RecursiveMode::NonRecursive)
        .ok();

    let ide_dir = claude_home.join("theassociate");
    watcher
        .watch(&ide_dir, RecursiveMode::NonRecursive)
        .ok();

    std::thread::spawn(move || {
        let _watcher = watcher; // Keep alive
        let mut last_hook_offset: u64 = 0;
        for result in rx {
            match result {
                Ok(event) => {
                    let path = match event.paths.first() {
                        Some(p) => p,
                        None => continue,
                    };
                    let path_str = path.to_string_lossy().to_string();

                    // Classify by path component (direct child of .claude/) and emit targeted events
                    if is_claude_child(path, "teams") && path_str.contains("inboxes") {
                        let _ = app_handle.emit("inbox-changed", &path_str);
                    } else if is_claude_child(path, "teams") {
                        let _ = app_handle.emit("team-changed", &path_str);
                    } else if is_claude_child(path, "tasks") {
                        let _ = app_handle.emit("task-changed", &path_str);
                    } else if is_claude_child(path, "projects") && path_str.ends_with(".jsonl") {
                        let _ = app_handle.emit("transcript-updated", &path_str);
                    } else if is_claude_child(path, "projects")
                        && path_str.ends_with("sessions-index.json")
                    {
                        let _ = app_handle.emit("session-changed", &path_str);
                    } else if is_claude_child(path, "todos") {
                        let _ = app_handle.emit("todos-changed", &path_str);
                    } else if is_claude_child(path, "plans") {
                        let _ = app_handle.emit("plans-changed", &path_str);
                    } else if path_str.contains("hook-events.jsonl") {
                        use std::io::{Read, Seek, SeekFrom};
                        if let Ok(mut file) = std::fs::File::open(path) {
                            if let Ok(file_len) = file.seek(SeekFrom::End(0)) {
                                if file_len > last_hook_offset {
                                    file.seek(SeekFrom::Start(last_hook_offset)).ok();
                                    let mut buf = String::new();
                                    file.read_to_string(&mut buf).ok();
                                    last_hook_offset = file_len;
                                    for line in buf.lines() {
                                        let line = line.trim();
                                        if line.is_empty() {
                                            continue;
                                        }
                                        if let Ok(hook_event) = serde_json::from_str::<
                                            crate::models::hook_event::HookEvent,
                                        >(
                                            line
                                        ) {
                                            // Detect completion summary on Stop events
                                            if hook_event.hook_event_name == "Stop" {
                                                if let Some(ref msg) = hook_event.last_assistant_message {
                                                    if crate::data::summaries::is_completion_summary(msg) {
                                                        if let Some(ref cwd) = hook_event.cwd {
                                                            let claude_home = get_claude_home();
                                                            if let Some(home) = claude_home {
                                                                let encoded = crate::data::path_encoding::encode_project_path(
                                                                    &std::path::PathBuf::from(cwd)
                                                                );
                                                                let sessions_dir = home.join("projects").join(&encoded);
                                                                match crate::data::summaries::save_summary(
                                                                    &sessions_dir,
                                                                    &hook_event.session_id,
                                                                    msg,
                                                                ) {
                                                                    Ok(filename) => {
                                                                        let preview: String = msg.chars().take(200).collect();
                                                                        let payload = SummaryPayload {
                                                                            session_id: hook_event.session_id.clone(),
                                                                            project_path: cwd.clone(),
                                                                            project_dir: encoded,
                                                                            filename,
                                                                            preview,
                                                                        };
                                                                        let _ = app_handle.emit("session-summary", &payload);
                                                                    }
                                                                    Err(e) => {
                                                                        eprintln!("[watcher] failed to save summary: {}", e);
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            let _ =
                                                app_handle.emit("hook-event", &hook_event);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => eprintln!("Watch error: {:?}", e),
            }
        }
    });
}
