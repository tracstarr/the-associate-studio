use crate::commands::projects::get_theassociate_home;
use crate::data::summaries::load_summaries_for_session;
use crate::models::summary::SummaryFile;

/// Load all summaries for a session.
/// `project_dir` is the encoded project directory name.
#[tauri::command]
pub async fn cmd_load_summaries(
    project_dir: String,
    session_id: String,
) -> Result<Vec<SummaryFile>, String> {
    let dir = get_theassociate_home()?
        .join("projects")
        .join(&project_dir)
        .join("summaries");
    Ok(load_summaries_for_session(&dir, &session_id))
}

/// Read the raw markdown content of a summary file.
/// `project_dir` is the encoded project directory name.
#[tauri::command]
pub async fn cmd_read_summary(
    project_dir: String,
    filename: String,
) -> Result<String, String> {
    let summaries_dir = get_theassociate_home()?
        .join("projects")
        .join(&project_dir)
        .join("summaries");
    let path = summaries_dir.join(&filename);
    // Guard against path traversal
    if !path.starts_with(&summaries_dir) {
        return Err("Invalid summary path".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

