use std::path::Path;

use anyhow::Result;

use crate::models::task::Task;
use crate::models::task_snapshot::{StatusChange, TaskRecord, TaskSnapshotFile};

fn snapshot_path(claude_home: &Path, encoded_project_dir: &str, team_name: &str) -> std::path::PathBuf {
    claude_home
        .join("theassociate")
        .join("projects")
        .join(encoded_project_dir)
        .join("task-snapshots")
        .join(format!("{}.json", team_name))
}

pub fn load_task_snapshots(
    claude_home: &Path,
    encoded_project_dir: &str,
    team_name: &str,
) -> TaskSnapshotFile {
    let path = snapshot_path(claude_home, encoded_project_dir, team_name);
    if !path.exists() {
        return TaskSnapshotFile {
            team_name: team_name.to_string(),
            updated_at: String::new(),
            tasks: Default::default(),
        };
    }
    let data = match std::fs::read_to_string(&path) {
        Ok(d) => d,
        Err(_) => {
            return TaskSnapshotFile {
                team_name: team_name.to_string(),
                updated_at: String::new(),
                tasks: Default::default(),
            }
        }
    };
    serde_json::from_str(&data).unwrap_or_else(|_| TaskSnapshotFile {
        team_name: team_name.to_string(),
        updated_at: String::new(),
        tasks: Default::default(),
    })
}

pub fn upsert_task_snapshot(
    claude_home: &Path,
    encoded_project_dir: &str,
    team_name: &str,
    task: &Task,
    now: &str,
) -> Result<()> {
    let mut file = load_task_snapshots(claude_home, encoded_project_dir, team_name);

    let task_status_str = serde_json::to_value(&task.status)
        .ok()
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "pending".to_string());

    let record = file.tasks.entry(task.id.clone()).or_insert_with(|| TaskRecord {
        id: task.id.clone(),
        subject: task.subject.clone(),
        first_seen: now.to_string(),
        last_seen: now.to_string(),
        status_changes: Vec::new(),
        snapshot: task.clone(),
    });

    record.last_seen = now.to_string();
    record.subject = task.subject.clone();
    record.snapshot = task.clone();

    let should_add_change = record.status_changes.is_empty()
        || record
            .status_changes
            .last()
            .map(|sc| sc.status != task_status_str)
            .unwrap_or(true);

    if should_add_change {
        record.status_changes.push(StatusChange {
            status: task_status_str,
            at: now.to_string(),
        });
    }

    file.team_name = team_name.to_string();
    file.updated_at = now.to_string();

    let path = snapshot_path(claude_home, encoded_project_dir, team_name);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, serde_json::to_string_pretty(&file)?)?;
    std::fs::rename(&tmp, &path)?;

    Ok(())
}
