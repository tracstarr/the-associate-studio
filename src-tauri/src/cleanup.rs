/// Cleanup invoked when the app is called with `--cleanup` by the NSIS uninstaller.
/// Runs before app files are removed, so the binary is still available.
/// No window is shown — exits after cleanup completes.
pub fn run() {
    // 1. Remove our hook entries from ~/.claude/settings.json
    if let Err(e) = crate::commands::hooks::cmd_remove_hooks() {
        eprintln!("[cleanup] hook removal failed: {}", e);
    }

    // 2. Delete ~/.claude/theassociate/ (hook.js + hook-events.jsonl)
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();
    if !home.is_empty() {
        let dir = std::path::PathBuf::from(&home)
            .join(".claude")
            .join("theassociate");
        if dir.exists() {
            if let Err(e) = std::fs::remove_dir_all(&dir) {
                eprintln!("[cleanup] failed to remove theassociate dir: {}", e);
            }
        }
    }

    // 3. Delete %APPDATA%\com.keith.the-associate-studio\ (plugin-store settings + WebView2 cache)
    if let Ok(appdata) = std::env::var("APPDATA") {
        let dir = std::path::PathBuf::from(appdata).join("com.keith.the-associate-studio");
        if dir.exists() {
            if let Err(e) = std::fs::remove_dir_all(&dir) {
                eprintln!("[cleanup] failed to remove app data dir: {}", e);
            }
        }
    }

    // 4. Delete Windows Credential Manager entries (GitHub, Linear, Jira tokens)
    for key in &["github-token", "linear-api-key", "jira-api-token"] {
        if let Ok(entry) = keyring::Entry::new("the-associate-studio", key) {
            let _ = entry.delete_credential();
        }
    }
}
