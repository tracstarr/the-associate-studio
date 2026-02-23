use std::path::Path;

use anyhow::Result;

use crate::models::team::{Team, TeamConfig};

/// Load all teams, optionally filtering by project CWD.
pub fn load_teams(claude_home: &Path, project_cwd: Option<&Path>) -> Result<Vec<Team>> {
    let teams_dir = claude_home.join("teams");
    if !teams_dir.exists() {
        return Ok(vec![]);
    }

    let mut teams = Vec::new();
    let mut had_cwd_match = false;

    let entries = std::fs::read_dir(&teams_dir)?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let dir_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let config_path = path.join("config.json");
        if !config_path.exists() {
            let inboxes_dir = path.join("inboxes");
            if inboxes_dir.exists() {
                teams.push(Team {
                    dir_name,
                    config: TeamConfig::default(),
                });
            }
            continue;
        }

        let data = match std::fs::read_to_string(&config_path) {
            Ok(d) => d,
            Err(_) => continue,
        };

        let config: TeamConfig = match serde_json::from_str(&data) {
            Ok(c) => c,
            Err(_) => continue,
        };

        if let Some(cwd) = project_cwd {
            let cwd_str = cwd.to_string_lossy().to_lowercase();
            let matches = config.members.iter().any(|m| {
                if let Some(ref member_cwd) = m.cwd {
                    let member_path = member_cwd.to_lowercase().replace('/', "\\");
                    let cwd_normalized = cwd_str.replace('/', "\\");
                    member_path == cwd_normalized
                        || member_path.starts_with(&format!("{}\\", cwd_normalized))
                } else {
                    false
                }
            });
            if !matches {
                continue;
            }
            had_cwd_match = true;
        }

        teams.push(Team { dir_name, config });
    }

    if !had_cwd_match && project_cwd.is_some() {
        return load_teams(claude_home, None);
    }

    teams.sort_by(|a, b| a.dir_name.cmp(&b.dir_name));
    Ok(teams)
}
