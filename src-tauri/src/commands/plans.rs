use crate::data::plans::load_plans;
use crate::models::plan::PlanFile;
use std::path::PathBuf;

fn get_claude_home() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .unwrap_or_else(|_| std::env::var("HOME").unwrap_or_default());
    PathBuf::from(home).join(".claude")
}

#[tauri::command]
pub async fn cmd_load_plans() -> Result<Vec<PlanFile>, String> {
    let claude_home = get_claude_home();
    load_plans(&claude_home).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_read_plan(filename: String) -> Result<String, String> {
    let claude_home = get_claude_home();
    let plans_dir = claude_home.join("plans");
    let path = plans_dir.join(&filename);
    // Guard against path traversal
    if !path.starts_with(&plans_dir) {
        return Err("Invalid plan path".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_save_plan(filename: String, content: String) -> Result<(), String> {
    let claude_home = get_claude_home();
    let plans_dir = claude_home.join("plans");
    let path = plans_dir.join(&filename);
    // Guard against path traversal
    if !path.starts_with(&plans_dir) {
        return Err("Invalid plan path".to_string());
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}
