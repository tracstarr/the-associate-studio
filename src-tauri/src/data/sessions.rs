use std::io::{BufRead, BufReader};
use std::path::Path;

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::Deserialize;

use crate::models::session::{SessionEntry, SessionIndex, SubagentSessionEntry};

/// Load the full session index (including originalPath metadata).
/// Returns None if the index file doesn't exist.
pub fn load_session_index(project_dir: &Path) -> Result<Option<SessionIndex>> {
    let index_path = project_dir.join("sessions-index.json");
    if !index_path.exists() {
        return Ok(None);
    }
    let data = std::fs::read_to_string(&index_path)?;
    let index: SessionIndex = serde_json::from_str(&data)?;
    Ok(Some(index))
}

/// Load the sessions index file for a project.
/// Falls back to scanning .jsonl files if the index is absent, empty, or unparseable.
pub fn load_sessions(project_dir: &Path) -> Result<Vec<SessionEntry>> {
    match load_session_index(project_dir) {
        Ok(Some(index)) if !index.entries.is_empty() => {
            let mut entries: Vec<SessionEntry> = index
                .entries
                .into_iter()
                .filter(|e| e.is_sidechain != Some(true))
                .collect();
            entries.sort_by(|a, b| b.modified.cmp(&a.modified));
            return Ok(entries);
        }
        Ok(_) => {} // absent or empty entries — fall through to scan
        Err(e) => {
            eprintln!("[sessions] sessions-index.json error, falling back to scan: {}", e);
            // fall through
        }
    }
    scan_jsonl_files(project_dir)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonlEnvelope {
    #[serde(default)]
    git_branch: Option<String>,
    #[serde(default)]
    cwd: Option<String>,
    #[serde(default)]
    timestamp: Option<DateTime<Utc>>,
    #[serde(rename = "type")]
    #[serde(default)]
    line_type: Option<String>,
    #[serde(default)]
    message: Option<serde_json::Value>,
}

fn scan_jsonl_files(project_dir: &Path) -> Result<Vec<SessionEntry>> {
    if !project_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries = Vec::new();

    let dir_entries = std::fs::read_dir(project_dir)?;
    for entry in dir_entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }

        let session_id = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        if session_id.is_empty() {
            continue;
        }

        if let Some(entry) = build_entry_from_jsonl(&path, &session_id) {
            entries.push(entry);
        }
    }

    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(entries)
}

/// Scan the `subagents/` subdirectory for a given session and return metadata
/// for each subagent JSONL file found.  Returns an empty vec if the directory
/// does not exist (old-style sessions have no subdirectory).
pub fn load_subagent_sessions(project_dir: &Path, session_id: &str) -> Vec<SubagentSessionEntry> {
    let subagents_dir = project_dir.join(session_id).join("subagents");
    if !subagents_dir.exists() {
        return vec![];
    }

    let dir_entries = match std::fs::read_dir(&subagents_dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    let mut entries = Vec::new();
    for entry in dir_entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }
        let filename = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        if !filename.starts_with("agent-") {
            continue;
        }
        if let Some(e) = build_subagent_entry_from_jsonl(&path, &filename) {
            entries.push(e);
        }
    }

    // Chronological order (oldest first = the work order)
    entries.sort_by(|a, b| a.modified.cmp(&b.modified));
    entries
}

fn build_subagent_entry_from_jsonl(path: &Path, agent_id: &str) -> Option<SubagentSessionEntry> {
    let file = std::fs::File::open(path).ok()?;
    let reader = BufReader::new(file);

    let mut first_prompt = None;
    let mut message_count: u32 = 0;
    let mut last_timestamp = None;

    for line in reader.lines().take(30) {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        if line.is_empty() {
            continue;
        }
        let envelope: JsonlEnvelope = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(_) => continue,
        };
        if envelope.line_type.as_deref() == Some("file-history-snapshot") {
            continue;
        }
        if let Some(ts) = envelope.timestamp {
            last_timestamp = Some(ts);
        }
        if first_prompt.is_none() && envelope.line_type.as_deref() == Some("user") {
            if let Some(msg) = &envelope.message {
                if let Some(s) = msg.as_str() {
                    first_prompt = Some(s.to_string());
                } else if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
                    first_prompt = Some(content.to_string());
                }
            }
        }
        if envelope.line_type.as_deref() == Some("user")
            || envelope.line_type.as_deref() == Some("assistant")
        {
            message_count += 1;
        }
    }

    let file_modified = std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| {
            let duration = t.duration_since(std::time::UNIX_EPOCH).ok()?;
            DateTime::from_timestamp(duration.as_secs() as i64, duration.subsec_nanos())
        });

    let modified = last_timestamp.or(file_modified);

    Some(SubagentSessionEntry {
        agent_id: agent_id.to_string(),
        agent_type: None,
        first_prompt,
        message_count: if message_count > 0 { Some(message_count) } else { None },
        modified,
        jsonl_path: path.to_string_lossy().to_string(),
    })
}

fn build_entry_from_jsonl(path: &Path, session_id: &str) -> Option<SessionEntry> {
    let file = std::fs::File::open(path).ok()?;
    let reader = BufReader::new(file);

    let mut git_branch = None;
    let mut cwd = None;
    let mut first_timestamp = None;
    let mut last_timestamp = None;
    let mut first_prompt = None;
    let mut message_count: u32 = 0;

    for line in reader.lines().take(30) {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        if line.is_empty() {
            continue;
        }

        let envelope: JsonlEnvelope = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(_) => continue,
        };

        if envelope.line_type.as_deref() == Some("file-history-snapshot") {
            continue;
        }

        if git_branch.is_none() {
            git_branch = envelope.git_branch.clone();
        }
        if cwd.is_none() {
            cwd = envelope.cwd.clone();
        }

        if let Some(ts) = envelope.timestamp {
            if first_timestamp.is_none() {
                first_timestamp = Some(ts);
            }
            last_timestamp = Some(ts);
        }

        if first_prompt.is_none() && envelope.line_type.as_deref() == Some("user") {
            if let Some(msg) = &envelope.message {
                if let Some(s) = msg.as_str() {
                    first_prompt = Some(s.to_string());
                } else if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
                    first_prompt = Some(content.to_string());
                }
            }
        }

        if envelope.line_type.as_deref() == Some("user")
            || envelope.line_type.as_deref() == Some("assistant")
        {
            message_count += 1;
        }
    }

    let file_modified = std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| {
            let duration = t.duration_since(std::time::UNIX_EPOCH).ok()?;
            DateTime::from_timestamp(duration.as_secs() as i64, duration.subsec_nanos())
        });

    let modified = last_timestamp.or(file_modified);
    let created = first_timestamp.or(file_modified);

    Some(SessionEntry {
        session_id: session_id.to_string(),
        first_prompt,
        summary: None,
        message_count: if message_count > 0 {
            Some(message_count)
        } else {
            None
        },
        created,
        modified,
        git_branch,
        project_path: cwd,
        is_sidechain: None,
    })
}
