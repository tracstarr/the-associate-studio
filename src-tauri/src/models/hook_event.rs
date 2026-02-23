use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookEvent {
    pub hook_event_name: String,
    pub session_id: String,
    pub transcript_path: Option<String>,
    pub cwd: Option<String>,
    pub source: Option<String>,
    pub model: Option<String>,
    pub reason: Option<String>,
    pub agent_id: Option<String>,
    pub agent_type: Option<String>,
    pub last_assistant_message: Option<String>,
    pub stop_hook_active: Option<bool>,
}
