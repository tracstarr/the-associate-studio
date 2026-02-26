use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize)]
pub struct TranscriptEnvelope {
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub timestamp: Option<DateTime<Utc>>,
    #[serde(default)]
    pub message: Option<TranscriptMessage>,
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TranscriptMessage {
    #[serde(default)]
    pub content: MessageContent,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum MessageContent {
    Text(String),
    Blocks(Vec<ContentBlock>),
}

impl Default for MessageContent {
    fn default() -> Self {
        MessageContent::Text(String::new())
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "tool_use")]
    ToolUse {
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        input: Option<Value>,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        #[serde(default)]
        content: Option<Value>,
    },
    #[serde(other)]
    Other,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranscriptItem {
    pub timestamp: Option<DateTime<Utc>>,
    pub kind: TranscriptItemKind,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum TranscriptItemKind {
    User,
    Assistant,
    ToolUse,
    ToolResult,
    System,
    Progress,
}

pub fn parse_envelope(envelope: &TranscriptEnvelope) -> Vec<TranscriptItem> {
    let ts = envelope.timestamp;

    match envelope.kind.as_str() {
        "user" => parse_message_items(envelope, ts, TranscriptItemKind::User),
        "assistant" => parse_message_items(envelope, ts, TranscriptItemKind::Assistant),
        "system" => {
            let text = extract_message_text(envelope);
            if text.is_empty() {
                return vec![];
            }
            vec![TranscriptItem {
                timestamp: ts,
                kind: TranscriptItemKind::System,
                text,
            }]
        }
        "progress" => {
            let text = envelope
                .extra
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if text.is_empty() {
                return vec![];
            }
            vec![TranscriptItem {
                timestamp: ts,
                kind: TranscriptItemKind::Progress,
                text,
            }]
        }
        _ => vec![],
    }
}

fn parse_message_items(
    envelope: &TranscriptEnvelope,
    ts: Option<DateTime<Utc>>,
    default_kind: TranscriptItemKind,
) -> Vec<TranscriptItem> {
    let msg = match &envelope.message {
        Some(m) => m,
        None => return vec![],
    };

    match &msg.content {
        MessageContent::Text(s) => {
            if s.is_empty() {
                return vec![];
            }
            vec![TranscriptItem {
                timestamp: ts,
                kind: default_kind,
                text: s.clone(),
            }]
        }
        MessageContent::Blocks(blocks) => {
            let mut items = Vec::new();
            for block in blocks {
                match block {
                    ContentBlock::Text { text } => {
                        if !text.is_empty() {
                            items.push(TranscriptItem {
                                timestamp: ts,
                                kind: default_kind.clone(),
                                text: text.clone(),
                            });
                        }
                    }
                    ContentBlock::ToolUse { name, input } => {
                        let tool_name = name.as_deref().unwrap_or("unknown");
                        let summary = match input {
                            Some(Value::Object(map)) => map
                                .iter()
                                .find_map(|(k, v)| {
                                    v.as_str().map(|s| {
                                        let truncated: String = s.chars().take(50).collect();
                                        format!("{}: {}", k, truncated)
                                    })
                                })
                                .unwrap_or_default(),
                            _ => String::new(),
                        };
                        let text = if summary.is_empty() {
                            tool_name.to_string()
                        } else {
                            format!("{} ({})", tool_name, summary)
                        };
                        items.push(TranscriptItem {
                            timestamp: ts,
                            kind: TranscriptItemKind::ToolUse,
                            text,
                        });
                    }
                    ContentBlock::ToolResult { content } => {
                        let text = match content {
                            Some(Value::String(s)) => s.chars().take(80).collect::<String>(),
                            Some(Value::Array(arr)) => arr
                                .iter()
                                .filter_map(|v| {
                                    v.get("text")
                                        .and_then(|t| t.as_str())
                                        .map(|s| s.chars().take(80).collect::<String>())
                                })
                                .next()
                                .unwrap_or_else(|| "[result]".to_string()),
                            _ => "[result]".to_string(),
                        };
                        items.push(TranscriptItem {
                            timestamp: ts,
                            kind: TranscriptItemKind::ToolResult,
                            text,
                        });
                    }
                    ContentBlock::Other => {}
                }
            }
            items
        }
    }
}

fn extract_message_text(envelope: &TranscriptEnvelope) -> String {
    if let Some(ref msg) = envelope.message {
        match &msg.content {
            MessageContent::Text(s) => return s.clone(),
            MessageContent::Blocks(blocks) => {
                for block in blocks {
                    if let ContentBlock::Text { text } = block {
                        return text.clone();
                    }
                }
            }
        }
    }
    String::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_json(json: &str) -> TranscriptEnvelope {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn test_parse_user_text_message() {
        let env = parse_json(r#"{"type":"user","message":{"content":"Hello Claude"}}"#);
        let items = parse_envelope(&env);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].kind, TranscriptItemKind::User);
        assert_eq!(items[0].text, "Hello Claude");
    }

    #[test]
    fn test_parse_assistant_text_message() {
        let env = parse_json(r#"{"type":"assistant","message":{"content":"Sure!"}}"#);
        let items = parse_envelope(&env);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].kind, TranscriptItemKind::Assistant);
        assert_eq!(items[0].text, "Sure!");
    }

    #[test]
    fn test_parse_assistant_blocks() {
        let env = parse_json(
            r#"{"type":"assistant","message":{"content":[
                {"type":"text","text":"Let me help"},
                {"type":"tool_use","name":"Read","input":{"file_path":"/src/main.rs"}}
            ]}}"#,
        );
        let items = parse_envelope(&env);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].kind, TranscriptItemKind::Assistant);
        assert_eq!(items[0].text, "Let me help");
        assert_eq!(items[1].kind, TranscriptItemKind::ToolUse);
        assert!(items[1].text.contains("Read"));
    }

    #[test]
    fn test_parse_tool_result_string() {
        let env = parse_json(
            r#"{"type":"assistant","message":{"content":[
                {"type":"tool_result","content":"File contents here"}
            ]}}"#,
        );
        let items = parse_envelope(&env);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].kind, TranscriptItemKind::ToolResult);
        assert_eq!(items[0].text, "File contents here");
    }

    #[test]
    fn test_parse_tool_result_array() {
        let env = parse_json(
            r#"{"type":"assistant","message":{"content":[
                {"type":"tool_result","content":[{"text":"Result text"}]}
            ]}}"#,
        );
        let items = parse_envelope(&env);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].text, "Result text");
    }

    #[test]
    fn test_parse_system_message() {
        let env = parse_json(r#"{"type":"system","message":{"content":"System init"}}"#);
        let items = parse_envelope(&env);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].kind, TranscriptItemKind::System);
        assert_eq!(items[0].text, "System init");
    }

    #[test]
    fn test_parse_progress_message() {
        let env = parse_json(r#"{"type":"progress","content":"Processing..."}"#);
        let items = parse_envelope(&env);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].kind, TranscriptItemKind::Progress);
        assert_eq!(items[0].text, "Processing...");
    }

    #[test]
    fn test_unknown_type_returns_empty() {
        let env = parse_json(r#"{"type":"unknown_type"}"#);
        let items = parse_envelope(&env);
        assert!(items.is_empty());
    }

    #[test]
    fn test_empty_message_returns_empty() {
        let env = parse_json(r#"{"type":"user","message":{"content":""}}"#);
        let items = parse_envelope(&env);
        assert!(items.is_empty());
    }

    #[test]
    fn test_no_message_returns_empty() {
        let env = parse_json(r#"{"type":"user"}"#);
        let items = parse_envelope(&env);
        assert!(items.is_empty());
    }

    #[test]
    fn test_timestamp_preserved() {
        let env = parse_json(
            r#"{"type":"user","timestamp":"2025-06-15T10:30:00Z","message":{"content":"Hi"}}"#,
        );
        let items = parse_envelope(&env);
        assert!(items[0].timestamp.is_some());
    }

    #[test]
    fn test_tool_use_without_input() {
        let env = parse_json(
            r#"{"type":"assistant","message":{"content":[
                {"type":"tool_use","name":"Bash"}
            ]}}"#,
        );
        let items = parse_envelope(&env);
        assert_eq!(items[0].kind, TranscriptItemKind::ToolUse);
        assert_eq!(items[0].text, "Bash");
    }

    #[test]
    fn test_tool_use_without_name() {
        let env = parse_json(
            r#"{"type":"assistant","message":{"content":[
                {"type":"tool_use"}
            ]}}"#,
        );
        let items = parse_envelope(&env);
        assert_eq!(items[0].text, "unknown");
    }
}
