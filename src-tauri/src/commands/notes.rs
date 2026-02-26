use crate::data::notes;
use crate::models::note::Note;
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
pub async fn cmd_load_global_notes() -> Result<Vec<Note>, String> {
    let claude_home = get_claude_home()?;
    notes::load_global_notes(&claude_home).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_load_project_notes(project_path: String) -> Result<Vec<Note>, String> {
    let claude_home = get_claude_home()?;
    let encoded = crate::data::path_encoding::encode_project_path(
        &std::path::PathBuf::from(&project_path),
    );
    notes::load_project_notes(&claude_home, &encoded).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_save_note(note: Note) -> Result<(), String> {
    let claude_home = get_claude_home()?;
    notes::save_note(&claude_home, &note).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_delete_note(
    note_id: String,
    encoded_project_id: Option<String>,
) -> Result<(), String> {
    let claude_home = get_claude_home()?;
    notes::delete_note(&claude_home, &note_id, encoded_project_id.as_deref())
        .map_err(|e| e.to_string())
}
