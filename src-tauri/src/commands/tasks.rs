use crate::data::tasks::load_tasks;
use crate::models::task::Task;
use std::path::PathBuf;

fn get_claude_home() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .unwrap_or_else(|_| std::env::var("HOME").unwrap_or_default());
    PathBuf::from(home).join(".claude")
}

#[tauri::command]
pub async fn cmd_load_tasks(team_name: String) -> Result<Vec<Task>, String> {
    let claude_home = get_claude_home();
    load_tasks(&claude_home, &team_name).map_err(|e| e.to_string())
}
