use crate::data::teams::load_teams;
use crate::models::team::Team;
use std::path::PathBuf;

fn get_claude_home() -> Result<PathBuf, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Neither USERPROFILE nor HOME environment variable is set".to_string())?;
    if home.is_empty() {
        return Err("Home directory environment variable is empty".to_string());
    }
    Ok(PathBuf::from(home).join(".claude"))
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
    let teams_base = claude_home.join("teams");
    let team_dir = teams_base.join(&team_name);
    // Verify the resolved path stays within the teams directory
    if team_dir.exists() {
        let canonical = team_dir.canonicalize().map_err(|e| e.to_string())?;
        let canonical_parent = teams_base.canonicalize().map_err(|e| e.to_string())?;
        if !canonical.starts_with(&canonical_parent) {
            return Err("Invalid team name: path traversal detected".to_string());
        }
        std::fs::remove_dir_all(&canonical).map_err(|e| e.to_string())?;
    }
    let tasks_base = claude_home.join("tasks");
    let tasks_dir = tasks_base.join(&team_name);
    if tasks_dir.exists() {
        let canonical = tasks_dir.canonicalize().map_err(|e| e.to_string())?;
        let canonical_parent = tasks_base.canonicalize().map_err(|e| e.to_string())?;
        if !canonical.starts_with(&canonical_parent) {
            return Err("Invalid team name: path traversal detected".to_string());
        }
        std::fs::remove_dir_all(&canonical).map_err(|e| e.to_string())?;
    }
    Ok(())
}
