use serde::{Deserialize, Serialize};
use crate::utils::silent_command;

const KEYRING_SERVICE: &str = "the-associate-studio";

// ── Keyring helpers ───────────────────────────────────────────────────────────

fn secret_set(key: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, key).map_err(|e| e.to_string())?;
    entry.set_password(value).map_err(|e| e.to_string())
}

fn secret_get(key: &str) -> Option<String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, key).ok()?;
    entry.get_password().ok()
}

fn secret_delete(key: &str) {
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, key) {
        let _ = entry.delete_credential();
    }
}

/// Load all integration secrets from Windows Credential Manager at startup.
#[derive(Serialize, Default)]
pub struct IntegrationSecrets {
    pub github_token: Option<String>,
    pub linear_api_key: Option<String>,
    pub jira_api_token: Option<String>,
}

#[tauri::command]
pub async fn cmd_load_integration_secrets() -> Result<IntegrationSecrets, String> {
    Ok(IntegrationSecrets {
        github_token: secret_get("github-token"),
        linear_api_key: secret_get("linear-api-key"),
        jira_api_token: secret_get("jira-api-token"),
    })
}

// ── GitHub ────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct GithubStatus {
    pub connected: bool,
    pub username: Option<String>,
}

#[derive(Serialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Deserialize)]
struct GithubDeviceCodeRaw {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Deserialize)]
struct GithubTokenRaw {
    access_token: Option<String>,
    error: Option<String>,
}

#[tauri::command]
pub async fn cmd_github_auth_status() -> Result<GithubStatus, String> {
    let output = silent_command("gh")
        .args(["auth", "status"])
        .output()
        .map_err(|e| format!("gh not found: {}", e))?;

    let text = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    if text.contains("Logged in") {
        let username = text
            .lines()
            .find(|l| l.contains("account "))
            .and_then(|l| l.split("account ").nth(1))
            .map(|u| u.split_whitespace().next().unwrap_or(u).to_string());
        Ok(GithubStatus { connected: true, username })
    } else {
        Ok(GithubStatus { connected: false, username: None })
    }
}

#[tauri::command]
pub async fn cmd_github_device_flow_start(
    client_id: String,
) -> Result<DeviceCodeResponse, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[("client_id", client_id.as_str()), ("scope", "repo read:org")])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let raw: GithubDeviceCodeRaw = res.json().await.map_err(|e| e.to_string())?;
    let _ = open::that(&raw.verification_uri);

    Ok(DeviceCodeResponse {
        device_code: raw.device_code,
        user_code: raw.user_code,
        verification_uri: raw.verification_uri,
        expires_in: raw.expires_in,
        interval: raw.interval,
    })
}

#[tauri::command]
pub async fn cmd_github_device_flow_poll(
    client_id: String,
    device_code: String,
) -> Result<Option<String>, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id.as_str()),
            ("device_code", device_code.as_str()),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let raw: GithubTokenRaw = res.json().await.map_err(|e| e.to_string())?;

    if let Some(token) = raw.access_token {
        // Store in Windows Credential Manager
        secret_set("github-token", &token)?;
        // Also configure gh CLI
        let _ = set_gh_token(&token);
        return Ok(Some(token));
    }

    Ok(None)
}

#[tauri::command]
pub async fn cmd_github_set_token(token: String) -> Result<(), String> {
    secret_set("github-token", &token)?;
    set_gh_token(&token)
}

fn set_gh_token(token: &str) -> Result<(), String> {
    use std::io::Write;
    let mut child = silent_command("gh")
        .args(["auth", "login", "--with-token"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run gh: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(format!("{}\n", token).as_bytes());
    }
    child.wait().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn cmd_github_logout() -> Result<(), String> {
    secret_delete("github-token");
    silent_command("gh")
        .args(["auth", "logout", "--hostname", "github.com"])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Linear ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cmd_linear_verify_key(api_key: String) -> Result<Option<String>, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.linear.app/graphql")
        .header("Authorization", &api_key)
        .header("Content-Type", "application/json")
        .body(r#"{"query": "{ viewer { name } }"}"#)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        let name = json["data"]["viewer"]["name"]
            .as_str()
            .map(|s| s.to_string());
        if name.is_some() {
            // Store in Windows Credential Manager
            secret_set("linear-api-key", &api_key)?;
        }
        Ok(name)
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn cmd_linear_logout() -> Result<(), String> {
    secret_delete("linear-api-key");
    Ok(())
}

// ── Jira ─────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct JiraMyself {
    #[serde(rename = "displayName")]
    display_name: Option<String>,
}

#[tauri::command]
pub async fn cmd_jira_verify_token(
    base_url: String,
    email: String,
    api_token: String,
) -> Result<Option<String>, String> {
    let url = format!("{}/rest/api/3/myself", base_url.trim_end_matches('/'));
    let client = reqwest::Client::new();

    let res = client
        .get(&url)
        .basic_auth(&email, Some(&api_token))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let me: JiraMyself = res.json().await.map_err(|e| e.to_string())?;
        if me.display_name.is_some() {
            // Store only the token in Windows Credential Manager;
            // base_url and email are non-sensitive and live in settings.json
            secret_set("jira-api-token", &api_token)?;
        }
        Ok(me.display_name)
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn cmd_jira_logout() -> Result<(), String> {
    secret_delete("jira-api-token");
    Ok(())
}
