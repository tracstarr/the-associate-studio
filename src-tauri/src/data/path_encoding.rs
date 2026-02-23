use std::path::Path;

/// Encode an absolute Windows path to Claude's project directory name.
///
/// Rules:
/// - Replace `:\` with `--`
/// - Replace remaining `\` and `/` with `-`
///
/// Example: `C:\dev\profile-server` -> `C--dev-profile-server`
pub fn encode_project_path(path: &Path) -> String {
    let s = path.to_string_lossy().to_string();
    let s = s.replace('/', "\\");
    let s = s.replace(":\\", "--");
    s.replace('\\', "-")
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
            "C--dev-profile-server-.worktrees-aero-planning"
        );
    }

    #[test]
    fn test_deep_path() {
        let p = PathBuf::from(r"C:\Users\Keith\projects\my-app");
        assert_eq!(encode_project_path(&p), "C--Users-Keith-projects-my-app");
    }
}
