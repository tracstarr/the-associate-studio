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
    pub assignee: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PRComment {
    pub author: String,
    pub body: String,
    pub created_at: String,
    pub association: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PRReviewComment {
    pub author: String,
    pub body: String,
    pub created_at: String,
    pub path: Option<String>,
    pub diff_hunk: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PRDetail {
    pub number: u32,
    pub title: String,
    pub state: String,
    pub author: String,
    pub url: String,
    pub created_at: String,
    pub body: Option<String>,
    pub labels: Vec<String>,
    pub draft: bool,
    pub head_ref: String,
    pub base_ref: String,
    pub additions: u32,
    pub deletions: u32,
    pub changed_files: u32,
    pub mergeable: Option<String>,
    pub comments: Vec<PRComment>,
    pub review_comments: Vec<PRReviewComment>,
}

#[tauri::command]
pub async fn cmd_get_pr_detail(cwd: String, number: u32) -> Result<PRDetail, String> {
    // Fetch PR details via `gh pr view`
    let output = silent_command("gh")
        .args([
            "pr",
            "view",
            &number.to_string(),
            "--json",
            "number,title,state,author,url,createdAt,body,labels,isDraft,headRefName,baseRefName,additions,deletions,changedFiles,mergeStateStatus,comments,reviews",
        ])
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("gh not found or failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("gh pr view failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    #[derive(Deserialize)]
    struct GhPrDetail {
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
        #[serde(rename = "baseRefName")]
        base_ref_name: String,
        additions: u32,
        deletions: u32,
        #[serde(rename = "changedFiles")]
        changed_files: u32,
        #[serde(rename = "mergeStateStatus")]
        merge_state_status: Option<String>,
        comments: Vec<GhComment>,
        reviews: Vec<GhReview>,
    }

    #[derive(Deserialize)]
    struct GhAuthor {
        login: String,
    }

    #[derive(Deserialize)]
    struct GhLabel {
        name: String,
    }

    #[derive(Deserialize)]
    struct GhComment {
        author: GhAuthor,
        body: String,
        #[serde(rename = "createdAt")]
        created_at: String,
        #[serde(rename = "authorAssociation")]
        author_association: Option<String>,
    }

    #[derive(Deserialize)]
    struct GhReview {
        author: GhAuthor,
        body: String,
        #[serde(rename = "submittedAt")]
        submitted_at: Option<String>,
        state: String,
    }

    let pr: GhPrDetail =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse gh output: {}", e))?;

    let mut comments: Vec<PRComment> = pr
        .comments
        .into_iter()
        .map(|c| PRComment {
            author: c.author.login,
            body: c.body,
            created_at: c.created_at,
            association: c.author_association,
        })
        .collect();

    // Add reviews that have a body (non-empty review comments)
    for r in pr.reviews {
        if !r.body.is_empty() {
            comments.push(PRComment {
                author: r.author.login,
                body: format!("[{}] {}", r.state, r.body),
                created_at: r.submitted_at.unwrap_or_default(),
                association: None,
            });
        }
    }

    // Sort all comments by date
    comments.sort_by(|a, b| a.created_at.cmp(&b.created_at));

    // Fetch review (inline) comments via gh api
    let review_comments = fetch_review_comments(&cwd, number).unwrap_or_default();

    Ok(PRDetail {
        number: pr.number,
        title: pr.title,
        state: pr.state.to_lowercase(),
        author: pr.author.login,
        url: pr.url,
        created_at: pr.created_at,
        body: pr.body,
        labels: pr.labels.into_iter().map(|l| l.name).collect(),
        draft: pr.is_draft,
        head_ref: pr.head_ref_name,
        base_ref: pr.base_ref_name,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        mergeable: pr.merge_state_status,
        comments,
        review_comments,
    })
}

fn fetch_review_comments(cwd: &str, number: u32) -> Result<Vec<PRReviewComment>, String> {
    let endpoint = format!("repos/{{owner}}/{{repo}}/pulls/{}/comments", number);
    let output = silent_command("gh")
        .args(["api", &endpoint, "--paginate"])
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("gh api failed: {}", e))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    #[derive(Deserialize)]
    struct ApiReviewComment {
        user: ApiUser,
        body: String,
        created_at: String,
        path: Option<String>,
        diff_hunk: Option<String>,
    }

    #[derive(Deserialize)]
    struct ApiUser {
        login: String,
    }

    let items: Vec<ApiReviewComment> =
        serde_json::from_str(&stdout).unwrap_or_default();

    Ok(items
        .into_iter()
        .map(|c| PRReviewComment {
            author: c.user.login,
            body: c.body,
            created_at: c.created_at,
            path: c.path,
            diff_hunk: c.diff_hunk,
        })
        .collect())
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
pub async fn cmd_list_issues(
    cwd: String,
    state: String,
    assignee: Option<String>,
    labels: Option<Vec<String>>,
) -> Result<Vec<Issue>, String> {
    let state_arg = match state.as_str() {
        "open" | "closed" | "all" => state.as_str(),
        _ => "open",
    };

    let mut args: Vec<String> = vec![
        "issue".into(), "list".into(),
        "--json".into(), "number,title,state,author,url,createdAt,body,labels,assignees".into(),
        "--limit".into(), "100".into(),
        "--state".into(), state_arg.to_string(),
    ];
    if let Some(a) = &assignee {
        args.push("--assignee".into());
        args.push(a.clone());
    }
    for label in labels.as_deref().unwrap_or(&[]) {
        args.push("--label".into());
        args.push(label.clone());
    }

    let output = match silent_command("gh")
        .args(&args)
        .current_dir(&cwd)
        .output()
    {
        Ok(o) => o,
        Err(_) => return Ok(vec![]),
    };

    if !output.status.success() {
        return Ok(vec![]);
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
        #[serde(default)]
        assignees: Vec<GhAssignee>,
    }

    #[derive(Deserialize)]
    struct GhAuthor {
        login: String,
    }

    #[derive(Deserialize)]
    struct GhLabel {
        name: String,
    }

    #[derive(Deserialize)]
    struct GhAssignee {
        login: String,
    }

    let issues: Vec<GhIssue> = match serde_json::from_str(&stdout) {
        Ok(v) => v,
        Err(_) => return Ok(vec![]),
    };

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
            assignee: i.assignees.into_iter().next().map(|a| a.login),
        })
        .collect())
}

#[tauri::command]
pub async fn cmd_list_linear_issues(
    state: String,
    assignee: Option<String>,
    labels: Option<Vec<String>>,
) -> Result<Vec<Issue>, String> {
    let api_key = match get_linear_api_key() {
        Some(k) => k,
        None => return Ok(vec![]),
    };

    let gql_query = r#"
        query IssueList($filter: IssueFilter) {
          issues(first: 100, filter: $filter, orderBy: updatedAt) {
            nodes {
              id identifier title
              state { name type }
              creator { name }
              assignee { name }
              url createdAt
              labels { nodes { name } }
            }
          }
        }
    "#;

    let mut filter = serde_json::Map::new();
    match state.as_str() {
        "open" => {
            filter.insert("state".into(), serde_json::json!({
                "type": { "in": ["triage", "backlog", "unstarted", "started"] }
            }));
        }
        "closed" => {
            filter.insert("state".into(), serde_json::json!({
                "type": { "in": ["completed", "cancelled"] }
            }));
        }
        _ => {}
    }
    if let Some(a) = &assignee {
        filter.insert("assignee".into(), serde_json::json!({ "name": { "eq": a } }));
    }
    if let Some(ls) = &labels {
        if !ls.is_empty() {
            filter.insert("label".into(), serde_json::json!({ "name": { "in": ls } }));
        }
    }
    let variables = serde_json::json!({ "filter": filter });

    let body = serde_json::json!({ "query": gql_query, "variables": variables });

    let client = reqwest::Client::new();
    let res = match client
        .post("https://api.linear.app/graphql")
        .header("Authorization", &api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return Ok(vec![]),
    };

    if !res.status().is_success() {
        return Ok(vec![]);
    }

    let json: serde_json::Value = match res.json().await {
        Ok(v) => v,
        Err(_) => return Ok(vec![]),
    };

    #[derive(Deserialize)]
    struct LinearIssue {
        identifier: String,
        title: String,
        state: LinearState,
        creator: Option<LinearUser>,
        assignee: Option<LinearUser>,
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
    if json["errors"].as_array().is_some() {
        return Ok(vec![]);
    }

    let nodes = match json["data"]["issues"]["nodes"].as_array() {
        Some(a) => a.clone(),
        None => return Ok(vec![]),
    };

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
                assignee: i.assignee.map(|u| u.name),
            }
        })
        .collect();

    Ok(issues)
}

fn extract_adf_text(node: &serde_json::Value) -> String {
    let obj = match node.as_object() {
        Some(o) => o,
        None => return String::new(),
    };
    let node_type = obj.get("type").and_then(|t| t.as_str()).unwrap_or("");
    if node_type == "text" {
        return obj.get("text").and_then(|t| t.as_str()).unwrap_or("").to_string();
    }
    if node_type == "hardBreak" {
        return "\n".to_string();
    }
    let parts: Vec<String> = obj
        .get("content")
        .and_then(|c| c.as_array())
        .map(|arr| arr.iter().map(|c| extract_adf_text(c)).collect())
        .unwrap_or_default();
    match node_type {
        "paragraph" | "heading" => format!("{}\n", parts.join("")),
        "listItem" => format!("• {}", parts.join("")),
        _ => parts.join(""),
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct JiraIssueDetail {
    pub key: String,
    pub summary: String,
    pub status: String,
    pub description: Option<String>,
    pub assignee: Option<String>,
    pub reporter: Option<String>,
    pub priority: Option<String>,
    pub issue_type: Option<String>,
    pub created: String,
    pub updated: String,
    pub labels: Vec<String>,
    pub comment_count: u32,
    pub url: String,
}

#[tauri::command]
pub async fn cmd_get_jira_issue(
    base_url: String,
    email: String,
    api_token: String,
    issue_key: String,
) -> Result<JiraIssueDetail, String> {
    let url = format!(
        "{}/rest/api/3/issue/{}?fields=summary,description,status,assignee,reporter,priority,issuetype,created,updated,labels,comment",
        base_url.trim_end_matches('/'),
        issue_key
    );

    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .basic_auth(&email, Some(&api_token))
        .send()
        .await
        .map_err(|e| format!("Jira request failed: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Jira API error {}: {}", status, body));
    }

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse Jira response: {}", e))?;

    let key = json["key"].as_str().unwrap_or("").to_string();
    let fields = &json["fields"];

    let summary = fields["summary"].as_str().unwrap_or("").to_string();
    let status = fields["status"]["name"].as_str().unwrap_or("").to_string();

    let description = if fields["description"].is_null() {
        None
    } else {
        let text = extract_adf_text(&fields["description"]).trim().to_string();
        if text.is_empty() { None } else { Some(text) }
    };

    let assignee = fields["assignee"]["displayName"].as_str().map(|s| s.to_string());
    let reporter = fields["reporter"]["displayName"].as_str().map(|s| s.to_string());
    let priority = fields["priority"]["name"].as_str().map(|s| s.to_string());
    let issue_type = fields["issuetype"]["name"].as_str().map(|s| s.to_string());

    let created = fields["created"].as_str().unwrap_or("").to_string();
    let updated = fields["updated"].as_str().unwrap_or("").to_string();

    let labels: Vec<String> = fields["labels"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default();

    let comment_count = fields["comment"]["total"].as_u64().unwrap_or(0) as u32;
    let url_val = format!("{}/browse/{}", base_url.trim_end_matches('/'), key);

    Ok(JiraIssueDetail {
        key,
        summary,
        status,
        description,
        assignee,
        reporter,
        priority,
        issue_type,
        created,
        updated,
        labels,
        comment_count,
        url: url_val,
    })
}

#[tauri::command]
pub async fn cmd_list_jira_issues(
    base_url: String,
    email: String,
    api_token: String,
    state: String,
    assignee: Option<String>,
    labels: Option<Vec<String>>,
) -> Result<Vec<Issue>, String> {
    let token = api_token;

    let mut jql = match state.as_str() {
        "open"   => "statusCategory in (new, indeterminate)".to_string(),
        "closed" => "statusCategory = done".to_string(),
        _        => "1=1".to_string(),
    };
    if let Some(a) = &assignee {
        jql.push_str(&format!(" AND assignee = \"{}\"", a));
    }
    if let Some(ls) = &labels {
        if !ls.is_empty() {
            let list = ls.iter().map(|l| format!("\"{}\"", l)).collect::<Vec<_>>().join(", ");
            jql.push_str(&format!(" AND labels in ({})", list));
        }
    }
    jql.push_str(" ORDER BY created DESC");

    let url = format!("{}/rest/api/3/search/jql", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .basic_auth(&email, Some(&token))
        .query(&[
            ("jql", jql.as_str()),
            ("maxResults", "100"),
            ("fields", "summary,status,creator,created,labels,assignee"),
        ])
        .send()
        .await
        .map_err(|e| format!("Jira request failed: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Jira API error {}: {}", status, body));
    }

    let json: serde_json::Value = res.json().await
        .map_err(|e| format!("Failed to parse Jira response: {}", e))?;

    #[derive(Deserialize)] struct JiraIssue { key: String, fields: JiraFields }
    #[derive(Deserialize)] struct JiraFields {
        summary: String,
        status: JiraStatus,
        creator: Option<JiraUser>,
        assignee: Option<JiraUser>,
        created: String,
        #[serde(default)] labels: Vec<String>,
    }
    #[derive(Deserialize)] struct JiraStatus {
        #[serde(rename = "statusCategory")] status_category: JiraStatusCategory,
    }
    #[derive(Deserialize)] struct JiraStatusCategory { key: String }
    #[derive(Deserialize)] struct JiraUser { #[serde(rename = "displayName")] display_name: String }

    let raw = match json["issues"].as_array() {
        Some(a) => a.clone(),
        None => return Err(format!("Unexpected Jira response shape: {}", json)),
    };

    let issues = raw
        .into_iter()
        .filter_map(|v| serde_json::from_value::<JiraIssue>(v).ok())
        .map(|i| {
            let state_str = match i.fields.status.status_category.key.as_str() {
                "done" => "closed",
                _      => "open",
            };
            Issue {
                number: 0,
                identifier: Some(i.key.clone()),
                title: i.fields.summary,
                state: state_str.to_string(),
                author: i.fields.creator.map(|u| u.display_name).unwrap_or_default(),
                url: format!("{}/browse/{}", base_url.trim_end_matches('/'), i.key),
                created_at: i.fields.created,
                body: None,
                labels: i.fields.labels,
                source: "jira".to_string(),
                assignee: i.fields.assignee.map(|u| u.display_name),
            }
        })
        .collect();

    Ok(issues)
}

// ─── AssigneeOption ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct AssigneeOption {
    pub value: String, // login / name / accountId
    pub label: String, // display name shown in UI
}

// ─── GitHub option commands ───────────────────────────────────────────────────

#[tauri::command]
pub async fn cmd_list_github_labels(cwd: String) -> Result<Vec<String>, String> {
    let output = match silent_command("gh")
        .args(["label", "list", "--json", "name", "--limit", "200"])
        .current_dir(&cwd)
        .output()
    {
        Ok(o) => o,
        Err(_) => return Ok(vec![]),
    };
    if !output.status.success() { return Ok(vec![]); }
    #[derive(Deserialize)] struct L { name: String }
    let items: Vec<L> = serde_json::from_str(&String::from_utf8_lossy(&output.stdout)).unwrap_or_default();
    Ok(items.into_iter().map(|l| l.name).collect())
}

#[tauri::command]
pub async fn cmd_list_github_assignees(cwd: String) -> Result<Vec<String>, String> {
    let output = match silent_command("gh")
        .args(["api", "repos/{owner}/{repo}/assignees", "--jq", ".[].login"])
        .current_dir(&cwd)
        .output()
    {
        Ok(o) => o,
        Err(_) => return Ok(vec![]),
    };
    if !output.status.success() { return Ok(vec![]); }
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect())
}

// ─── Linear option commands ───────────────────────────────────────────────────

#[tauri::command]
pub async fn cmd_list_linear_labels() -> Result<Vec<String>, String> {
    let api_key = match get_linear_api_key() {
        Some(k) => k,
        None => return Ok(vec![]),
    };
    let body = serde_json::json!({
        "query": "query { issueLabels(first: 200) { nodes { name } } }"
    });
    let client = reqwest::Client::new();
    let json: serde_json::Value = match client
        .post("https://api.linear.app/graphql")
        .header("Authorization", &api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r.json().await.unwrap_or_default(),
        Err(_) => return Ok(vec![]),
    };
    let nodes = json["data"]["issueLabels"]["nodes"].as_array().cloned().unwrap_or_default();
    Ok(nodes.into_iter().filter_map(|n| n["name"].as_str().map(|s| s.to_string())).collect())
}

#[tauri::command]
pub async fn cmd_list_linear_members() -> Result<Vec<String>, String> {
    let api_key = match get_linear_api_key() {
        Some(k) => k,
        None => return Ok(vec![]),
    };
    let body = serde_json::json!({
        "query": "query { users(first: 200, filter: { active: { eq: true } }) { nodes { name } } }"
    });
    let client = reqwest::Client::new();
    let json: serde_json::Value = match client
        .post("https://api.linear.app/graphql")
        .header("Authorization", &api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r.json().await.unwrap_or_default(),
        Err(_) => return Ok(vec![]),
    };
    let nodes = json["data"]["users"]["nodes"].as_array().cloned().unwrap_or_default();
    Ok(nodes.into_iter().filter_map(|n| n["name"].as_str().map(|s| s.to_string())).collect())
}

// ─── Jira option commands ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn cmd_list_jira_labels(
    base_url: String,
    email: String,
    api_token: String,
) -> Result<Vec<String>, String> {
    let url = format!("{}/rest/api/3/label?maxResults=200", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let json: serde_json::Value = match client
        .get(&url)
        .basic_auth(&email, Some(&api_token))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r.json().await.unwrap_or_default(),
        _ => return Ok(vec![]),
    };
    let values = json["values"].as_array().cloned().unwrap_or_default();
    Ok(values.into_iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
}

#[tauri::command]
pub async fn cmd_list_jira_assignees(
    base_url: String,
    email: String,
    api_token: String,
) -> Result<Vec<AssigneeOption>, String> {
    // Jira Cloud JQL requires accountId; this endpoint returns accountId + displayName
    let url = format!(
        "{}/rest/api/3/users/search?maxResults=200&accountType=atlassian",
        base_url.trim_end_matches('/')
    );
    let client = reqwest::Client::new();
    let json: serde_json::Value = match client
        .get(&url)
        .basic_auth(&email, Some(&api_token))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r.json().await.unwrap_or_default(),
        _ => return Ok(vec![]),
    };
    let users = json.as_array().cloned().unwrap_or_default();
    Ok(users
        .into_iter()
        .filter_map(|u| {
            let value = u["accountId"].as_str()?.to_string();
            let label = u["displayName"].as_str().unwrap_or(&value).to_string();
            Some(AssigneeOption { value, label })
        })
        .collect())
}

// ─── "Me" commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cmd_get_linear_viewer() -> Result<Option<String>, String> {
    let api_key = match get_linear_api_key() {
        Some(k) => k,
        None => return Ok(None),
    };
    let body = serde_json::json!({ "query": "query { viewer { name } }" });
    let client = reqwest::Client::new();
    let json: serde_json::Value = match client
        .post("https://api.linear.app/graphql")
        .header("Authorization", &api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r.json().await.unwrap_or_default(),
        Err(_) => return Ok(None),
    };
    Ok(json["data"]["viewer"]["name"].as_str().map(|s| s.to_string()))
}

#[tauri::command]
pub async fn cmd_get_jira_myself(
    base_url: String,
    email: String,
    api_token: String,
) -> Result<Option<AssigneeOption>, String> {
    let url = format!("{}/rest/api/3/myself", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let json: serde_json::Value = match client
        .get(&url)
        .basic_auth(&email, Some(&api_token))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r.json().await.unwrap_or_default(),
        _ => return Ok(None),
    };
    Ok(json["accountId"].as_str().map(|id| AssigneeOption {
        value: id.to_string(),
        label: json["displayName"].as_str().unwrap_or("Me").to_string(),
    }))
}
