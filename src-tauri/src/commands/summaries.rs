use std::path::PathBuf;
use crate::data::summaries::load_summaries_for_session;
use crate::models::summary::SummaryFile;

fn get_claude_home() -> Result<PathBuf, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Neither USERPROFILE nor HOME is set".to_string())?;
    if home.is_empty() {
        return Err("Home directory is empty".to_string());
    }
    Ok(PathBuf::from(home).join(".claude"))
}

/// Load all summaries for a session.
/// `project_dir` is the encoded project directory name under `~/.claude/projects/`.
#[tauri::command]
pub async fn cmd_load_summaries(
    project_dir: String,
    session_id: String,
) -> Result<Vec<SummaryFile>, String> {
    let dir = get_claude_home()?
        .join("projects")
        .join(&project_dir);
    Ok(load_summaries_for_session(&dir, &session_id))
}

/// Read the raw markdown content of a summary file.
/// `project_dir` is the encoded project directory name under `~/.claude/projects/`.
#[tauri::command]
pub async fn cmd_read_summary(
    project_dir: String,
    filename: String,
) -> Result<String, String> {
    let sessions_dir = get_claude_home()?
        .join("projects")
        .join(&project_dir);
    let path = sessions_dir.join(&filename);
    // Guard against path traversal
    if !path.starts_with(&sessions_dir) {
        return Err("Invalid summary path".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

