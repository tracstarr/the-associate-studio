use crate::commands::projects::get_theassociate_home;
use crate::data::task_snapshots::load_task_snapshots;
use crate::models::task_snapshot::TaskSnapshotFile;

/// Load task history snapshots for a given project and team.
/// `project_dir` is the encoded project directory name (e.g. "C--dev-my-app").
#[tauri::command]
pub async fn cmd_load_task_snapshots(
    project_dir: String,
    team_name: String,
) -> Result<TaskSnapshotFile, String> {
    let home = get_theassociate_home()?;
    let claude_home = home
        .parent()
        .ok_or_else(|| "Cannot resolve claude home".to_string())?
        .to_path_buf();
    Ok(load_task_snapshots(&claude_home, &project_dir, &team_name))
}
