use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use crate::utils::silent_command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowFile {
    pub name: String,
    pub filename: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRun {
    pub id: u64,
    pub name: String,
    pub display_title: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub head_branch: String,
    pub created_at: String,
    pub url: String,
    pub workflow_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRunJob {
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRunDetail {
    pub id: u64,
    pub name: String,
    pub display_title: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub head_branch: String,
    pub created_at: String,
    pub url: String,
    pub jobs: Vec<WorkflowRunJob>,
}

/// List all workflow YAML files in `.github/workflows/`.
#[tauri::command]
pub async fn cmd_list_workflow_files(cwd: String) -> Result<Vec<WorkflowFile>, String> {
    let dir = PathBuf::from(&cwd).join(".github").join("workflows");
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut workflows = Vec::new();
    let entries = std::fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read workflows dir: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if !matches!(ext, "yml" | "yaml") {
            continue;
        }
        let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let full_path = path.to_string_lossy().to_string();

        // Try to extract workflow name from the YAML file
        let name = match std::fs::read_to_string(&path) {
            Ok(content) => extract_workflow_name(&content).unwrap_or_else(|| filename.clone()),
            Err(_) => filename.clone(),
        };

        workflows.push(WorkflowFile {
            name,
            filename,
            path: full_path,
        });
    }

    workflows.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(workflows)
}

fn extract_workflow_name(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("name:") {
            let name = trimmed.strip_prefix("name:")?.trim();
            // Strip surrounding quotes if present
            let name = name.trim_matches('"').trim_matches('\'');
            if !name.is_empty() {
                return Some(name.to_string());
            }
        }
    }
    None
}

/// List recent workflow runs, optionally filtered by workflow filename.
#[tauri::command]
pub async fn cmd_list_workflow_runs(
    cwd: String,
    workflow: Option<String>,
) -> Result<Vec<WorkflowRun>, String> {
    let dir = PathBuf::from(&cwd);
    let workflow_clone = workflow.clone();

    let output = tokio::task::spawn_blocking(move || {
        let mut args = vec![
            "run".to_string(),
            "list".to_string(),
            "--json".to_string(),
            "databaseId,name,displayTitle,status,conclusion,headBranch,createdAt,url,workflowName".to_string(),
            "--limit".to_string(),
            "30".to_string(),
        ];
        if let Some(wf) = &workflow_clone {
            args.push("--workflow".to_string());
            args.push(wf.clone());
        }
        silent_command("gh")
            .args(args.iter().map(|s| s.as_str()).collect::<Vec<_>>())
            .current_dir(&dir)
            .output()
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
    .map_err(|e| format!("gh not found or failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gh run list failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    #[derive(Deserialize)]
    struct GhRun {
        #[serde(rename = "databaseId")]
        database_id: u64,
        name: Option<String>,
        #[serde(rename = "displayTitle")]
        display_title: Option<String>,
        status: Option<String>,
        conclusion: Option<String>,
        #[serde(rename = "headBranch")]
        head_branch: Option<String>,
        #[serde(rename = "createdAt")]
        created_at: Option<String>,
        url: Option<String>,
        #[serde(rename = "workflowName")]
        workflow_name: Option<String>,
    }

    let runs: Vec<GhRun> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse gh output: {}", e))?;

    Ok(runs
        .into_iter()
        .map(|r| WorkflowRun {
            id: r.database_id,
            name: r.name.unwrap_or_default(),
            display_title: r.display_title.unwrap_or_default(),
            status: r.status.unwrap_or_default(),
            conclusion: r.conclusion,
            head_branch: r.head_branch.unwrap_or_default(),
            created_at: r.created_at.unwrap_or_default(),
            url: r.url.unwrap_or_default(),
            workflow_name: r.workflow_name.unwrap_or_default(),
        })
        .collect())
}

/// Get detailed info about a single workflow run including its jobs.
#[tauri::command]
pub async fn cmd_get_workflow_run_detail(
    cwd: String,
    run_id: u64,
) -> Result<WorkflowRunDetail, String> {
    let dir = PathBuf::from(&cwd);
    let run_id_str = run_id.to_string();

    let output = tokio::task::spawn_blocking(move || {
        silent_command("gh")
            .args([
                "run",
                "view",
                &run_id_str,
                "--json",
                "databaseId,name,displayTitle,status,conclusion,headBranch,createdAt,url,jobs",
            ])
            .current_dir(&dir)
            .output()
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
    .map_err(|e| format!("gh not found or failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gh run view failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    #[derive(Deserialize)]
    struct GhRunDetail {
        #[serde(rename = "databaseId")]
        database_id: u64,
        name: Option<String>,
        #[serde(rename = "displayTitle")]
        display_title: Option<String>,
        status: Option<String>,
        conclusion: Option<String>,
        #[serde(rename = "headBranch")]
        head_branch: Option<String>,
        #[serde(rename = "createdAt")]
        created_at: Option<String>,
        url: Option<String>,
        #[serde(default)]
        jobs: Vec<GhJob>,
    }

    #[derive(Deserialize)]
    struct GhJob {
        name: Option<String>,
        status: Option<String>,
        conclusion: Option<String>,
        #[serde(rename = "startedAt")]
        started_at: Option<String>,
        #[serde(rename = "completedAt")]
        completed_at: Option<String>,
    }

    let run: GhRunDetail = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse gh output: {}", e))?;

    Ok(WorkflowRunDetail {
        id: run.database_id,
        name: run.name.unwrap_or_default(),
        display_title: run.display_title.unwrap_or_default(),
        status: run.status.unwrap_or_default(),
        conclusion: run.conclusion,
        head_branch: run.head_branch.unwrap_or_default(),
        created_at: run.created_at.unwrap_or_default(),
        url: run.url.unwrap_or_default(),
        jobs: run
            .jobs
            .into_iter()
            .map(|j| WorkflowRunJob {
                name: j.name.unwrap_or_default(),
                status: j.status.unwrap_or_default(),
                conclusion: j.conclusion,
                started_at: j.started_at,
                completed_at: j.completed_at,
            })
            .collect(),
    })
}

/// Get the log output of a workflow run.
#[tauri::command]
pub async fn cmd_get_workflow_run_logs(
    cwd: String,
    run_id: u64,
) -> Result<String, String> {
    let dir = PathBuf::from(&cwd);
    let run_id_str = run_id.to_string();

    let output = tokio::task::spawn_blocking(move || {
        silent_command("gh")
            .args(["run", "view", &run_id_str, "--log"])
            .current_dir(&dir)
            .output()
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
    .map_err(|e| format!("gh not found or failed: {}", e))?;

    if !output.status.success() {
        // Fall back to --log-failed for completed failed runs
        let dir2 = PathBuf::from(&cwd);
        let run_id_str2 = run_id.to_string();
        let output2 = tokio::task::spawn_blocking(move || {
            silent_command("gh")
                .args(["run", "view", &run_id_str2, "--log-failed"])
                .current_dir(&dir2)
                .output()
        })
        .await
        .map_err(|e| format!("Task error: {}", e))?
        .map_err(|e| format!("gh not found or failed: {}", e))?;

        if output2.status.success() {
            return Ok(String::from_utf8_lossy(&output2.stdout).to_string());
        }

        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gh run view --log failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
