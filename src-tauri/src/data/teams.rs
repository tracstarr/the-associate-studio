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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn setup_team(tmp: &std::path::Path, name: &str, config_json: &str) {
        let team_dir = tmp.join("teams").join(name);
        std::fs::create_dir_all(&team_dir).unwrap();
        std::fs::write(team_dir.join("config.json"), config_json).unwrap();
    }

    #[test]
    fn test_load_teams_empty() {
        let tmp = tempfile::tempdir().unwrap();
        let teams = load_teams(tmp.path(), None).unwrap();
        assert!(teams.is_empty());
    }

    #[test]
    fn test_load_teams_no_filter() {
        let tmp = tempfile::tempdir().unwrap();
        setup_team(
            tmp.path(),
            "team-alpha",
            r#"{"name":"Alpha","members":[{"name":"Agent A"}]}"#,
        );
        setup_team(
            tmp.path(),
            "team-beta",
            r#"{"name":"Beta","members":[{"name":"Agent B"}]}"#,
        );

        let teams = load_teams(tmp.path(), None).unwrap();
        assert_eq!(teams.len(), 2);
        // sorted alphabetically
        assert_eq!(teams[0].dir_name, "team-alpha");
        assert_eq!(teams[1].dir_name, "team-beta");
    }

    #[test]
    fn test_load_teams_with_cwd_filter_match() {
        let tmp = tempfile::tempdir().unwrap();
        setup_team(
            tmp.path(),
            "team-match",
            r#"{"name":"Match","members":[{"name":"A","cwd":"/dev/my-project"}]}"#,
        );
        setup_team(
            tmp.path(),
            "team-other",
            r#"{"name":"Other","members":[{"name":"B","cwd":"/dev/other"}]}"#,
        );

        let teams = load_teams(tmp.path(), Some(&PathBuf::from("/dev/my-project"))).unwrap();
        assert_eq!(teams.len(), 1);
        assert_eq!(teams[0].dir_name, "team-match");
    }

    #[test]
    fn test_load_teams_falls_back_when_no_cwd_match() {
        let tmp = tempfile::tempdir().unwrap();
        setup_team(
            tmp.path(),
            "team-a",
            r#"{"name":"A","members":[{"name":"Agent","cwd":"/somewhere/else"}]}"#,
        );

        // No match for /dev/nonexistent => falls back to all teams
        let teams = load_teams(tmp.path(), Some(&PathBuf::from("/dev/nonexistent"))).unwrap();
        assert_eq!(teams.len(), 1);
    }

    #[test]
    fn test_team_without_config_but_with_inboxes() {
        let tmp = tempfile::tempdir().unwrap();
        let team_dir = tmp.path().join("teams").join("inbox-team");
        std::fs::create_dir_all(team_dir.join("inboxes")).unwrap();

        let teams = load_teams(tmp.path(), None).unwrap();
        assert_eq!(teams.len(), 1);
        assert_eq!(teams[0].dir_name, "inbox-team");
        assert!(teams[0].config.name.is_none()); // default config
    }

    #[test]
    fn test_team_dir_without_config_or_inboxes_skipped() {
        let tmp = tempfile::tempdir().unwrap();
        let team_dir = tmp.path().join("teams").join("empty-team");
        std::fs::create_dir_all(&team_dir).unwrap();

        let teams = load_teams(tmp.path(), None).unwrap();
        assert!(teams.is_empty());
    }
}
