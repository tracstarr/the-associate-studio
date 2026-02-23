use std::path::Path;

use anyhow::Result;

use crate::models::task::{Task, TaskStatus};

/// Load all tasks for a given team name.
pub fn load_tasks(claude_home: &Path, team_name: &str) -> Result<Vec<Task>> {
    let tasks_dir = claude_home.join("tasks").join(team_name);
    if !tasks_dir.exists() {
        return Ok(vec![]);
    }

    let mut tasks = Vec::new();

    let entries = std::fs::read_dir(&tasks_dir)?;
    for entry in entries.flatten() {
        let path = entry.path();

        let ext = path.extension().and_then(|e| e.to_str());
        if ext != Some("json") {
            continue;
        }
        if path
            .file_name()
            .map(|n| n.to_string_lossy().contains(".lock"))
            .unwrap_or(false)
        {
            continue;
        }

        let data = match std::fs::read_to_string(&path) {
            Ok(d) => d,
            Err(_) => continue,
        };

        let task: Task = match serde_json::from_str(&data) {
            Ok(t) => t,
            Err(_) => continue,
        };

        if task.status == TaskStatus::Deleted {
            continue;
        }

        tasks.push(task);
    }

    tasks.sort_by(|a, b| {
        let a_num: Option<u32> = a.id.parse().ok();
        let b_num: Option<u32> = b.id.parse().ok();
        match (a_num, b_num) {
            (Some(an), Some(bn)) => an.cmp(&bn),
            _ => a.id.cmp(&b.id),
        }
    });

    Ok(tasks)
}
