use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxMessage {
    #[serde(default)]
    pub from: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub timestamp: Option<DateTime<Utc>>,
    #[serde(default)]
    pub read: Option<bool>,
    #[serde(default)]
    pub color: Option<String>,
}

