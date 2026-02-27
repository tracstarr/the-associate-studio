use std::path::Path;

/// Encode an absolute Windows path to Claude's project directory name.
///
/// Rules:
/// - Replace `:\` with `--`
/// - Replace remaining `\` and `/` with `-`
/// - Replace `.` and `_` with `-`
///
/// Example: `C:\dev\profile-server` -> `C--dev-profile-server`
/// Example: `C:\dev\apex_3.11.0` -> `C--dev-apex-3-11-0`
pub fn encode_project_path(path: &Path) -> String {
    let s = path.to_string_lossy().to_string();
    let s = s.replace('/', "\\");
    let s = s.replace(":\\", "--");
    let s = s.replace('\\', "-");
    let s = s.replace('.', "-");
    let s = s.replace('_', "-");
    s.trim_end_matches('-').to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_simple_path() {
        let p = PathBuf::from(r"C:\dev\profile-server");
        assert_eq!(encode_project_path(&p), "C--dev-profile-server");
    }

    #[test]
    fn test_worktree_path() {
        let p = PathBuf::from(r"C:\dev\profile-server\.worktrees\aero-planning");
        assert_eq!(
            encode_project_path(&p),
            "C--dev-profile-server--worktrees-aero-planning"
        );
    }

    #[test]
    fn test_deep_path() {
        let p = PathBuf::from(r"C:\Users\Keith\projects\my-app");
        assert_eq!(encode_project_path(&p), "C--Users-Keith-projects-my-app");
    }

    #[test]
    fn test_version_in_path() {
        let p = PathBuf::from(r"C:\dev\branch\keith\apex_3.11.0");
        assert_eq!(
            encode_project_path(&p),
            "C--dev-branch-keith-apex-3-11-0"
        );
    }

    #[test]
    fn test_dots_and_underscores() {
        let p = PathBuf::from(r"C:\dev\my_project\v1.2.3");
        assert_eq!(encode_project_path(&p), "C--dev-my-project-v1-2-3");
    }
}
