use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamConfig {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub created_at: Option<u64>,
    #[serde(default)]
    pub lead_agent_id: Option<String>,
    #[serde(default)]
    pub lead_session_id: Option<String>,
    #[serde(default)]
    pub members: Vec<TeamMember>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamMember {
    pub name: String,
    #[serde(default)]
    pub agent_id: Option<String>,
    #[serde(default)]
    pub agent_type: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub joined_at: Option<u64>,
    #[serde(default)]
    pub tmux_pane_id: Option<String>,
    #[serde(default)]
    pub backend_type: Option<String>,
    #[serde(default)]
    pub prompt: Option<String>,
    #[serde(default)]
    pub plan_mode_required: Option<bool>,
    #[serde(default)]
    pub subscriptions: Option<Vec<String>>,
}


#[derive(Debug, Clone, Serialize)]
pub struct Team {
    pub dir_name: String,
    pub config: TeamConfig,
}
