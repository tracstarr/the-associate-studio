use std::io::{BufRead, BufReader};
use std::path::Path;

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::Deserialize;

use crate::models::session::{SessionEntry, SessionIndex};

/// Load the sessions index file for a project.
/// Falls back to scanning .jsonl files if the index doesn't exist.
pub fn load_sessions(project_dir: &Path) -> Result<Vec<SessionEntry>> {
    let index_path = project_dir.join("sessions-index.json");
    if index_path.exists() {
        let data = std::fs::read_to_string(&index_path)?;
        let index: SessionIndex = serde_json::from_str(&data)?;
        let mut entries: Vec<SessionEntry> = index
            .entries
            .into_iter()
            .filter(|e| e.is_sidechain != Some(true))
            .collect();
        entries.sort_by(|a, b| b.modified.cmp(&a.modified));
        return Ok(entries);
    }

    scan_jsonl_files(project_dir)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonlEnvelope {
    #[serde(default)]
    #[allow(dead_code)]
    session_id: Option<String>,
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
