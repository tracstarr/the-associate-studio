use crate::data::inboxes;
use crate::models::inbox::InboxMessage;
use std::path::PathBuf;

fn get_claude_home() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .unwrap_or_else(|_| std::env::var("HOME").unwrap_or_default());
    PathBuf::from(home).join(".claude")
}

#[tauri::command]
pub async fn cmd_load_inbox(
    team_name: String,
    agent_name: String,
) -> Result<Vec<InboxMessage>, String> {
    let claude_home = get_claude_home();
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
    let claude_home = get_claude_home();
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
