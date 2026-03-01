use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::models::task::Task;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusChange {
    pub status: String,
    pub at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRecord {
    pub id: String,
    #[serde(default)]
    pub subject: Option<String>,
    pub first_seen: String,
    pub last_seen: String,
    #[serde(default)]
    pub status_changes: Vec<StatusChange>,
    pub snapshot: Task,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskSnapshotFile {
    pub team_name: String,
    pub updated_at: String,
    #[serde(default)]
    pub tasks: HashMap<String, TaskRecord>,
}
