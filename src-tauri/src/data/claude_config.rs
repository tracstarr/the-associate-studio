use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::models::claude_config::{ClaudeExtension, ConfigLevel, ExtensionKind};

/// Parse a single Claude settings JSON file and extract MCP servers and allowed tools.
fn parse_settings_file(path: &Path, level: ConfigLevel, source_file: &str) -> Vec<ClaudeExtension> {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    let json: Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let mut extensions = Vec::new();

    // ---- MCP Servers ----
    extract_mcp_servers(&json, path, &level, source_file, &mut extensions);

    // ---- Allowed Tools (permissions) ----
    let mut allowed_tools: Vec<String> = Vec::new();
    if let Some(tools) = json.get("allowedTools").and_then(|v| v.as_array()) {
        for tool in tools {
            if let Some(t) = tool.as_str() {
                allowed_tools.push(t.to_string());
            }
        }
    }
    if let Some(perms) = json.get("permissions").and_then(|v| v.as_object()) {
        if let Some(allow) = perms.get("allow").and_then(|v| v.as_array()) {
            for tool in allow {
                if let Some(t) = tool.as_str() {
                    if !allowed_tools.contains(&t.to_string()) {
                        allowed_tools.push(t.to_string());
                    }
                }
            }
        }
    }

    for tool_name in &allowed_tools {
        let markdown = format!(
            "---\nname: \"{name}\"\nkind: allowed_tool\nlevel: {level}\nsource: {source}\n---\n\n# Allowed Tool: {name}\n\n**Level:** {level}\n**Source:** `{source}`\n\nThis tool has been granted permission in the Claude settings.",
            name = tool_name,
            level = level_label(&level),
            source = source_file,
        );

        extensions.push(ClaudeExtension {
            name: tool_name.clone(),
            kind: ExtensionKind::AllowedTool,
            level: level.clone(),
            source_file: source_file.to_string(),
            description: Some("Permitted tool".to_string()),
            content: markdown,
            front_matter: None,
            file_path: Some(path.to_string_lossy().replace('\\', "/")),
        });
    }

    extensions
}

/// Extract MCP servers from a JSON value that has an "mcpServers" key.
fn extract_mcp_servers(
    json: &Value,
    path: &Path,
    level: &ConfigLevel,
    source_file: &str,
    extensions: &mut Vec<ClaudeExtension>,
) {
    let servers = match json.get("mcpServers").and_then(|v| v.as_object()) {
        Some(s) => s,
        None => return,
    };

    for (name, config) in servers {
        let transport_type = config
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("stdio");
        let command = config.get("command").and_then(|v| v.as_str());
        let url = config.get("url").and_then(|v| v.as_str());
        let args = config
            .get("args")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|a| a.as_str())
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .unwrap_or_default();

        let env_section = config
            .get("env")
            .and_then(|v| v.as_object())
            .map(|env| {
                let entries: Vec<String> = env
                    .iter()
                    .map(|(k, v)| {
                        let val_str = v.as_str().unwrap_or("***");
                        let masked = if val_str.len() > 8 {
                            format!("{}...{}", &val_str[..4], &val_str[val_str.len() - 4..])
                        } else {
                            val_str.to_string()
                        };
                        format!("  {}: {}", k, masked)
                    })
                    .collect();
                format!("\n\n## Environment\n\n```\n{}\n```", entries.join("\n"))
            })
            .unwrap_or_default();

        let connection_info = if transport_type == "http" || transport_type == "sse" {
            format!("**URL:** `{}`", url.unwrap_or("(not set)"))
        } else {
            format!("**Command:** `{} {}`", command.unwrap_or("unknown"), args)
        };

        let description = if let Some(cmd) = command {
            Some(format!("{} {}", cmd, args).trim().to_string())
        } else {
            url.map(|u| u.to_string())
        };

        let markdown = format!(
            "---\nname: \"{name}\"\nkind: mcp_server\nlevel: {level}\nsource: {source}\ntransport: {transport}\n---\n\n# MCP Server: {name}\n\n**Transport:** {transport}\n{connection}\n**Level:** {level}\n**Source:** `{source}`{env}",
            name = name,
            level = level_label(level),
            source = source_file,
            transport = transport_type,
            connection = connection_info,
            env = env_section,
        );

        extensions.push(ClaudeExtension {
            name: name.clone(),
            kind: ExtensionKind::McpServer,
            level: level.clone(),
            source_file: source_file.to_string(),
            description,
            content: markdown,
            front_matter: Some(config.clone()),
            file_path: Some(path.to_string_lossy().replace('\\', "/")),
        });
    }
}

/// Parse YAML front matter from a markdown file.
/// Returns (front_matter_json, body_after_front_matter).
fn parse_front_matter(content: &str) -> (Option<Value>, &str) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return (None, content);
    }
    if let Some(end_idx) = trimmed[3..].find("\n---") {
        let yaml_str = trimmed[3..3 + end_idx].trim();
        let body_start = 3 + end_idx + 4; // skip past "\n---"
        let body = if body_start < trimmed.len() {
            trimmed[body_start..].trim_start_matches('\n')
        } else {
            ""
        };

        // Parse YAML as key-value pairs into a JSON object
        let mut map = serde_json::Map::new();
        for line in yaml_str.lines() {
            if let Some((key, value)) = line.split_once(':') {
                let key = key.trim().to_string();
                let value = value.trim().to_string();
                if value.starts_with('[') && value.ends_with(']') {
                    let inner = &value[1..value.len() - 1];
                    let items: Vec<Value> = inner
                        .split(',')
                        .map(|s| {
                            Value::String(s.trim().trim_matches('"').trim_matches('\'').to_string())
                        })
                        .collect();
                    map.insert(key, Value::Array(items));
                } else if value == "true" {
                    map.insert(key, Value::Bool(true));
                } else if value == "false" {
                    map.insert(key, Value::Bool(false));
                } else {
                    map.insert(key, Value::String(value));
                }
            }
        }
        (Some(Value::Object(map)), body)
    } else {
        (None, content)
    }
}

/// Scan a commands/ directory for .md slash-command files.
fn scan_commands_dir(dir: &Path, level: ConfigLevel) -> Vec<ClaudeExtension> {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    let mut extensions = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();

        // Recurse into subdirectories (e.g. commands/frontend/component.md)
        if path.is_dir() {
            let sub_entries = match std::fs::read_dir(&path) {
                Ok(e) => e,
                Err(_) => continue,
            };
            for sub_entry in sub_entries.flatten() {
                let sub_path = sub_entry.path();
                if sub_path.is_file() {
                    if let Some(ext) = parse_command_file(&sub_path, &level, Some(&path)) {
                        extensions.push(ext);
                    }
                }
            }
            continue;
        }

        if path.is_file() {
            if let Some(ext) = parse_command_file(&path, &level, None) {
                extensions.push(ext);
            }
        }
    }

    extensions
}

/// Parse a single .md command file into a ClaudeExtension.
fn parse_command_file(
    path: &Path,
    level: &ConfigLevel,
    parent_dir: Option<&Path>,
) -> Option<ClaudeExtension> {
    let name_os = path.file_name()?;
    let name = name_os.to_str()?;
    if !name.ends_with(".md") {
        return None;
    }

    let raw_content = std::fs::read_to_string(path).ok()?;
    let (front_matter, _body) = parse_front_matter(&raw_content);
    let command_name = name.trim_end_matches(".md").to_string();
    let description = front_matter
        .as_ref()
        .and_then(|fm| fm.get("description").and_then(|d| d.as_str()))
        .map(|s| s.to_string());

    let source_label = if let Some(parent) = parent_dir {
        let parent_name = parent
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");
        format!("commands/{}/{}", parent_name, name)
    } else {
        format!("commands/{}", name)
    };

    // Ensure content always has front matter
    let content = if raw_content.trim_start().starts_with("---") {
        raw_content.clone()
    } else {
        format!(
            "---\nname: \"{}\"\nkind: skill\nlevel: {}\n---\n\n{}",
            command_name,
            level_label(level),
            raw_content,
        )
    };

    let abs_path = path.to_string_lossy().replace('\\', "/");

    Some(ClaudeExtension {
        name: command_name,
        kind: ExtensionKind::Skill,
        level: level.clone(),
        source_file: source_label,
        description,
        content,
        front_matter,
        file_path: Some(abs_path),
    })
}

/// Scan a skills/ directory for SKILL.md files in subdirectories.
/// Skills use the structure: skills/{skill-name}/SKILL.md
fn scan_skills_dir(dir: &Path, level: ConfigLevel) -> Vec<ClaudeExtension> {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    let mut extensions = Vec::new();

    for entry in entries.flatten() {
        let skill_dir = entry.path();
        if !skill_dir.is_dir() {
            continue;
        }

        let skill_name = match skill_dir.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        let skill_md = skill_dir.join("SKILL.md");
        if !skill_md.is_file() {
            continue;
        }

        let raw_content = match std::fs::read_to_string(&skill_md) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let (front_matter, _body) = parse_front_matter(&raw_content);
        let description = front_matter
            .as_ref()
            .and_then(|fm| fm.get("description").and_then(|d| d.as_str()))
            .map(|s| s.to_string());

        let content = if raw_content.trim_start().starts_with("---") {
            raw_content.clone()
        } else {
            format!(
                "---\nname: \"{}\"\nkind: skill\nlevel: {}\n---\n\n{}",
                skill_name,
                level_label(&level),
                raw_content,
            )
        };

        let abs_path = skill_md.to_string_lossy().replace('\\', "/");

        extensions.push(ClaudeExtension {
            name: skill_name,
            kind: ExtensionKind::Skill,
            level: level.clone(),
            source_file: format!("skills/{}/SKILL.md", entry.file_name().to_string_lossy()),
            description,
            content,
            front_matter,
            file_path: Some(abs_path),
        });
    }

    extensions
}

/// Scan an agents/ directory for agent definition files.
fn scan_agents_dir(dir: &Path, level: ConfigLevel) -> Vec<ClaudeExtension> {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    let mut extensions = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            // Check for subdirectory agent patterns (agents/{name}/AGENT.md)
            if path.is_dir() {
                let agent_md = path.join("AGENT.md");
                if agent_md.is_file() {
                    if let Some(ext) = parse_agent_file(
                        &agent_md,
                        &level,
                        path.file_name().and_then(|n| n.to_str()),
                    ) {
                        extensions.push(ext);
                    }
                }
            }
            continue;
        }
        if let Some(ext) = parse_agent_file(&path, &level, None) {
            extensions.push(ext);
        }
    }

    extensions
}

/// Parse a single agent definition file.
fn parse_agent_file(
    path: &Path,
    level: &ConfigLevel,
    dir_name: Option<&str>,
) -> Option<ClaudeExtension> {
    let name_str = path.file_name()?.to_str()?;
    if !name_str.ends_with(".md") {
        return None;
    }

    let raw_content = std::fs::read_to_string(path).ok()?;
    let (front_matter, _body) = parse_front_matter(&raw_content);

    let agent_name = dir_name
        .map(|n| n.to_string())
        .unwrap_or_else(|| name_str.trim_end_matches(".md").to_string());

    let description = front_matter
        .as_ref()
        .and_then(|fm| fm.get("description").and_then(|d| d.as_str()))
        .map(|s| s.to_string());

    let content = if raw_content.trim_start().starts_with("---") {
        raw_content.clone()
    } else {
        format!(
            "---\nname: \"{}\"\nkind: agent\nlevel: {}\n---\n\n{}",
            agent_name,
            level_label(level),
            raw_content,
        )
    };

    let abs_path = path.to_string_lossy().replace('\\', "/");

    Some(ClaudeExtension {
        name: agent_name,
        kind: ExtensionKind::Agent,
        level: level.clone(),
        source_file: format!("agents/{}", name_str),
        description,
        content,
        front_matter,
        file_path: Some(abs_path),
    })
}

fn level_label(level: &ConfigLevel) -> &'static str {
    match level {
        ConfigLevel::User => "user",
        ConfigLevel::Project => "project",
    }
}

/// Discover all extensions (MCP servers, skills, agents, allowed tools) across
/// user-level and project-level config locations.
pub fn discover_extensions(project_dir: &str) -> Vec<ClaudeExtension> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();
    if home.is_empty() {
        return vec![];
    }
    let home_path = PathBuf::from(&home);
    let claude_home = home_path.join(".claude");
    let project_path = PathBuf::from(project_dir);
    let project_claude = project_path.join(".claude");

    let mut all = Vec::new();

    // ════════ User-level ════════

    // User settings files
    let user_settings = claude_home.join("settings.json");
    if user_settings.exists() {
        all.extend(parse_settings_file(
            &user_settings,
            ConfigLevel::User,
            "settings.json",
        ));
    }

    let user_settings_local = claude_home.join("settings.local.json");
    if user_settings_local.exists() {
        all.extend(parse_settings_file(
            &user_settings_local,
            ConfigLevel::User,
            "settings.local.json",
        ));
    }

    // User MCP servers from ~/.claude.json
    let user_claude_json = home_path.join(".claude.json");
    if user_claude_json.exists() {
        if let Ok(content) = std::fs::read_to_string(&user_claude_json) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                extract_mcp_servers(
                    &json,
                    &user_claude_json,
                    &ConfigLevel::User,
                    ".claude.json",
                    &mut all,
                );
            }
        }
    }

    // User commands (slash commands)
    let user_commands = claude_home.join("commands");
    if user_commands.is_dir() {
        all.extend(scan_commands_dir(&user_commands, ConfigLevel::User));
    }

    // User skills
    let user_skills = claude_home.join("skills");
    if user_skills.is_dir() {
        all.extend(scan_skills_dir(&user_skills, ConfigLevel::User));
    }

    // User agents
    let user_agents = claude_home.join("agents");
    if user_agents.is_dir() {
        all.extend(scan_agents_dir(&user_agents, ConfigLevel::User));
    }

    // ════════ Project-level ════════

    // Project settings files
    let proj_settings = project_claude.join("settings.json");
    if proj_settings.exists() {
        all.extend(parse_settings_file(
            &proj_settings,
            ConfigLevel::Project,
            "settings.json",
        ));
    }

    let proj_settings_local = project_claude.join("settings.local.json");
    if proj_settings_local.exists() {
        all.extend(parse_settings_file(
            &proj_settings_local,
            ConfigLevel::Project,
            "settings.local.json",
        ));
    }

    // Project MCP servers from {project}/.mcp.json
    let proj_mcp_json = project_path.join(".mcp.json");
    if proj_mcp_json.exists() {
        if let Ok(content) = std::fs::read_to_string(&proj_mcp_json) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                extract_mcp_servers(
                    &json,
                    &proj_mcp_json,
                    &ConfigLevel::Project,
                    ".mcp.json",
                    &mut all,
                );
            }
        }
    }

    // Project commands (slash commands)
    let proj_commands = project_claude.join("commands");
    if proj_commands.is_dir() {
        all.extend(scan_commands_dir(&proj_commands, ConfigLevel::Project));
    }

    // Project skills
    let proj_skills = project_claude.join("skills");
    if proj_skills.is_dir() {
        all.extend(scan_skills_dir(&proj_skills, ConfigLevel::Project));
    }

    // Project agents
    let proj_agents = project_claude.join("agents");
    if proj_agents.is_dir() {
        all.extend(scan_agents_dir(&proj_agents, ConfigLevel::Project));
    }

    // Sort: project items first, then user; within each level sort by kind then name
    all.sort_by(|a, b| {
        let level_ord = |l: &ConfigLevel| match l {
            ConfigLevel::Project => 0,
            ConfigLevel::User => 1,
        };
        let kind_ord = |k: &ExtensionKind| match k {
            ExtensionKind::McpServer => 0,
            ExtensionKind::Skill => 1,
            ExtensionKind::Agent => 2,
            ExtensionKind::AllowedTool => 3,
        };
        level_ord(&a.level)
            .cmp(&level_ord(&b.level))
            .then(kind_ord(&a.kind).cmp(&kind_ord(&b.kind)))
            .then(a.name.cmp(&b.name))
    });

    all
}
