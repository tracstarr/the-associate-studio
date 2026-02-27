use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRef {
    pub id: String,
    pub file_path: String,
    pub line_start: u32,
    pub line_end: u32,
    pub quote: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueRef {
    pub id: String,          // unique local ID
    pub provider: String,    // "github" | "linear" | "jira"
    pub key: String,         // "42", "ENG-456", "PROJ-123" (matches tab.issueKey)
    pub url: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub project_path: Option<String>, // None = global
    pub file_refs: Vec<FileRef>,
    #[serde(default)]
    pub issue_refs: Vec<IssueRef>,
    pub created: u64, // ms timestamp
    pub modified: u64,
}
