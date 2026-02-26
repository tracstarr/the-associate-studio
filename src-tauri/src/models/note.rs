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
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub project_path: Option<String>, // None = global
    pub file_refs: Vec<FileRef>,
    pub created: u64, // ms timestamp
    pub modified: u64,
}
