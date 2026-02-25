mod cleanup;
mod commands;
mod data;
mod models;
mod utils;
mod watcher;

use commands::pty::PtyState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // NSIS uninstaller calls us with `--cleanup` before removing app files.
    // Run cleanup and exit without showing any window.
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && args[1] == "--cleanup" {
        cleanup::run();
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(PtyState(std::sync::Arc::new(std::sync::Mutex::new(
            std::collections::HashMap::new(),
        ))))
        .setup(|app| {
            // Auto-install hooks on every launch (idempotent — skips if already present)
            if let Err(e) = commands::hooks::cmd_setup_hooks() {
                eprintln!("[ide] hook setup failed: {}", e);
            }
            watcher::claude_watcher::start_claude_watcher(app.handle().clone());

            // Kill all PTY sessions when the main window is destroyed
            let pty_state = app.state::<PtyState>().inner().0.clone();
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Destroyed = event {
                        if let Ok(mut sessions) = pty_state.lock() {
                            for (_, mut session) in sessions.drain() {
                                let _ = session.child.kill();
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::sessions::cmd_load_sessions,
            commands::sessions::cmd_load_transcript,
            commands::teams::cmd_load_teams,
            commands::teams::cmd_delete_team,
            commands::tasks::cmd_load_tasks,
            commands::inbox::cmd_load_inbox,
            commands::inbox::cmd_send_inbox_message,
            commands::todos::cmd_load_todos,
            commands::plans::cmd_load_plans,
            commands::plans::cmd_read_plan,
            commands::plans::cmd_save_plan,
            commands::git::cmd_git_status,
            commands::git::cmd_git_diff,
            commands::git::cmd_git_branches,
            commands::git::cmd_git_current_branch,
            commands::git::cmd_git_log,
            commands::git::cmd_git_remote_branches,
            commands::git::cmd_create_worktree,
            commands::git::cmd_list_worktrees,
            commands::git::cmd_get_worktree_copy,
            commands::git::cmd_set_worktree_copy,
            commands::git::cmd_claude_git_action,
            commands::git::cmd_git_fetch,
            commands::git::cmd_git_pull,
            commands::git::cmd_git_create_branch,
            commands::git::cmd_git_add,
            commands::git::cmd_git_ignore,
            commands::git::cmd_git_rebase,
            commands::pty::pty_spawn,
            commands::pty::pty_resize,
            commands::pty::pty_write,
            commands::pty::pty_kill,
            commands::pty::pty_kill_all,
            commands::issues::cmd_list_prs,
            commands::issues::cmd_list_issues,
            commands::issues::cmd_list_linear_issues,
            commands::issues::cmd_list_jira_issues,
            commands::issues::cmd_get_pr_detail,
            commands::integrations::cmd_load_integration_secrets,
            commands::integrations::cmd_github_auth_status,
            commands::integrations::cmd_github_device_flow_start,
            commands::integrations::cmd_github_device_flow_poll,
            commands::integrations::cmd_github_set_token,
            commands::integrations::cmd_github_logout,
            commands::integrations::cmd_linear_verify_key,
            commands::integrations::cmd_linear_logout,
            commands::integrations::cmd_jira_verify_token,
            commands::integrations::cmd_jira_logout,
            commands::hooks::cmd_setup_hooks,
            commands::hooks::cmd_remove_hooks,
            commands::hooks::cmd_get_active_sessions,
            commands::hooks::cmd_hooks_configured,
            commands::projects::cmd_list_projects,
            commands::projects::cmd_list_orphaned_projects,
            commands::projects::cmd_pick_folder,
            commands::projects::cmd_delete_project,
            commands::projects::cmd_create_project,
            commands::projects::cmd_get_home_dir,
            commands::projects::cmd_read_file,
            commands::projects::cmd_write_file,
            commands::projects::cmd_run_claude_init,
            commands::projects::cmd_run_readme_gen,
            commands::projects::cmd_get_project_settings,
            commands::projects::cmd_set_project_settings,
            commands::projects::cmd_detect_docs_folder,
            commands::projects::cmd_run_docs_index_gen,
            commands::files::cmd_list_dir,
            commands::summaries::cmd_load_summaries,
            commands::summaries::cmd_read_summary,
            commands::claude_config::cmd_load_extensions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
