use std::path::PathBuf;

use crate::data::projects::{discover_orphaned_projects, discover_projects, ProjectInfo};

fn get_home_dir_str() -> String {
    std::env::var("USERPROFILE")
        .unwrap_or_else(|_| std::env::var("HOME").unwrap_or_default())
        .replace('\\', "/")
}

fn get_claude_home() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .unwrap_or_else(|_| std::env::var("HOME").unwrap_or_default());
    PathBuf::from(home).join(".claude")
}

#[tauri::command]
pub async fn cmd_get_home_dir() -> Result<String, String> {
    Ok(get_home_dir_str())
}

#[tauri::command]
pub async fn cmd_list_projects() -> Result<Vec<ProjectInfo>, String> {
    let claude_home = get_claude_home();
    discover_projects(&claude_home).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_list_orphaned_projects() -> Result<Vec<ProjectInfo>, String> {
    let claude_home = get_claude_home();
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
    if !p.exists() {
        return Err("File not found".to_string());
    }
    std::fs::read_to_string(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_delete_project(id: String) -> Result<(), String> {
    let claude_home = get_claude_home();
    let project_dir = claude_home.join("projects").join(&id);
    if !project_dir.exists() {
        return Ok(());
    }
    std::fs::remove_dir_all(&project_dir).map_err(|e| e.to_string())
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
