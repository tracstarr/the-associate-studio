use crate::data::teams::load_teams;
use crate::models::team::Team;
use std::path::PathBuf;

fn get_claude_home() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .unwrap_or_else(|_| std::env::var("HOME").unwrap_or_default());
    PathBuf::from(home).join(".claude")
}

#[tauri::command]
pub async fn cmd_load_teams(project_cwd: Option<String>) -> Result<Vec<Team>, String> {
    let claude_home = get_claude_home();
    let cwd_path = project_cwd.map(PathBuf::from);
    load_teams(&claude_home, cwd_path.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_delete_team(team_name: String) -> Result<(), String> {
    let claude_home = get_claude_home();
    let team_dir = claude_home.join("teams").join(&team_name);
    if team_dir.exists() {
        std::fs::remove_dir_all(&team_dir).map_err(|e| e.to_string())?;
    }
    let tasks_dir = claude_home.join("tasks").join(&team_name);
    if tasks_dir.exists() {
        std::fs::remove_dir_all(&tasks_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}
