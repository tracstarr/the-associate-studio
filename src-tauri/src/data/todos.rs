use std::path::Path;

use anyhow::Result;

use crate::models::todo::{TodoFile, TodoItem};

/// Load all non-empty todo files.
pub fn load_todos(claude_home: &Path) -> Result<Vec<TodoFile>> {
    let todos_dir = claude_home.join("todos");
    if !todos_dir.exists() {
        return Ok(vec![]);
    }

    let mut todo_files = Vec::new();

    let entries = std::fs::read_dir(&todos_dir)?;
    for entry in entries.flatten() {
        let path = entry.path();
        let ext = path.extension().and_then(|e| e.to_str());
        if ext != Some("json") {
            continue;
        }

        let filename = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let data = match std::fs::read_to_string(&path) {
            Ok(d) => d,
            Err(_) => continue,
        };

        let items: Vec<TodoItem> = match serde_json::from_str(&data) {
            Ok(items) => items,
            Err(_) => continue,
        };

        if items.is_empty() {
            continue;
        }

        todo_files.push(TodoFile { filename, items });
    }

    todo_files.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(todo_files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_todos_empty() {
        let tmp = tempfile::tempdir().unwrap();
        let result = load_todos(tmp.path()).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_load_todos_with_items() {
        let tmp = tempfile::tempdir().unwrap();
        let todos_dir = tmp.path().join("todos");
        std::fs::create_dir_all(&todos_dir).unwrap();

        let items = r#"[
            {"content": "Fix the bug", "status": "pending"},
            {"content": "Write tests", "status": "completed", "activeForm": "Writing tests"}
        ]"#;
        std::fs::write(todos_dir.join("task1.json"), items).unwrap();

        let result = load_todos(tmp.path()).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].filename, "task1.json");
        assert_eq!(result[0].items.len(), 2);
        assert_eq!(result[0].items[0].content.as_deref(), Some("Fix the bug"));
    }

    #[test]
    fn test_load_todos_skips_empty_arrays() {
        let tmp = tempfile::tempdir().unwrap();
        let todos_dir = tmp.path().join("todos");
        std::fs::create_dir_all(&todos_dir).unwrap();

        std::fs::write(todos_dir.join("empty.json"), "[]").unwrap();
        std::fs::write(
            todos_dir.join("has-items.json"),
            r#"[{"content": "Do something"}]"#,
        )
        .unwrap();

        let result = load_todos(tmp.path()).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].filename, "has-items.json");
    }

    #[test]
    fn test_load_todos_ignores_non_json() {
        let tmp = tempfile::tempdir().unwrap();
        let todos_dir = tmp.path().join("todos");
        std::fs::create_dir_all(&todos_dir).unwrap();

        std::fs::write(todos_dir.join("readme.md"), "# Todos").unwrap();

        let result = load_todos(tmp.path()).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_load_todos_sorted_by_filename() {
        let tmp = tempfile::tempdir().unwrap();
        let todos_dir = tmp.path().join("todos");
        std::fs::create_dir_all(&todos_dir).unwrap();

        let item = r#"[{"content": "item"}]"#;
        std::fs::write(todos_dir.join("zzz.json"), item).unwrap();
        std::fs::write(todos_dir.join("aaa.json"), item).unwrap();

        let result = load_todos(tmp.path()).unwrap();
        assert_eq!(result[0].filename, "aaa.json");
        assert_eq!(result[1].filename, "zzz.json");
    }

    #[test]
    fn test_load_todos_skips_invalid_json() {
        let tmp = tempfile::tempdir().unwrap();
        let todos_dir = tmp.path().join("todos");
        std::fs::create_dir_all(&todos_dir).unwrap();

        std::fs::write(todos_dir.join("bad.json"), "not json at all").unwrap();

        let result = load_todos(tmp.path()).unwrap();
        assert!(result.is_empty());
    }
}
