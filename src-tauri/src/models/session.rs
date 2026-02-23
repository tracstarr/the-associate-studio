use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct SessionIndex {
    pub version: Option<u32>,
    #[serde(default)]
    pub entries: Vec<SessionEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEntry {
    pub session_id: String,
    #[serde(default)]
    pub first_prompt: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub message_count: Option<u32>,
    #[serde(default)]
    pub created: Option<DateTime<Utc>>,
    #[serde(default)]
    pub modified: Option<DateTime<Utc>>,
    #[serde(default)]
    pub git_branch: Option<String>,
    #[serde(default)]
    pub project_path: Option<String>,
    #[serde(default)]
    pub is_sidechain: Option<bool>,
}

impl SessionEntry {
    pub fn display_title(&self) -> String {
        if let Some(ref s) = self.summary {
            if !s.is_empty() {
                return s.clone();
            }
        }
        if let Some(ref p) = self.first_prompt {
            if !p.is_empty() {
                let truncated: String = p.chars().take(60).collect();
                if truncated.len() < p.len() {
                    return format!("{}...", truncated);
                }
                return truncated;
            }
        }
        self.session_id[..8.min(self.session_id.len())].to_string()
    }

    pub fn branch(&self) -> &str {
        self.git_branch.as_deref().unwrap_or("")
    }
}
