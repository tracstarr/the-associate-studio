use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Emitter;

#[derive(Debug, Clone, serde::Serialize)]
pub struct GitBranchPayload {
    pub cwd: String,
    pub branch: String,
}

/// Holds the active git HEAD watcher so it can be replaced when the project changes.
struct GitWatcherInner {
    _watcher: RecommendedWatcher,
    _cwd: String,
}

pub struct GitWatcherState(pub Arc<Mutex<Option<GitWatcherInner>>>);

impl GitWatcherState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
}

/// Read the current branch from the HEAD file inside the given git directory.
fn read_head_branch(git_dir: &PathBuf) -> Option<String> {
    let head_path = git_dir.join("HEAD");
    let content = std::fs::read_to_string(&head_path).ok()?;
    let trimmed = content.trim();
    if let Some(ref_name) = trimmed.strip_prefix("ref: refs/heads/") {
        Some(ref_name.to_string())
    } else if !trimmed.is_empty() {
        // Detached HEAD — return short SHA
        Some(trimmed.chars().take(8).collect())
    } else {
        None
    }
}

/// Start watching `.git/HEAD` for the given project directory.
/// Replaces any existing watcher.  Emits `"git-branch-changed"` when the
/// branch changes.
pub fn start_git_head_watch(
    app_handle: tauri::AppHandle,
    cwd: String,
    state: &GitWatcherState,
) -> Result<(), String> {
    // Drop the previous watcher (stops its thread)
    if let Ok(mut guard) = state.0.lock() {
        *guard = None;
    }

    // Resolve the actual git directory (handles worktrees transparently)
    let repo = git2::Repository::discover(&cwd)
        .map_err(|e| format!("Not a git repository: {}", e))?;
    let git_dir = repo.path().to_path_buf();

    let initial_branch = read_head_branch(&git_dir).unwrap_or_default();

    let (tx, rx) = std::sync::mpsc::channel();
    let mut watcher = RecommendedWatcher::new(
        tx,
        Config::default().with_poll_interval(Duration::from_millis(500)),
    )
    .map_err(|e| format!("Failed to create git watcher: {}", e))?;

    // Watch the git directory (non-recursive) so we catch HEAD changes even
    // when git performs atomic rename operations.
    watcher
        .watch(&git_dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch git dir: {}", e))?;

    let cwd_for_thread = cwd.clone();
    let git_dir_for_thread = git_dir.clone();

    std::thread::spawn(move || {
        let mut last_branch = initial_branch;
        // Small debounce: collapse rapid successive events
        let debounce = Duration::from_millis(100);

        for result in &rx {
            if result.is_err() {
                continue;
            }

            // Drain any queued events within the debounce window
            std::thread::sleep(debounce);
            while rx.try_recv().is_ok() {}

            if let Some(current) = read_head_branch(&git_dir_for_thread) {
                if current != last_branch {
                    last_branch = current.clone();
                    let payload = GitBranchPayload {
                        cwd: cwd_for_thread.clone(),
                        branch: current,
                    };
                    let _ = app_handle.emit("git-branch-changed", &payload);
                }
            }
        }
    });

    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(GitWatcherInner {
            _watcher: watcher,
            _cwd: cwd,
        });
    }

    Ok(())
}
