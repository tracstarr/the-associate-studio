use crate::data::claude_config::discover_extensions;
use crate::models::claude_config::ClaudeExtension;

#[tauri::command]
pub async fn cmd_load_extensions(project_dir: String) -> Result<Vec<ClaudeExtension>, String> {
    Ok(discover_extensions(&project_dir))
}
