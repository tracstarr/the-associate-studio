use crate::data::inboxes;
use crate::models::inbox::InboxMessage;
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
pub async fn cmd_load_inbox(
    team_name: String,
    agent_name: String,
) -> Result<Vec<InboxMessage>, String> {
    let claude_home = get_claude_home()?;
    inboxes::load_inbox(&claude_home, &team_name, &agent_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_send_inbox_message(
    team_name: String,
    agent_name: String,
    from: String,
    text: String,
    color: Option<String>,
) -> Result<(), String> {
    let claude_home = get_claude_home()?;
    inboxes::send_inbox_message(
        &claude_home,
        &team_name,
        &agent_name,
        &from,
        &text,
        color.as_deref(),
    )
    .map_err(|e| e.to_string())
}
