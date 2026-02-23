use serde::{Deserialize, Serialize};
use crate::utils::silent_command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub author: String,
    pub url: String,
    pub created_at: String,
    pub body: Option<String>,
    #[serde(default)]
    pub labels: Vec<String>,
    pub draft: bool,
    pub head_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Issue {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub author: String,
    pub url: String,
    pub created_at: String,
    pub body: Option<String>,
    #[serde(default)]
    pub labels: Vec<String>,
}

#[tauri::command]
pub async fn cmd_list_prs(cwd: String, state: String) -> Result<Vec<PullRequest>, String> {
    let state_arg = match state.as_str() {
        "open" | "closed" | "merged" | "all" => state.as_str(),
        _ => "open",
    };

    let output = silent_command("gh")
        .args([
            "pr",
            "list",
            "--json",
            "number,title,state,author,url,createdAt,body,labels,isDraft,headRefName",
            "--limit",
            "50",
            "--state",
            state_arg,
        ])
        .current_dir(&cwd)
        .output()
        .map_err(|e| {
            format!(
                "gh not found or failed: {}. Install GitHub CLI from https://cli.github.com",
                e
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gh pr list failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    #[derive(Deserialize)]
    struct GhPr {
        number: u32,
        title: String,
        state: String,
        author: GhAuthor,
        url: String,
        #[serde(rename = "createdAt")]
        created_at: String,
        body: Option<String>,
        labels: Vec<GhLabel>,
        #[serde(rename = "isDraft")]
        is_draft: bool,
        #[serde(rename = "headRefName")]
        head_ref_name: String,
    }

    #[derive(Deserialize)]
    struct GhAuthor {
        login: String,
    }

    #[derive(Deserialize)]
    struct GhLabel {
        name: String,
    }

    let prs: Vec<GhPr> =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse gh output: {}", e))?;

    Ok(prs
        .into_iter()
        .map(|p| PullRequest {
            number: p.number,
            title: p.title,
            state: p.state.to_lowercase(),
            author: p.author.login,
            url: p.url,
            created_at: p.created_at,
            body: p.body,
            labels: p.labels.into_iter().map(|l| l.name).collect(),
            draft: p.is_draft,
            head_ref: p.head_ref_name,
        })
        .collect())
}

#[tauri::command]
pub async fn cmd_list_issues(cwd: String, state: String) -> Result<Vec<Issue>, String> {
    let state_arg = match state.as_str() {
        "open" | "closed" | "all" => state.as_str(),
        _ => "open",
    };

    let output = silent_command("gh")
        .args([
            "issue",
            "list",
            "--json",
            "number,title,state,author,url,createdAt,body,labels",
            "--limit",
            "50",
            "--state",
            state_arg,
        ])
        .current_dir(&cwd)
        .output()
        .map_err(|e| {
            format!(
                "gh not found: {}. Install from https://cli.github.com",
                e
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gh issue list failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    #[derive(Deserialize)]
    struct GhIssue {
        number: u32,
        title: String,
        state: String,
        author: GhAuthor,
        url: String,
        #[serde(rename = "createdAt")]
        created_at: String,
        body: Option<String>,
        labels: Vec<GhLabel>,
    }

    #[derive(Deserialize)]
    struct GhAuthor {
        login: String,
    }

    #[derive(Deserialize)]
    struct GhLabel {
        name: String,
    }

    let issues: Vec<GhIssue> =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse gh output: {}", e))?;

    Ok(issues
        .into_iter()
        .map(|i| Issue {
            number: i.number,
            title: i.title,
            state: i.state.to_lowercase(),
            author: i.author.login,
            url: i.url,
            created_at: i.created_at,
            body: i.body,
            labels: i.labels.into_iter().map(|l| l.name).collect(),
        })
        .collect())
}
