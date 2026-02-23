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
