use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoItem {
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default, rename = "activeForm")]
    pub active_form: Option<String>,
}


#[derive(Debug, Clone, Serialize)]
pub struct TodoFile {
    pub filename: String,
    pub items: Vec<TodoItem>,
}
