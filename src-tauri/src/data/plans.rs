use std::path::Path;

use anyhow::Result;

use crate::models::plan::{MarkdownLine, MarkdownLineKind, PlanFile};

/// Load all plan files from `~/.claude/plans/`, sorted newest-first.
pub fn load_plans(claude_home: &Path) -> Result<Vec<PlanFile>> {
    let plans_dir = claude_home.join("plans");
    if !plans_dir.exists() {
        return Ok(Vec::new());
    }

    let mut plans = Vec::new();
    for entry in std::fs::read_dir(&plans_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let filename = match path.file_name() {
            Some(n) => n.to_string_lossy().to_string(),
            None => continue,
        };
        let modified = match entry.metadata() {
            Ok(m) => m.modified().unwrap_or(std::time::UNIX_EPOCH),
            Err(_) => continue,
        };
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        let title = extract_title(&content);
        let lines = parse_markdown_lines(&content);

        plans.push(PlanFile {
            filename,
            title,
            modified,
            lines,
        });
    }

    plans.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(plans)
}

fn extract_title(content: &str) -> String {
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("# ") {
            let title = rest.trim();
            if !title.is_empty() {
                return title.to_string();
            }
        }
    }
    "(untitled)".to_string()
}

pub fn parse_markdown_lines(content: &str) -> Vec<MarkdownLine> {
    let mut result = Vec::new();
    let mut in_code_block = false;

    for line in content.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") {
            result.push(MarkdownLine {
                kind: MarkdownLineKind::CodeFence,
                text: line.to_string(),
            });
            in_code_block = !in_code_block;
        } else if in_code_block {
            result.push(MarkdownLine {
                kind: MarkdownLineKind::CodeBlock,
                text: line.to_string(),
            });
        } else if trimmed.starts_with("# ")
            || trimmed.starts_with("## ")
            || trimmed.starts_with("### ")
            || trimmed.starts_with("#### ")
            || trimmed.starts_with("##### ")
            || trimmed.starts_with("###### ")
        {
            result.push(MarkdownLine {
                kind: MarkdownLineKind::Heading,
                text: line.to_string(),
            });
        } else {
            result.push(MarkdownLine {
                kind: MarkdownLineKind::Normal,
                text: line.to_string(),
            });
        }
    }

    result
}
