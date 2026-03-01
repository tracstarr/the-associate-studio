use std::collections::HashMap;
use crate::commands::projects::get_theassociate_home;

fn get_plan_links_path(project_dir: &str) -> Result<std::path::PathBuf, String> {
    let dir = get_theassociate_home()?.join("projects").join(project_dir);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("plan-links.json"))
}

#[tauri::command]
pub async fn cmd_load_plan_links(project_dir: String) -> Result<HashMap<String, String>, String> {
    let path = get_plan_links_path(&project_dir)?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_save_plan_links(
    project_dir: String,
    links: HashMap<String, String>,
) -> Result<(), String> {
    let path = get_plan_links_path(&project_dir)?;
    let json = serde_json::to_string_pretty(&links).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}
