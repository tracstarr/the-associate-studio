use crate::data::teams::load_teams;
use crate::models::team::Team;
use std::path::{Path, PathBuf};

fn get_claude_home() -> Result<PathBuf, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Neither USERPROFILE nor HOME environment variable is set".to_string())?;
    if home.is_empty() {
        return Err("Home directory environment variable is empty".to_string());
    }
    Ok(PathBuf::from(home).join(".claude"))
}

/// Clear read-only attributes on all files in a directory tree so
/// `remove_dir_all` doesn't fail on Windows due to read-only files.
///
/// Symlinks are skipped entirely — `remove_dir_all` already removes the
/// link entry itself without following the target, so there is no need to
/// touch permissions through a symlink (which would escape the validated
/// path boundary).
fn clear_readonly_recursive(path: &Path) -> Result<(), String> {
    // Use symlink_metadata so we inspect the link itself, not the target.
    let meta = match std::fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(_) => return Ok(()),
    };

    // Never follow symlinks — skip them.
    if meta.file_type().is_symlink() {
        return Ok(());
    }

    if meta.is_file() {
        let mut perms = meta.permissions();
        if perms.readonly() {
            perms.set_readonly(false);
            let _ = std::fs::set_permissions(path, perms);
        }
    } else if meta.is_dir() {
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                clear_readonly_recursive(&entry.path())?;
            }
        }
    }
    Ok(())
}

/// Robustly delete a directory: clears read-only attributes and retries
/// on transient failures (e.g. file-locked by watcher on Windows).
fn force_remove_dir(path: &Path) -> Result<(), String> {
    // First attempt — works most of the time on Linux/macOS
    match std::fs::remove_dir_all(path) {
        Ok(()) => return Ok(()),
        Err(first_err) => {
            // Clear read-only flags and retry
            let _ = clear_readonly_recursive(path);

            // Retry up to 3 times with short sleeps to handle transient locks
            for attempt in 0..3 {
                if attempt > 0 {
                    std::thread::sleep(std::time::Duration::from_millis(100 * (attempt as u64)));
                }
                match std::fs::remove_dir_all(path) {
                    Ok(()) => return Ok(()),
                    Err(_) if attempt < 2 => continue,
                    Err(_) => {}
                }
            }

            Err(format!(
                "Could not delete '{}': {} — close any programs using this folder and try again",
                path.display(),
                first_err
            ))
        }
    }
}

/// Validate that `child` lives under `parent` (prevents path traversal).
fn validate_within(child: &Path, parent: &Path) -> Result<PathBuf, String> {
    let canonical = child
        .canonicalize()
        .map_err(|e| format!("Cannot resolve '{}': {}", child.display(), e))?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|e| format!("Cannot resolve '{}': {}", parent.display(), e))?;
    if !canonical.starts_with(&canonical_parent) {
        return Err("Invalid team name: path traversal detected".to_string());
    }
    Ok(canonical)
}

#[tauri::command]
pub async fn cmd_load_teams(project_cwd: Option<String>) -> Result<Vec<Team>, String> {
    let claude_home = get_claude_home()?;
    let cwd_path = project_cwd.map(PathBuf::from);
    load_teams(&claude_home, cwd_path.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_delete_team(team_name: String) -> Result<(), String> {
    let claude_home = get_claude_home()?;

    // Delete team directory
    let teams_base = claude_home.join("teams");
    let team_dir = teams_base.join(&team_name);
    if team_dir.exists() {
        let canonical = validate_within(&team_dir, &teams_base)?;
        force_remove_dir(&canonical)?;
    }

    // Delete associated tasks directory
    let tasks_base = claude_home.join("tasks");
    let tasks_dir = tasks_base.join(&team_name);
    if tasks_dir.exists() {
        let canonical = validate_within(&tasks_dir, &tasks_base)?;
        force_remove_dir(&canonical)?;
    }

    Ok(())
}
