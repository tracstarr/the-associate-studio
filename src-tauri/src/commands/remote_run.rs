use std::path::PathBuf;
use crate::utils::silent_command;
use serde_json;

/// Returns true if .github/workflows/remote-run.yml exists in the project.
#[tauri::command]
pub async fn cmd_check_remote_run_workflow(cwd: String) -> Result<bool, String> {
    let path = PathBuf::from(&cwd)
        .join(".github")
        .join("workflows")
        .join("remote-run.yml");
    Ok(path.exists())
}

/// Runs `gh workflow run remote-run.yml` with the given issue inputs.
#[tauri::command]
pub async fn cmd_trigger_remote_run(
    cwd: String,
    issue_number: String,
    issue_type: String,
) -> Result<String, String> {
    if !matches!(issue_type.as_str(), "github" | "jira" | "linear") {
        return Err(format!("Invalid issue_type: {}", issue_type));
    }
    if issue_number.is_empty()
        || !issue_number
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
    {
        return Err(format!("Invalid issue_number: {}", issue_number));
    }

    let dir = PathBuf::from(&cwd);
    let issue_number_clone = issue_number.clone();
    let issue_type_clone = issue_type.clone();

    let output = tokio::task::spawn_blocking(move || {
        silent_command("gh")
            .args([
                "workflow",
                "run",
                "remote-run.yml",
                "--field",
                &format!("issue_number={}", issue_number_clone),
                "--field",
                &format!("issue_type={}", issue_type_clone),
            ])
            .current_dir(&dir)
            .output()
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
    .map_err(|e| format!("Failed to run gh: {}", e))?;

    let out = String::from_utf8_lossy(&output.stdout).to_string();
    let err = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}{}", out, err).trim().to_string();

    if output.status.success() {
        Ok(if combined.is_empty() {
            "Workflow triggered.".into()
        } else {
            combined
        })
    } else if combined.contains("could not find any workflows") {
        Err("Workflow not found on remote. Commit and push .github/workflows/remote-run.yml first.".into())
    } else {
        Err(combined)
    }
}

/// Returns the list of secret names already set on the repo (values are never exposed by GitHub).
#[tauri::command]
pub async fn cmd_list_repo_secrets(cwd: String) -> Result<Vec<String>, String> {
    let dir = PathBuf::from(&cwd);
    let output = tokio::task::spawn_blocking(move || {
        silent_command("gh")
            .args(["secret", "list", "--json", "name"])
            .current_dir(&dir)
            .output()
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
    .map_err(|e| format!("Failed to run gh: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(err);
    }
    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Parse error: {}", e))?;
    let names = json
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.get("name")?.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    Ok(names)
}

/// Sets a single GitHub Actions secret by piping the value via stdin (avoids secret appearing in args).
#[tauri::command]
pub async fn cmd_set_repo_secret(cwd: String, name: String, value: String) -> Result<(), String> {
    if name.is_empty() || !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err(format!("Invalid secret name: {}", name));
    }
    let dir = PathBuf::from(&cwd);
    let output = tokio::task::spawn_blocking(move || {
        use std::io::Write;
        let mut child = silent_command("gh")
            .args(["secret", "set", &name])
            .current_dir(&dir)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?;
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(value.as_bytes());
        }
        child.wait_with_output()
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
    .map_err(|e| format!("Failed to run gh: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}
