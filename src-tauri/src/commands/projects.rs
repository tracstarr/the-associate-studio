use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::data::path_encoding::encode_project_path;
use crate::data::projects::{discover_orphaned_projects, discover_projects, ProjectInfo};

// ---- Per-project IDE settings ----

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    pub docs_folder: Option<String>,
}

fn get_home_dir_str() -> Result<String, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Neither USERPROFILE nor HOME environment variable is set".to_string())?;
    if home.is_empty() {
        return Err("Home directory environment variable is empty".to_string());
    }
    Ok(home.replace('\\', "/"))
}

fn get_claude_home() -> Result<PathBuf, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "Neither USERPROFILE nor HOME environment variable is set".to_string())?;
    if home.is_empty() {
        return Err("Home directory environment variable is empty".to_string());
    }
    Ok(PathBuf::from(home).join(".claude"))
}

#[tauri::command]
pub async fn cmd_get_home_dir() -> Result<String, String> {
    get_home_dir_str()
}

#[tauri::command]
pub async fn cmd_list_projects() -> Result<Vec<ProjectInfo>, String> {
    let claude_home = get_claude_home()?;
    discover_projects(&claude_home).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_list_orphaned_projects() -> Result<Vec<ProjectInfo>, String> {
    let claude_home = get_claude_home()?;
    discover_orphaned_projects(&claude_home).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_pick_folder() -> Result<Option<String>, String> {
    let result = tokio::task::spawn_blocking(|| rfd::FileDialog::new().pick_folder())
        .await
        .map_err(|e| e.to_string())?;

    Ok(result.map(|p| p.to_string_lossy().replace('\\', "/")))
}

#[tauri::command]
pub async fn cmd_read_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    // Reject paths containing .. components to prevent path traversal
    for component in p.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err("Invalid path: '..' components are not allowed".to_string());
        }
    }
    if !p.exists() {
        return Err("File not found".to_string());
    }
    std::fs::read_to_string(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_write_file(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    // Reject paths containing .. components to prevent path traversal
    for component in p.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err("Invalid path: '..' components are not allowed".to_string());
        }
    }
    std::fs::write(&p, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_delete_project(id: String) -> Result<(), String> {
    let claude_home = get_claude_home()?;
    let projects_dir = claude_home.join("projects");
    let project_dir = projects_dir.join(&id);
    // Canonicalize to resolve symlinks and .. components, then verify containment
    let canonical = project_dir
        .canonicalize()
        .map_err(|_| "Project directory not found".to_string())?;
    let canonical_parent = projects_dir
        .canonicalize()
        .map_err(|_| "Projects directory not found".to_string())?;
    if !canonical.starts_with(&canonical_parent) {
        return Err("Invalid project id: path traversal detected".to_string());
    }
    std::fs::remove_dir_all(&canonical).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_run_claude_init(project_path: String) -> Result<String, String> {
    let dir = PathBuf::from(&project_path);
    if !dir.exists() {
        return Err(format!("Directory does not exist: {}", project_path));
    }

    let output = tokio::task::spawn_blocking(move || {
        crate::utils::silent_command("claude")
            .args(["-p", "/init", "--dangerously-skip-permissions"])
            .current_dir(&dir)
            .env_remove("CLAUDECODE")
            .output()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to run claude: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}{}", stdout, stderr);

    if output.status.success() {
        Ok(combined)
    } else {
        Err(if combined.trim().is_empty() {
            format!("claude init exited with code {}", output.status)
        } else {
            combined.trim().to_string()
        })
    }
}

#[tauri::command]
pub async fn cmd_get_project_settings(project_path: String) -> Result<ProjectSettings, String> {
    let claude_home = get_claude_home()?;
    let encoded = encode_project_path(&PathBuf::from(&project_path));
    let settings_path = claude_home.join("projects").join(&encoded).join("ide-settings.json");

    if !settings_path.exists() {
        return Ok(ProjectSettings::default());
    }

    let content = std::fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_set_project_settings(project_path: String, settings: ProjectSettings) -> Result<(), String> {
    let claude_home = get_claude_home()?;
    let encoded = encode_project_path(&PathBuf::from(&project_path));
    let project_dir = claude_home.join("projects").join(&encoded);
    std::fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;
    let settings_path = project_dir.join("ide-settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&settings_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_run_docs_index_gen(project_path: String, docs_folder: String) -> Result<String, String> {
    let dir = PathBuf::from(&project_path);
    if !dir.exists() {
        return Err(format!("Directory does not exist: {}", project_path));
    }

    let prompt = format!(
        "Analyze the documentation files in the `{docs_folder}` directory and create a comprehensive \
        `{docs_folder}/index.md` table of contents. List every file with a brief one-line description, \
        group related docs into logical sections, and include relative markdown links to each file. \
        The file should serve as the entry-point for navigating the documentation. \
        Write the file to disk as `{docs_folder}/index.md`.",
        docs_folder = docs_folder
    );

    let output = tokio::task::spawn_blocking(move || {
        crate::utils::silent_command("claude")
            .args(["-p", &prompt, "--dangerously-skip-permissions"])
            .current_dir(&dir)
            .env_remove("CLAUDECODE")
            .output()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to run claude: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}{}", stdout, stderr);

    if output.status.success() {
        Ok(combined)
    } else {
        Err(if combined.trim().is_empty() {
            format!("claude docs index gen exited with code {}", output.status)
        } else {
            combined.trim().to_string()
        })
    }
}

#[tauri::command]
pub async fn cmd_run_readme_gen(project_path: String) -> Result<String, String> {
    let dir = PathBuf::from(&project_path);
    if !dir.exists() {
        return Err(format!("Directory does not exist: {}", project_path));
    }

    let output = tokio::task::spawn_blocking(move || {
        crate::utils::silent_command("claude")
            .args([
                "-p",
                "Analyze this project's structure, code, and configuration files, then create a comprehensive README.md file in the current directory. Include: a project title and concise description, key features, technology stack, installation and setup instructions (based on actual build files found), usage examples, and any other sections relevant to this project. Base everything strictly on what you find in the codebase — do not invent features, commands, or dependencies that don't exist. Write the file to disk as README.md.",
                "--dangerously-skip-permissions",
            ])
            .current_dir(&dir)
            .env_remove("CLAUDECODE")
            .output()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to run claude: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}{}", stdout, stderr);

    if output.status.success() {
        Ok(combined)
    } else {
        Err(if combined.trim().is_empty() {
            format!("claude readme gen exited with code {}", output.status)
        } else {
            combined.trim().to_string()
        })
    }
}
