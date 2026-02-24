use crate::data::git;
use crate::models::git::{DiffLine, GitStatus};
use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub async fn cmd_git_status(cwd: String) -> Result<GitStatus, String> {
    git::load_git_status(&PathBuf::from(&cwd)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_git_diff(cwd: String, path: String, staged: bool) -> Result<Vec<DiffLine>, String> {
    git::load_diff(&PathBuf::from(&cwd), &path, staged).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_git_branches(cwd: String) -> Result<Vec<String>, String> {
    git::load_branches(&PathBuf::from(&cwd)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_git_current_branch(cwd: String) -> Result<String, String> {
    git::load_current_branch(&PathBuf::from(&cwd)).map_err(|e| e.to_string())
}

// ─── Git Log Types ────────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
    pub refs: Vec<String>,
}

#[tauri::command]
pub async fn cmd_git_log(cwd: String, limit: Option<u32>) -> Result<Vec<CommitInfo>, String> {
    let max = limit.unwrap_or(100).to_string();
    let output = crate::utils::silent_command("git")
        .args([
            "-C", &cwd,
            "log",
            "--pretty=format:%h%x00%s%x00%an%x00%ar%x00%D",
            "--max-count", &max,
        ])
        .output()
        .map_err(|e| format!("Failed to run git log: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git log failed: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let commits = stdout
        .lines()
        .filter(|l| !l.is_empty())
        .map(|line| {
            let parts: Vec<&str> = line.splitn(5, '\x00').collect();
            let refs_raw = parts.get(4).copied().unwrap_or("");
            let refs: Vec<String> = refs_raw
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            CommitInfo {
                hash: parts.first().copied().unwrap_or("").to_string(),
                message: parts.get(1).copied().unwrap_or("").to_string(),
                author: parts.get(2).copied().unwrap_or("").to_string(),
                date: parts.get(3).copied().unwrap_or("").to_string(),
                refs,
            }
        })
        .collect();

    Ok(commits)
}

// ─── Remote Branch Types ──────────────────────────────────────────────────────

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBranch {
    pub remote: String,
    pub branch: String,
    pub full_ref: String,
}

#[tauri::command]
pub async fn cmd_git_remote_branches(cwd: String) -> Result<Vec<RemoteBranch>, String> {
    let output = crate::utils::silent_command("git")
        .args(["-C", &cwd, "branch", "-r", "--format=%(refname:short)"])
        .output()
        .map_err(|e| format!("Failed to run git branch -r: {}", e))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let branches = stdout
        .lines()
        .filter(|l| !l.is_empty() && !l.trim().ends_with("/HEAD"))
        .filter_map(|line| {
            let trimmed = line.trim();
            let slash = trimmed.find('/')?;
            Some(RemoteBranch {
                remote: trimmed[..slash].to_string(),
                branch: trimmed[slash + 1..].to_string(),
                full_ref: trimmed.to_string(),
            })
        })
        .collect();

    Ok(branches)
}

// ─── Worktree Types ───────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub path: String,
    pub head: String,       // short SHA (first 8 chars)
    pub branch: String,     // short: "feature/auth" not "refs/heads/feature/auth"
    pub is_main: bool,      // true for the first (main) worktree entry
    pub is_prunable: bool,  // true if "prunable" line present in porcelain output
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

/// Returns the path of the main worktree root by parsing `git worktree list --porcelain`.
fn find_main_worktree_root(project_path: &str) -> Result<String, String> {
    let output = crate::utils::silent_command("git")
        .args(["-C", project_path, "worktree", "list", "--porcelain"])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree list failed: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(path) = line.strip_prefix("worktree ") {
            return Ok(path.trim().to_string());
        }
    }
    Err("Could not find main worktree".to_string())
}

/// Parses `git worktree list --porcelain` stdout into a Vec<WorktreeInfo>.
fn parse_worktrees(output: &str) -> Vec<WorktreeInfo> {
    let mut worktrees = Vec::new();
    let mut is_first = true;

    // Blocks are separated by blank lines
    for block in output.split("\n\n") {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }

        let mut path = String::new();
        let mut head = String::new();
        let mut branch = String::new();
        let mut is_prunable = false;

        for line in block.lines() {
            if let Some(v) = line.strip_prefix("worktree ") {
                path = v.trim().to_string();
            } else if let Some(v) = line.strip_prefix("HEAD ") {
                let sha = v.trim();
                head = if sha.len() >= 8 {
                    sha[..8].to_string()
                } else {
                    sha.to_string()
                };
            } else if let Some(v) = line.strip_prefix("branch ") {
                let b = v.trim();
                branch = b.strip_prefix("refs/heads/").unwrap_or(b).to_string();
            } else if line.starts_with("prunable") {
                is_prunable = true;
            } else if line == "detached" {
                branch = "(detached)".to_string();
            }
        }

        if path.is_empty() {
            continue;
        }

        worktrees.push(WorktreeInfo {
            path,
            head,
            branch,
            is_main: is_first,
            is_prunable,
        });
        is_first = false;
    }

    worktrees
}

/// Reads `.worktree_copy` from `project_path` as a JSON array of strings.
fn read_worktree_copy(project_path: &str) -> Result<Vec<String>, String> {
    let copy_file = PathBuf::from(project_path).join(".worktree_copy");
    if !copy_file.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&copy_file)
        .map_err(|e| format!("Failed to read .worktree_copy: {}", e))?;
    let entries: Vec<String> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse .worktree_copy: {}", e))?;
    Ok(entries)
}

/// Recursively copies `src` directory into `dst`.
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cmd_list_worktrees(project_path: String) -> Result<Vec<WorktreeInfo>, String> {
    let output = crate::utils::silent_command("git")
        .args(["-C", &project_path, "worktree", "list", "--porcelain"])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree list failed: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_worktrees(&stdout))
}

#[tauri::command]
pub async fn cmd_get_worktree_copy(project_path: String) -> Result<Vec<String>, String> {
    let main_root = find_main_worktree_root(&project_path)?;
    read_worktree_copy(&main_root)
}

#[tauri::command]
pub async fn cmd_set_worktree_copy(
    project_path: String,
    entries: Vec<String>,
) -> Result<(), String> {
    let main_root = find_main_worktree_root(&project_path)?;
    let copy_file = PathBuf::from(&main_root).join(".worktree_copy");
    let content = serde_json::to_string_pretty(&entries)
        .map_err(|e| format!("Failed to serialize entries: {}", e))?;
    fs::write(&copy_file, content)
        .map_err(|e| format!("Failed to write .worktree_copy: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn cmd_create_worktree(
    project_path: String,
    branch_name: String,
) -> Result<String, String> {
    // Sanitize branch_name for use as a directory name: / and spaces → -, lowercase
    let dir_name = branch_name
        .replace('/', "-")
        .replace(' ', "-")
        .to_lowercase();

    // Compute parent dir of project
    let project = PathBuf::from(&project_path);
    let parent = project
        .parent()
        .ok_or_else(|| format!("Cannot determine parent directory of {}", project_path))?;

    // worktree_path = parent / sanitized_name
    let worktree_path = parent.join(&dir_name);
    let worktree_path_str = worktree_path
        .to_str()
        .ok_or_else(|| "Invalid path encoding".to_string())?
        .to_string();

    // Run: git -C <project_path> worktree add <worktree_path> -b <branch_name>
    let output = crate::utils::silent_command("git")
        .args([
            "-C",
            &project_path,
            "worktree",
            "add",
            &worktree_path_str,
            "-b",
            &branch_name,
        ])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree add failed: {}", stderr.trim()));
    }

    // Post-creation: copy files listed in .worktree_copy from base project
    let mut copy_warnings: Vec<String> = Vec::new();
    if let Ok(entries) = read_worktree_copy(&project_path) {
        for entry in entries {
            let src = PathBuf::from(&project_path).join(&entry);
            let dst = PathBuf::from(&worktree_path_str).join(&entry);
            if src.is_file() {
                if let Some(parent) = dst.parent() {
                    if let Err(e) = fs::create_dir_all(parent) {
                        copy_warnings.push(format!("mkdir {}: {}", parent.display(), e));
                        continue;
                    }
                }
                if let Err(e) = fs::copy(&src, &dst) {
                    copy_warnings.push(format!("copy {}: {}", entry, e));
                }
            } else if src.is_dir() {
                if let Err(e) = copy_dir_recursive(&src, &dst) {
                    copy_warnings.push(format!("copy dir {}: {}", entry, e));
                }
            }
        }
    }

    if copy_warnings.is_empty() {
        Ok(worktree_path_str)
    } else {
        Ok(format!(
            "{}\nWarnings copying files: {}",
            worktree_path_str,
            copy_warnings.join("; ")
        ))
    }
}

/// Helper: combine stdout+stderr and return Ok/Err based on exit status.
fn git_output_result(output: std::process::Output) -> Result<String, String> {
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}{}", stdout, stderr);
    if output.status.success() {
        Ok(combined.trim().to_string())
    } else {
        Err(combined.trim().to_string())
    }
}

#[tauri::command]
pub async fn cmd_git_fetch(cwd: String) -> Result<String, String> {
    let output = crate::utils::silent_command("git")
        .args(["-C", &cwd, "fetch", "--all", "--prune"])
        .output()
        .map_err(|e| format!("Failed to run git fetch: {}", e))?;
    git_output_result(output)
}

#[tauri::command]
pub async fn cmd_git_pull(cwd: String) -> Result<String, String> {
    let output = crate::utils::silent_command("git")
        .args(["-C", &cwd, "pull"])
        .output()
        .map_err(|e| format!("Failed to run git pull: {}", e))?;
    git_output_result(output)
}

#[tauri::command]
pub async fn cmd_git_create_branch(
    cwd: String,
    branch_name: String,
    from_branch: String,
) -> Result<String, String> {
    let output = crate::utils::silent_command("git")
        .args(["-C", &cwd, "checkout", "-b", &branch_name, &from_branch])
        .output()
        .map_err(|e| format!("Failed to run git checkout: {}", e))?;
    git_output_result(output)
}

#[tauri::command]
pub async fn cmd_git_add(cwd: String, path: String) -> Result<String, String> {
    let output = crate::utils::silent_command("git")
        .args(["-C", &cwd, "add", "--", &path])
        .output()
        .map_err(|e| format!("Failed to run git add: {}", e))?;
    git_output_result(output)
}

#[tauri::command]
pub async fn cmd_git_ignore(cwd: String, file_path: String) -> Result<String, String> {
    use std::io::Write;
    // Reject paths containing newline/carriage-return to prevent injection of extra entries
    if file_path.contains('\n') || file_path.contains('\r') {
        return Err("Invalid file path: must not contain newline characters".to_string());
    }
    let gitignore_path = std::path::PathBuf::from(&cwd).join(".gitignore");
    let mut file = std::fs::OpenOptions::new()
        .append(true)
        .create(true)
        .open(&gitignore_path)
        .map_err(|e| format!("Failed to open .gitignore: {}", e))?;
    writeln!(file, "{}", file_path)
        .map_err(|e| format!("Failed to write to .gitignore: {}", e))?;
    Ok("Added to .gitignore".to_string())
}

#[tauri::command]
pub async fn cmd_git_rebase(cwd: String, onto_branch: String) -> Result<String, String> {
    let dir = std::path::PathBuf::from(&cwd);
    if !dir.exists() {
        return Err(format!("Directory does not exist: {}", cwd));
    }

    // Validate branch name to prevent prompt injection
    let valid_branch = onto_branch.chars().all(|c| {
        c.is_ascii_alphanumeric() || matches!(c, '/' | '_' | '.' | '-')
    });
    if !valid_branch || onto_branch.is_empty() {
        return Err("Invalid branch name: must match [a-zA-Z0-9/_.-]+".to_string());
    }

    let prompt = format!(
        "Rebase the current branch onto '{}'. Run 'git rebase {}'. \
         If there are merge conflicts, attempt to resolve them sensibly using git commands, \
         then continue with 'git rebase --continue'. \
         If rebase cannot be completed cleanly, abort with 'git rebase --abort' and clearly explain why. \
         Output the final result.",
        onto_branch, onto_branch
    );

    let output = tokio::task::spawn_blocking(move || {
        crate::utils::silent_command("claude")
            .args(["-p", &prompt, "--dangerously-skip-permissions"])
            .current_dir(&dir)
            .env_remove("CLAUDECODE")
            .output()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to run claude: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}{}", stdout, stderr);

    if output.status.success() {
        Ok(combined.trim().to_string())
    } else {
        Err(if combined.trim().is_empty() {
            format!("claude exited with code {}", output.status)
        } else {
            combined.trim().to_string()
        })
    }
}

#[tauri::command]
pub async fn cmd_claude_git_action(cwd: String, action: String) -> Result<String, String> {
    let dir = std::path::PathBuf::from(&cwd);
    if !dir.exists() {
        return Err(format!("Directory does not exist: {}", cwd));
    }

    let prompt = match action.as_str() {
        "commit" => "Stage all changes with 'git add -A' and commit with a clear, descriptive commit message based on the actual diff. Add a blank line after the subject, then include the trailer 'Co-Authored-By: The Associate <noreply@the-associate.bitbounce.ca>' in the commit body. Output the commit hash when done.".to_string(),
        "commit_push" => "Stage all changes with 'git add -A', commit with a descriptive message based on the actual diff (include 'Co-Authored-By: The Associate <noreply@the-associate.bitbounce.ca>' as a trailer in the commit body), then push to the remote branch. Output the commit hash and push result when done.".to_string(),
        "commit_push_pr" => "Stage all changes with 'git add -A', commit with a descriptive message based on the actual diff (include 'Co-Authored-By: The Associate <noreply@the-associate.bitbounce.ca>' as a trailer in the commit body), push to the remote branch, then create a pull request using 'gh pr create --fill'. Output the PR URL when done.".to_string(),
        _ => return Err(format!("Unknown action: {}", action)),
    };

    let output = tokio::task::spawn_blocking(move || {
        crate::utils::silent_command("claude")
            .args(["-p", &prompt, "--dangerously-skip-permissions"])
            .current_dir(&dir)
            .env_remove("CLAUDECODE")
            .output()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to run claude: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}{}", stdout, stderr);

    if output.status.success() {
        Ok(combined.trim().to_string())
    } else {
        Err(if combined.trim().is_empty() {
            format!("claude exited with code {}", output.status)
        } else {
            combined.trim().to_string()
        })
    }
}
