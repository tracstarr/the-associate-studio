use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum MarkdownLineKind {
    Heading,
    CodeFence,
    CodeBlock,
    Normal,
}

#[derive(Debug, Clone, Serialize)]
pub struct MarkdownLine {
    pub kind: MarkdownLineKind,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlanFile {
    pub filename: String,
    pub title: String,
    #[serde(serialize_with = "serialize_system_time")]
    pub modified: std::time::SystemTime,
    pub lines: Vec<MarkdownLine>,
}

fn serialize_system_time<S>(time: &std::time::SystemTime, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    let duration = time
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    serializer.serialize_u64(duration.as_secs())
}
