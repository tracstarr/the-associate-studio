use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::time::Duration;
use tauri::Emitter;

fn get_claude_home() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .unwrap_or_else(|_| std::env::var("HOME").unwrap_or_default());
    PathBuf::from(home).join(".claude")
}

pub fn start_claude_watcher(app_handle: tauri::AppHandle) {
    let claude_home = get_claude_home();

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
                    let path_str = event
                        .paths
                        .first()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default();

                    // Classify by path and emit targeted events
                    if path_str.contains("teams") && path_str.contains("inboxes") {
                        let _ = app_handle.emit("inbox-changed", &path_str);
                    } else if path_str.contains("teams") {
                        let _ = app_handle.emit("team-changed", &path_str);
                    } else if path_str.contains("tasks") {
                        let _ = app_handle.emit("task-changed", &path_str);
                    } else if path_str.contains("projects") && path_str.ends_with(".jsonl") {
                        let _ = app_handle.emit("transcript-updated", &path_str);
                    } else if path_str.contains("projects")
                        && path_str.ends_with("sessions-index.json")
                    {
                        let _ = app_handle.emit("session-changed", &path_str);
                    } else if path_str.contains("todos") {
                        let _ = app_handle.emit("todos-changed", &path_str);
                    } else if path_str.contains("plans") {
                        let _ = app_handle.emit("plans-changed", &path_str);
                    } else if path_str.contains("hook-events.jsonl") {
                        use std::io::{Read, Seek, SeekFrom};
                        let path = &event.paths[0];
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
