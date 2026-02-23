use crate::models::hook_event::HookEvent;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveSubagent {
    pub agent_id: String,
    pub agent_type: Option<String>,
    pub started_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveSession {
    pub session_id: String,
    pub cwd: Option<String>,
    pub started_at: Option<String>,
    pub model: Option<String>,
    pub is_active: bool,
    pub status: String,
    pub subagents: Vec<ActiveSubagent>,
}

pub fn parse_hook_events(path: &std::path::Path) -> Vec<HookEvent> {
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return vec![],
    };
    let reader = BufReader::new(file);
    reader
        .lines()
        .filter_map(|line| line.ok())
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str(&line).ok())
        .collect()
}

pub fn build_active_sessions(events: &[HookEvent]) -> HashMap<String, ActiveSession> {
    let mut sessions: HashMap<String, ActiveSession> = HashMap::new();
    for event in events {
        match event.hook_event_name.as_str() {
            "SessionStart" => {
                let session = sessions
                    .entry(event.session_id.clone())
                    .or_insert_with(|| ActiveSession {
                        session_id: event.session_id.clone(),
                        cwd: event.cwd.clone(),
                        started_at: None,
                        model: event.model.clone(),
                        is_active: true,
                        status: "active".to_string(),
                        subagents: vec![],
                    });
                session.is_active = true;
                session.status = "active".to_string();
                session.cwd = event.cwd.clone();
                if event.model.is_some() {
                    session.model = event.model.clone();
                }
            }
            "SessionEnd" => {
                if let Some(session) = sessions.get_mut(&event.session_id) {
                    session.is_active = false;
                    session.status = "completed".to_string();
                }
            }
            "Stop" => {
                if let Some(session) = sessions.get_mut(&event.session_id) {
                    session.is_active = false;
                    session.status = "idle".to_string();
                }
            }
            "SubagentStart" => {
                if let Some(agent_id) = &event.agent_id {
                    let session = sessions
                        .entry(event.session_id.clone())
                        .or_insert_with(|| ActiveSession {
                            session_id: event.session_id.clone(),
                            cwd: event.cwd.clone(),
                            started_at: None,
                            model: None,
                            is_active: true,
                            status: "active".to_string(),
                            subagents: vec![],
                        });
                    if !session.subagents.iter().any(|a| &a.agent_id == agent_id) {
                        session.subagents.push(ActiveSubagent {
                            agent_id: agent_id.clone(),
                            agent_type: event.agent_type.clone(),
                            started_at: None,
                        });
                    }
                }
            }
            "SubagentStop" => {
                if let Some(agent_id) = &event.agent_id {
                    if let Some(session) = sessions.get_mut(&event.session_id) {
                        session.subagents.retain(|a| &a.agent_id != agent_id);
                    }
                }
            }
            _ => {}
        }
    }
    sessions
}
