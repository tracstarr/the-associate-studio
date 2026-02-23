use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum GitFileSection {
    Staged,
    Unstaged,
    Untracked,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitFileEntry {
    pub path: String,
    pub section: GitFileSection,
    pub status_char: char,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum DiffLineKind {
    Header,
    Add,
    Remove,
    Hunk,
    Context,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiffLine {
    pub kind: DiffLineKind,
    pub text: String,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct GitStatus {
    pub staged: Vec<GitFileEntry>,
    pub unstaged: Vec<GitFileEntry>,
    pub untracked: Vec<GitFileEntry>,
}

impl GitStatus {
    pub fn is_empty(&self) -> bool {
        self.staged.is_empty() && self.unstaged.is_empty() && self.untracked.is_empty()
    }

    pub fn total_files(&self) -> usize {
        self.staged.len() + self.unstaged.len() + self.untracked.len()
    }
}
