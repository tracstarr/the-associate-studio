use serde::Serialize;

/// The scope/level at which a config item was found.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConfigLevel {
    /// ~/.claude/ (user-global)
    User,
    /// {project}/.claude/ (project-local)
    Project,
}

/// The kind of extension discovered.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExtensionKind {
    McpServer,
    Skill,
    Agent,
    /// Permission-granted tool (from allowedTools / permissions.allow)
    AllowedTool,
}

/// A single discovered extension (MCP server, skill/command, or agent).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeExtension {
    /// Human-readable name (server name, command filename, etc.)
    pub name: String,
    /// What kind of extension this is
    pub kind: ExtensionKind,
    /// Where it was found
    pub level: ConfigLevel,
    /// Which settings file it came from (e.g. "settings.json", "settings.local.json")
    pub source_file: String,
    /// Short description (extracted from front matter or config)
    pub description: Option<String>,
    /// Full markdown content (for skills) or generated summary (for MCP servers)
    pub content: String,
    /// Raw front matter as key-value pairs (for skills)
    pub front_matter: Option<serde_json::Value>,
    /// Absolute path to the source file on disk (for skills)
    pub file_path: Option<String>,
}
