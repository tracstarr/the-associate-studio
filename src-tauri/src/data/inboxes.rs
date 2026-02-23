use std::path::Path;

use anyhow::Result;

use crate::models::inbox::InboxMessage;

/// Load inbox messages for a specific agent in a team.
pub fn load_inbox(
    claude_home: &Path,
    team_name: &str,
    agent_name: &str,
) -> Result<Vec<InboxMessage>> {
    let inbox_path = claude_home
        .join("teams")
        .join(team_name)
        .join("inboxes")
        .join(format!("{}.json", agent_name));

    if !inbox_path.exists() {
        return Ok(vec![]);
    }

    let data = std::fs::read_to_string(&inbox_path)?;
    let raw_values: Vec<serde_json::Value> = serde_json::from_str(&data)?;
    let mut messages: Vec<InboxMessage> = raw_values
        .into_iter()
        .filter_map(|v| serde_json::from_value(v).ok())
        .collect();

    messages.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(messages)
}

/// Send a message to an agent's inbox (atomic write).
pub fn send_inbox_message(
    claude_home: &Path,
    team_name: &str,
    agent_name: &str,
    from: &str,
    text: &str,
    color: Option<&str>,
) -> Result<()> {
    let inbox_path = claude_home
        .join("teams")
        .join(team_name)
        .join("inboxes")
        .join(format!("{}.json", agent_name));

    // Ensure directory exists
    if let Some(parent) = inbox_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Read existing messages
    let mut messages: Vec<serde_json::Value> = if inbox_path.exists() {
        let data = std::fs::read_to_string(&inbox_path)?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    // Build new message
    let timestamp = chrono::Utc::now().to_rfc3339();
    let mut msg = serde_json::json!({
        "from": from,
        "text": text,
        "timestamp": timestamp,
        "read": false
    });
    if let Some(c) = color {
        msg["color"] = serde_json::Value::String(c.to_string());
    }

    messages.push(msg);

    // Atomic write: write to temp, then rename
    let temp_path = inbox_path.with_extension("json.tmp");
    let serialized = serde_json::to_string_pretty(&messages)?;
    std::fs::write(&temp_path, &serialized)?;
    std::fs::rename(&temp_path, &inbox_path)?;

    Ok(())
}
