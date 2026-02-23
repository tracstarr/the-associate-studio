use std::path::PathBuf;

use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::data::sessions::load_sessions;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub id: String,
    pub path: String,
    pub name: String,
    pub session_count: usize,
    pub last_modified: Option<String>,
    pub is_worktree: bool,
}

/// Discover all projects from ~/.claude/projects/
pub fn discover_projects(claude_home: &PathBuf) -> Result<Vec<ProjectInfo>> {
    let projects_dir = claude_home.join("projects");
    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();

    for entry in std::fs::read_dir(&projects_dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let dir_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) if !n.is_empty() && !n.starts_with('.') => n.to_string(),
            _ => continue,
        };

        // Load sessions to find the canonical project_path
        let sessions = load_sessions(&path).unwrap_or_default();

        let project_path = sessions
            .iter()
            .filter(|s| s.is_sidechain != Some(true))
            .filter_map(|s| s.project_path.as_deref())
            .find(|p| !p.is_empty())
            .map(|p| p.replace('\\', "/"))
            .unwrap_or_else(|| decode_dir_name(&dir_name));

        // Skip projects whose directory no longer exists on disk
        if !PathBuf::from(&project_path).exists() {
            continue;
        }

        let name = PathBuf::from(&project_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&dir_name)
            .to_string();

        let session_count = sessions
            .iter()
            .filter(|s| s.is_sidechain != Some(true))
            .count();

        // A git worktree has .git as a file (not a directory)
        let is_worktree = PathBuf::from(&project_path).join(".git").is_file();

        let last_modified = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
                    .to_string()
            });

        projects.push(ProjectInfo {
            id: dir_name,
            path: project_path,
            name,
            session_count,
            last_modified,
            is_worktree,
        });
    }

    // Sort by last_modified descending (most recent first)
    projects.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    Ok(projects)
}

/// Discover orphaned projects — entries in ~/.claude/projects/ whose real
/// code directory no longer exists on disk.
pub fn discover_orphaned_projects(claude_home: &PathBuf) -> Result<Vec<ProjectInfo>> {
    let projects_dir = claude_home.join("projects");
    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let mut orphans = Vec::new();

    for entry in std::fs::read_dir(&projects_dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let dir_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) if !n.is_empty() && !n.starts_with('.') => n.to_string(),
            _ => continue,
        };

        let sessions = load_sessions(&path).unwrap_or_default();

        let project_path = sessions
            .iter()
            .filter(|s| s.is_sidechain != Some(true))
            .filter_map(|s| s.project_path.as_deref())
            .find(|p| !p.is_empty())
            .map(|p| p.replace('\\', "/"))
            .unwrap_or_else(|| decode_dir_name(&dir_name));

        // Only include projects whose directory does NOT exist
        if PathBuf::from(&project_path).exists() {
            continue;
        }

        let name = PathBuf::from(&project_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&dir_name)
            .to_string();

        let session_count = sessions
            .iter()
            .filter(|s| s.is_sidechain != Some(true))
            .count();

        let last_modified = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
                    .to_string()
            });

        orphans.push(ProjectInfo {
            id: dir_name,
            path: project_path,
            name,
            session_count,
            last_modified,
            is_worktree: false, // orphaned projects don't exist on disk; can't detect
        });
    }

    orphans.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    Ok(orphans)
}

/// Best-effort decode of an encoded project dir name back to a path.
/// Example: C--dev-ide → C:/dev/ide
fn decode_dir_name(dir_name: &str) -> String {
    if let Some(pos) = dir_name.find("--") {
        let drive = &dir_name[..pos];
        let rest = dir_name[pos + 2..].replace('-', "/");
        format!("{}:/{}", drive, rest)
    } else {
        dir_name.replace('-', "/")
    }
}
