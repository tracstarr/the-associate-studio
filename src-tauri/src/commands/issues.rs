use serde::{Deserialize, Serialize};
use crate::utils::silent_command;

const KEYRING_SERVICE: &str = "the-associate-studio";

fn get_linear_api_key() -> Option<String> {
    keyring::Entry::new(KEYRING_SERVICE, "linear-api-key")
        .ok()?
        .get_password()
        .ok()
}

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
    pub identifier: Option<String>,
    pub title: String,
    pub state: String,
    pub author: String,
    pub url: String,
    pub created_at: String,
    pub body: Option<String>,
    #[serde(default)]
    pub labels: Vec<String>,
    pub source: String,
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
            identifier: None,
            title: i.title,
            state: i.state.to_lowercase(),
            author: i.author.login,
            url: i.url,
            created_at: i.created_at,
            body: i.body,
            labels: i.labels.into_iter().map(|l| l.name).collect(),
            source: "github".to_string(),
        })
        .collect())
}

#[tauri::command]
pub async fn cmd_list_linear_issues(state: String) -> Result<Vec<Issue>, String> {
    let api_key = match get_linear_api_key() {
        Some(k) => k,
        None => return Ok(vec![]),
    };

    let gql_query = r#"
        query IssueList($filter: IssueFilter) {
          issues(first: 50, filter: $filter, orderBy: updatedAt) {
            nodes {
              id identifier title
              state { name type }
              creator { name }
              url createdAt
              labels { nodes { name } }
            }
          }
        }
    "#;

    let variables: serde_json::Value = match state.as_str() {
        "open" => serde_json::json!({
            "filter": { "state": { "type": { "in": ["triage", "backlog", "unstarted", "started"] } } }
        }),
        "closed" => serde_json::json!({
            "filter": { "state": { "type": { "in": ["completed", "cancelled"] } } }
        }),
        _ => serde_json::json!({}),
    };

    let body = serde_json::json!({ "query": gql_query, "variables": variables });

    let client = reqwest::Client::new();
    let res = client
        .post("https://api.linear.app/graphql")
        .header("Authorization", &api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Linear API request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Linear API returned status {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    #[derive(Deserialize)]
    struct LinearIssue {
        identifier: String,
        title: String,
        state: LinearState,
        creator: Option<LinearUser>,
        url: String,
        #[serde(rename = "createdAt")]
        created_at: String,
        labels: LinearLabelConnection,
    }

    #[derive(Deserialize)]
    struct LinearState {
        #[serde(rename = "type")]
        state_type: String,
    }

    #[derive(Deserialize)]
    struct LinearUser {
        name: String,
    }

    #[derive(Deserialize)]
    struct LinearLabelConnection {
        nodes: Vec<LinearLabel>,
    }

    #[derive(Deserialize)]
    struct LinearLabel {
        name: String,
    }

    // Surface GraphQL-level errors (e.g. revoked credentials, query failures) that arrive as HTTP 200
    if let Some(errors) = json["errors"].as_array() {
        let msg = errors
            .first()
            .and_then(|e| e["message"].as_str())
            .unwrap_or("unknown GraphQL error");
        return Err(format!("Linear GraphQL error: {}", msg));
    }

    let nodes = json["data"]["issues"]["nodes"]
        .as_array()
        .ok_or_else(|| "Linear GraphQL response missing data.issues.nodes".to_string())?
        .clone();

    let issues: Vec<Issue> = nodes
        .into_iter()
        .filter_map(|n| serde_json::from_value::<LinearIssue>(n).ok())
        .map(|i| {
            let state_str = match i.state.state_type.as_str() {
                "completed" | "cancelled" => "closed",
                _ => "open",
            };
            Issue {
                number: 0,
                identifier: Some(i.identifier),
                title: i.title,
                state: state_str.to_string(),
                author: i.creator.map(|u| u.name).unwrap_or_default(),
                url: i.url,
                created_at: i.created_at,
                body: None,
                labels: i.labels.nodes.into_iter().map(|l| l.name).collect(),
                source: "linear".to_string(),
            }
        })
        .collect();

    Ok(issues)
}
