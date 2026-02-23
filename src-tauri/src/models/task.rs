use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: TaskStatus,
    #[serde(default)]
    pub owner: Option<String>,
    #[serde(default)]
    pub blocks: Vec<String>,
    #[serde(default)]
    pub blocked_by: Vec<String>,
    #[serde(default)]
    pub active_form: Option<String>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    #[default]
    Pending,
    InProgress,
    Completed,
    Deleted,
}

impl TaskStatus {
    pub fn icon(&self) -> &'static str {
        match self {
            Self::Pending => "[ ]",
            Self::InProgress => "[=]",
            Self::Completed => "[X]",
            Self::Deleted => "[-]",
        }
    }
}

impl Task {
    pub fn display_title(&self) -> String {
        self.subject.as_deref().unwrap_or(&self.id).to_string()
    }
}
