use crate::data::path_encoding::encode_project_path;
use crate::data::sessions::{load_sessions, load_subagent_sessions};
use crate::data::transcripts::TranscriptReader;
use crate::models::session::{SessionEntry, SessionIndex, SubagentSessionEntry};
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
pub async fn cmd_delete_session(
    project_dir: String,
    session_id: String,
) -> Result<(), String> {
    let claude_home = get_claude_home()?;
    let encoded = encode_project_path(&PathBuf::from(&project_dir));
    let project_sessions_dir = claude_home.join("projects").join(&encoded);

    // Delete the .jsonl transcript file
    let transcript = project_sessions_dir.join(format!("{}.jsonl", session_id));
    if transcript.exists() {
        std::fs::remove_file(&transcript).map_err(|e| e.to_string())?;
    }

    // Remove from sessions-index.json
    let index_path = project_sessions_dir.join("sessions-index.json");
    if index_path.exists() {
        let data = std::fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        let mut index: SessionIndex = serde_json::from_str(&data).map_err(|e| e.to_string())?;
        index.entries.retain(|e| e.session_id != session_id);
        let updated = serde_json::to_string_pretty(&index).map_err(|e| e.to_string())?;
        std::fs::write(&index_path, updated).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn cmd_load_subagent_sessions(
    project_dir: String,
    session_id: String,
) -> Result<Vec<SubagentSessionEntry>, String> {
    let claude_home = get_claude_home()?;
    let encoded = encode_project_path(&PathBuf::from(&project_dir));
    let project_sessions_dir = claude_home.join("projects").join(&encoded);
    Ok(load_subagent_sessions(&project_sessions_dir, &session_id))
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
