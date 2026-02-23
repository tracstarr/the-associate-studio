use std::path::Path;

use anyhow::Result;

use crate::models::git::{DiffLine, DiffLineKind, GitFileEntry, GitFileSection, GitStatus};
use crate::utils::silent_command;

/// Load git status by running `git status --porcelain` in the given directory.
pub fn load_git_status(cwd: &Path) -> Result<GitStatus> {
    let output = match silent_command("git")
        .args(["status", "--porcelain"])
        .current_dir(cwd)
        .output()
    {
        Ok(o) => o,
        Err(_) => return Ok(GitStatus::default()),
    };

    if !output.status.success() {
        return Ok(GitStatus::default());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut status = GitStatus::default();

    for line in stdout.lines() {
        if line.len() < 3 {
            continue;
        }

        let bytes = line.as_bytes();
        let index_char = bytes[0] as char;
        let worktree_char = bytes[1] as char;
        let path_str = &line[3..];
        let path = if index_char == 'R' || index_char == 'C' {
            path_str
                .split(" -> ")
                .last()
                .unwrap_or(path_str)
                .to_string()
        } else {
            path_str.to_string()
        };

        if index_char == '?' && worktree_char == '?' {
            status.untracked.push(GitFileEntry {
                path,
                section: GitFileSection::Untracked,
                status_char: '?',
            });
            continue;
        }

        if index_char != ' ' && index_char != '?' {
            status.staged.push(GitFileEntry {
                path: path.clone(),
                section: GitFileSection::Staged,
                status_char: index_char,
            });
        }

        if worktree_char != ' ' && worktree_char != '?' {
            status.unstaged.push(GitFileEntry {
                path,
                section: GitFileSection::Unstaged,
                status_char: worktree_char,
            });
        }
    }

    Ok(status)
}

/// Load diff for a specific file.
pub fn load_diff(cwd: &Path, file_path: &str, staged: bool) -> Result<Vec<DiffLine>> {
    if staged {
        load_git_diff(cwd, file_path, true)
    } else {
        load_git_diff(cwd, file_path, false)
    }
}

/// Load current branch name.
pub fn load_current_branch(cwd: &Path) -> Result<String> {
    let output = silent_command("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(cwd)
        .output()?;

    if !output.status.success() {
        return Ok(String::new());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Load list of branches.
pub fn load_branches(cwd: &Path) -> Result<Vec<String>> {
    let output = silent_command("git")
        .args(["branch", "--format=%(refname:short)"])
        .current_dir(cwd)
        .output()?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().map(|s| s.to_string()).collect())
}

fn load_git_diff(cwd: &Path, file_path: &str, staged: bool) -> Result<Vec<DiffLine>> {
    let mut args = vec!["diff"];
    if staged {
        args.push("--cached");
    }
    args.push("--");
    args.push(file_path);

    let output = silent_command("git").args(&args).current_dir(cwd).output()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_diff_output(&stdout))
}

fn parse_diff_output(output: &str) -> Vec<DiffLine> {
    output
        .lines()
        .map(|line| {
            let kind = if line.starts_with("diff ")
                || line.starts_with("index ")
                || line.starts_with("--- ")
                || line.starts_with("+++ ")
            {
                DiffLineKind::Header
            } else if line.starts_with("@@") {
                DiffLineKind::Hunk
            } else if line.starts_with('+') {
                DiffLineKind::Add
            } else if line.starts_with('-') {
                DiffLineKind::Remove
            } else {
                DiffLineKind::Context
            };

            DiffLine {
                kind,
                text: line.to_string(),
            }
        })
        .collect()
}
