use crate::data::hook_state::{build_active_sessions, parse_hook_events, ActiveSession};
use serde_json::Value;

fn get_claude_home() -> std::path::PathBuf {
    let home = std::env::var("USERPROFILE")
        .unwrap_or_else(|_| std::env::var("HOME").unwrap_or_default());
    std::path::PathBuf::from(home).join(".claude")
}

/// Returns the hook command string: `node /path/to/hook.js`
/// Using a Node.js script file avoids cmd.exe double-quote quoting issues
/// that break inline PowerShell -Command strings when Claude CLI invokes
/// hooks via `cmd.exe /d /s /c "COMMAND"`.
fn hook_command(ide_dir: &std::path::Path) -> String {
    let hook_js = ide_dir.join("hook.js");
    // Use forward slashes — works on Windows and avoids backslash escaping
    let hook_js_path = hook_js.to_string_lossy().replace('\\', "/");
    format!("node {}", hook_js_path)
}

/// The Node.js script that reads stdin and appends the JSON line to hook-events.jsonl.
/// Written to ~/.claude/ide/hook.js by cmd_setup_hooks.
fn hook_js_content() -> &'static str {
    r#"'use strict';
var d = '';
process.stdin.on('data', function(c) { d += c; });
process.stdin.on('end', function() {
  var line = d.trim();
  if (!line) return;
  try {
    var path = require('path');
    var fs = require('fs');
    var home = process.env.USERPROFILE || process.env.HOME || '';
    var out = path.join(home, '.claude', 'ide', 'hook-events.jsonl');
    fs.appendFileSync(out, line + '\n');
  } catch(e) {}
});
"#
}

#[tauri::command]
pub fn cmd_setup_hooks() -> Result<(), String> {
    let claude_home = get_claude_home();
    let ide_dir = claude_home.join("ide");
    std::fs::create_dir_all(&ide_dir)
        .map_err(|e| format!("Failed to create ide dir: {}", e))?;

    // Write the Node.js hook script
    let hook_js_path = ide_dir.join("hook.js");
    std::fs::write(&hook_js_path, hook_js_content())
        .map_err(|e| format!("Failed to write hook.js: {}", e))?;

    // Touch hook-events.jsonl if it doesn't exist
    let hook_file = ide_dir.join("hook-events.jsonl");
    if !hook_file.exists() {
        std::fs::write(&hook_file, "")
            .map_err(|e| format!("Failed to create hook-events.jsonl: {}", e))?;
    }

    let settings_path = claude_home.join("settings.json");

    // Read existing settings
    let mut settings: Value = if settings_path.exists() {
        let content = std::fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read settings.json: {}", e))?;
        serde_json::from_str(&content).unwrap_or(Value::Object(serde_json::Map::new()))
    } else {
        Value::Object(serde_json::Map::new())
    };

    // Build our IDE hook group (one entry to add to each event's array)
    let cmd = hook_command(&ide_dir);
    let our_group = serde_json::json!({
        "hooks": [{
            "type": "command",
            "command": cmd
        }]
    });

    // Merge hooks into settings — APPEND to existing arrays, don't replace
    let hooks = settings
        .as_object_mut()
        .ok_or("settings.json is not an object")?
        .entry("hooks")
        .or_insert(Value::Object(serde_json::Map::new()))
        .as_object_mut()
        .ok_or("hooks is not an object")?;

    for event_name in &[
        "SessionStart",
        "SessionEnd",
        "SubagentStart",
        "SubagentStop",
        "Stop",
    ] {
        let event_arr = hooks
            .entry(event_name.to_string())
            .or_insert(Value::Array(vec![]));
        let arr = event_arr.as_array_mut().ok_or("hook event is not an array")?;
        // Only add if our command isn't already present
        let already_present = arr.iter().any(|group| {
            group
                .get("hooks")
                .and_then(|h| h.as_array())
                .map(|hs| hs.iter().any(|h| h.get("command").and_then(|c| c.as_str()) == Some(&cmd)))
                .unwrap_or(false)
        });
        if !already_present {
            arr.push(our_group.clone());
        }
    }

    let json_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    std::fs::write(&settings_path, json_str)
        .map_err(|e| format!("Failed to write settings.json: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn cmd_remove_hooks() -> Result<(), String> {
    let claude_home = get_claude_home();
    let ide_dir = claude_home.join("ide");
    let settings_path = claude_home.join("settings.json");

    if !settings_path.exists() {
        return Ok(());
    }

    let content = std::fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings.json: {}", e))?;
    let mut settings: Value =
        serde_json::from_str(&content).unwrap_or(Value::Object(serde_json::Map::new()));

    let cmd = hook_command(&ide_dir);
    if let Some(hooks) = settings.get_mut("hooks").and_then(|h| h.as_object_mut()) {
        for event_name in &[
            "SessionStart",
            "SessionEnd",
            "SubagentStart",
            "SubagentStop",
            "Stop",
        ] {
            if let Some(arr) = hooks.get_mut(*event_name).and_then(|v| v.as_array_mut()) {
                // Remove only our hook group, leave other groups intact
                arr.retain(|group| {
                    !group
                        .get("hooks")
                        .and_then(|h| h.as_array())
                        .map(|hs| hs.iter().any(|h| h.get("command").and_then(|c| c.as_str()) == Some(&cmd)))
                        .unwrap_or(false)
                });
            }
            // Remove the event key entirely if its array is now empty
            if hooks.get(*event_name).and_then(|v| v.as_array()).map(|a| a.is_empty()).unwrap_or(false) {
                hooks.remove(*event_name);
            }
        }
        if hooks.is_empty() {
            settings.as_object_mut().unwrap().remove("hooks");
        }
    }

    let json_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    std::fs::write(&settings_path, json_str)
        .map_err(|e| format!("Failed to write settings.json: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn cmd_get_active_sessions() -> Result<Vec<ActiveSession>, String> {
    let claude_home = get_claude_home();
    let hook_file = claude_home.join("ide").join("hook-events.jsonl");
    let events = parse_hook_events(&hook_file);
    let sessions_map = build_active_sessions(&events);
    Ok(sessions_map.into_values().collect())
}

#[tauri::command]
pub fn cmd_hooks_configured() -> Result<bool, String> {
    let claude_home = get_claude_home();
    let ide_dir = claude_home.join("ide");
    let settings_path = claude_home.join("settings.json");
    if !settings_path.exists() {
        return Ok(false);
    }
    let content = std::fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings.json: {}\n", e))?;
    let settings: Value = serde_json::from_str(&content).unwrap_or(Value::Null);
    let cmd = hook_command(&ide_dir);
    let configured = settings
        .get("hooks")
        .and_then(|h| h.get("SessionStart"))
        .and_then(|arr| arr.as_array())
        .map(|groups| {
            groups.iter().any(|group| {
                group
                    .get("hooks")
                    .and_then(|h| h.as_array())
                    .map(|hs| hs.iter().any(|h| h.get("command").and_then(|c| c.as_str()) == Some(&cmd)))
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false);
    Ok(configured)
}
