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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_title_from_heading() {
        assert_eq!(extract_title("# My Plan\n\nContent"), "My Plan");
    }

    #[test]
    fn test_extract_title_untitled() {
        assert_eq!(extract_title("No heading here"), "(untitled)");
    }

    #[test]
    fn test_extract_title_skips_empty_heading() {
        assert_eq!(extract_title("# \n# Real Title"), "Real Title");
    }

    #[test]
    fn test_extract_title_ignores_subheadings() {
        assert_eq!(
            extract_title("## Subheading\n# Title"),
            "Title"
        );
    }

    #[test]
    fn test_parse_markdown_normal_lines() {
        let lines = parse_markdown_lines("Hello\nWorld");
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].kind, MarkdownLineKind::Normal);
        assert_eq!(lines[1].kind, MarkdownLineKind::Normal);
    }

    #[test]
    fn test_parse_markdown_headings() {
        let content = "# H1\n## H2\n### H3\nNormal";
        let lines = parse_markdown_lines(content);
        assert_eq!(lines[0].kind, MarkdownLineKind::Heading);
        assert_eq!(lines[1].kind, MarkdownLineKind::Heading);
        assert_eq!(lines[2].kind, MarkdownLineKind::Heading);
        assert_eq!(lines[3].kind, MarkdownLineKind::Normal);
    }

    #[test]
    fn test_parse_markdown_code_blocks() {
        let content = "Before\n```rust\nlet x = 1;\n```\nAfter";
        let lines = parse_markdown_lines(content);
        assert_eq!(lines[0].kind, MarkdownLineKind::Normal); // Before
        assert_eq!(lines[1].kind, MarkdownLineKind::CodeFence); // ```rust
        assert_eq!(lines[2].kind, MarkdownLineKind::CodeBlock); // let x = 1;
        assert_eq!(lines[3].kind, MarkdownLineKind::CodeFence); // ```
        assert_eq!(lines[4].kind, MarkdownLineKind::Normal); // After
    }

    #[test]
    fn test_parse_markdown_heading_inside_code_block_stays_code() {
        let content = "```\n# Not a heading\n```";
        let lines = parse_markdown_lines(content);
        assert_eq!(lines[1].kind, MarkdownLineKind::CodeBlock);
    }

    #[test]
    fn test_load_plans_empty() {
        let tmp = tempfile::tempdir().unwrap();
        let plans = load_plans(tmp.path()).unwrap();
        assert!(plans.is_empty());
    }

    #[test]
    fn test_load_plans_reads_md_files() {
        let tmp = tempfile::tempdir().unwrap();
        let plans_dir = tmp.path().join("plans");
        std::fs::create_dir_all(&plans_dir).unwrap();

        std::fs::write(plans_dir.join("plan1.md"), "# My Plan\n\nStep 1").unwrap();
        std::fs::write(plans_dir.join("notes.txt"), "Not a plan").unwrap();

        let plans = load_plans(tmp.path()).unwrap();
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].filename, "plan1.md");
        assert_eq!(plans[0].title, "My Plan");
    }
}
