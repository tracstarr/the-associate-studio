use crate::data::path_encoding::encode_project_path;
use crate::data::sessions::load_sessions;
use crate::data::transcripts::TranscriptReader;
use crate::models::session::SessionEntry;
use crate::models::transcript::TranscriptItem;
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
pub async fn cmd_load_sessions(project_dir: String) -> Result<Vec<SessionEntry>, String> {
    let claude_home = get_claude_home()?;
    let encoded = encode_project_path(&PathBuf::from(&project_dir));
    let project_sessions_dir = claude_home.join("projects").join(&encoded);
    load_sessions(&project_sessions_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_load_transcript(
    session_path: String,
    offset: u64,
) -> Result<(Vec<TranscriptItem>, u64), String> {
    let path = PathBuf::from(&session_path);

    if offset == 0 {
        let mut reader = TranscriptReader::with_tail_lines(200);
        reader.load_initial(&path).map_err(|e| e.to_string())?;
        let new_offset = reader.last_offset;
        Ok((reader.items, new_offset))
    } else {
        let mut reader = TranscriptReader::with_tail_lines(200);
        reader.last_offset = offset;
        reader.read_new(&path).map_err(|e| e.to_string())?;
        let new_offset = reader.last_offset;
        Ok((reader.items, new_offset))
    }
}
