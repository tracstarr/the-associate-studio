use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryFile {
    pub session_id: String,
    pub filename: String,
    /// Unix timestamp (seconds) when the summary was created
    pub created: u64,
    /// First 200 chars for notification previews
    pub preview: String,
}
