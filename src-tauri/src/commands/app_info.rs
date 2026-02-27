#[tauri::command]
pub fn cmd_get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}
