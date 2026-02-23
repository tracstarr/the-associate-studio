use std::path::Path;
use anyhow::Result;
use crate::models::summary::SummaryFile;

/// Returns true if `text` qualifies as a completion summary worth persisting.
pub fn is_completion_summary(text: &str) -> bool {
    let lower = text.to_lowercase();

    // Standalone Summary heading
    if text.lines().any(|l| {
        let t = l.trim();
        t == "# Summary" || t == "## Summary"
    }) {
        return true;
    }

    if text.len() <= 200 {
        return false;
    }

    // Long text containing "summary"
    if lower.contains("summary") {
        return true;
    }

    // Long text with structured / numbered items
    let has_numbered = text.lines().any(|l| {
        let t = l.trim_start();
        // "1." / "2." style OR "Fix 1:" style
        t.starts_with("1.") || t.starts_with("Fix 1:") || t.starts_with("Step 1")
    });
    if has_numbered {
        return true;
    }

    false
}

/// Determine the next available counter for `{session_id}-summary-NNN.md`.
fn next_counter(dir: &Path, session_id: &str) -> u32 {
    let prefix = format!("{}-summary-", session_id);
    let mut max = 0u32;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let s = name.to_string_lossy();
            if s.starts_with(&prefix) && s.ends_with(".md") {
                let mid = &s[prefix.len()..s.len() - 3]; // strip prefix + ".md"
                if let Ok(n) = mid.parse::<u32>() {
                    if n > max {
                        max = n;
                    }
                }
            }
        }
    }
    max + 1
}

/// Write a new summary file and return its filename (e.g. `abc-summary-001.md`).
pub fn save_summary(project_sessions_dir: &Path, session_id: &str, content: &str) -> Result<String> {
    let counter = next_counter(project_sessions_dir, session_id);
    let filename = format!("{}-summary-{:03}.md", session_id, counter);
    let path = project_sessions_dir.join(&filename);
    std::fs::write(&path, content)?;
    Ok(filename)
}

/// Load all summary files for a session, sorted by filename (ascending counter).
pub fn load_summaries_for_session(dir: &Path, session_id: &str) -> Vec<SummaryFile> {
    let prefix = format!("{}-summary-", session_id);
    let mut summaries = Vec::new();

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return summaries,
    };

    for entry in entries.flatten() {
        let name = entry.file_name();
        let filename = name.to_string_lossy().to_string();
        if !filename.starts_with(&prefix) || !filename.ends_with(".md") {
            continue;
        }
        let path = entry.path();
        let content = std::fs::read_to_string(&path).unwrap_or_default();

        let created = entry
            .metadata()
            .ok()
            .and_then(|m| m.created().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let preview: String = content.chars().take(200).collect();

        summaries.push(SummaryFile {
            session_id: session_id.to_string(),
            filename,
            created,
            preview,
        });
    }

    summaries.sort_by(|a, b| a.filename.cmp(&b.filename));
    summaries
}
