use std::path::PathBuf;
use crate::utils::silent_command;
use serde_json;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteRunResult {
    pub run_id: u64,
    pub run_url: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRunStatus {
    pub status: String,             // "queued" | "in_progress" | "completed"
    pub conclusion: Option<String>, // "success" | "failure" | "cancelled" | null
    pub url: String,
}

/// Returns true if .github/workflows/remote-run.yml exists in the project.
#[tauri::command]
pub async fn cmd_check_remote_run_workflow(cwd: String) -> Result<bool, String> {
    let path = PathBuf::from(&cwd)
        .join(".github")
        .join("workflows")
        .join("remote-run.yml");
    Ok(path.exists())
}

/// Returns true if .github/workflows/scheduled-remote-run.yml exists in the project.
#[tauri::command]
pub async fn cmd_check_scheduled_workflow(cwd: String) -> Result<bool, String> {
    let path = PathBuf::from(&cwd)
        .join(".github")
        .join("workflows")
        .join("scheduled-remote-run.yml");
    Ok(path.exists())
}

/// Runs `gh workflow run remote-run.yml` with the given issue inputs, then resolves the run ID.
#[tauri::command]
pub async fn cmd_trigger_remote_run(
    cwd: String,
    issue_number: String,
    issue_type: String,
) -> Result<RemoteRunResult, String> {
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

    if !output.status.success() {
        if combined.contains("could not find any workflows") {
            return Err("Workflow not found on remote. Commit and push .github/workflows/remote-run.yml first.".into());
        } else {
            return Err(combined);
        }
    }

    // Workflow triggered — retry up to 3 times (2s apart) to resolve the run ID.
    let mut last_run: Option<RemoteRunResult> = None;
    for _ in 0..3 {
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        let dir2 = PathBuf::from(&cwd);
        let list_output = tokio::task::spawn_blocking(move || {
            silent_command("gh")
                .args([
                    "run",
                    "list",
                    "--workflow=remote-run.yml",
                    "--limit=5",
                    "--json",
                    "databaseId,status,conclusion,url,createdAt",
                ])
                .current_dir(&dir2)
                .output()
        })
        .await
        .map_err(|e| format!("Task error: {}", e))?
        .map_err(|e| format!("Failed to run gh: {}", e))?;

        if list_output.status.success() {
            let json: serde_json::Value = serde_json::from_slice(&list_output.stdout)
                .unwrap_or(serde_json::Value::Array(vec![]));
            if let Some(arr) = json.as_array() {
                if !arr.is_empty() {
                    // Pick entry with max createdAt (ISO 8601 sorts lexicographically)
                    let best = arr.iter().max_by_key(|v| {
                        v.get("createdAt").and_then(|c| c.as_str()).unwrap_or("")
                    });
                    if let Some(run) = best {
                        let run_id = run.get("databaseId").and_then(|id| id.as_u64());
                        let run_url = run
                            .get("url")
                            .and_then(|u| u.as_str())
                            .map(|s| s.to_string());
                        if let (Some(id), Some(url)) = (run_id, run_url) {
                            last_run = Some(RemoteRunResult { run_id: id, run_url: url });
                            break;
                        }
                    }
                }
            }
        }
    }

    match last_run {
        Some(result) => Ok(result),
        None => Err("Workflow triggered but could not resolve run ID.".into()),
    }
}

/// Returns the current status of a workflow run by ID.
#[tauri::command]
pub async fn cmd_get_remote_run_status(
    cwd: String,
    run_id: u64,
) -> Result<WorkflowRunStatus, String> {
    let dir = PathBuf::from(&cwd);
    let run_id_str = run_id.to_string();
    let output = tokio::task::spawn_blocking(move || {
        silent_command("gh")
            .args(["run", "view", &run_id_str, "--json", "status,conclusion,url"])
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

    let status = json
        .get("status")
        .and_then(|s| s.as_str())
        .unwrap_or("")
        .to_string();
    let conclusion = json
        .get("conclusion")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());
    let url = json
        .get("url")
        .and_then(|u| u.as_str())
        .unwrap_or("")
        .to_string();

    Ok(WorkflowRunStatus { status, conclusion, url })
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

/// Creates (or updates) the three labels used by the scheduled remote run workflow.
/// Uses `--force` so the command is idempotent — safe to call even if labels already exist.
#[tauri::command]
pub async fn cmd_ensure_scheduled_labels(cwd: String) -> Result<(), String> {
    let labels = [
        ("scheduled-run",      "0075ca", "Queued for scheduled Claude remote run"),
        ("scheduled-running",  "e4e669", "Claude remote run in progress"),
        ("scheduled-complete", "0e8a16", "Claude remote run completed"),
    ];

    let dir = PathBuf::from(&cwd);

    for (name, color, description) in &labels {
        let dir2 = dir.clone();
        let name = name.to_string();
        let color = color.to_string();
        let description = description.to_string();

        tokio::task::spawn_blocking(move || {
            silent_command("gh")
                .args([
                    "label", "create", &name,
                    "--color", &color,
                    "--description", &description,
                    "--force",
                ])
                .current_dir(&dir2)
                .output()
        })
        .await
        .map_err(|e| format!("Task error: {}", e))?
        .map_err(|e| format!("Failed to run gh: {}", e))?;
        // Ignore non-zero exit (e.g. not a GitHub repo) — labels are best-effort.
    }

    Ok(())
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
