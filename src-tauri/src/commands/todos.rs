use crate::data::todos::load_todos;
use crate::models::todo::TodoFile;
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
pub async fn cmd_load_todos() -> Result<Vec<TodoFile>, String> {
    let claude_home = get_claude_home()?;
    load_todos(&claude_home).map_err(|e| e.to_string())
}
