use std::path::Path;

use anyhow::Result;

use crate::models::note::Note;

/// Load all notes from a directory, sorted by `modified` descending.
pub fn load_notes_from_dir(dir: &Path) -> Result<Vec<Note>> {
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut notes = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let text = match std::fs::read_to_string(&path) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let note: Note = match serde_json::from_str(&text) {
            Ok(n) => n,
            Err(_) => continue,
        };
        notes.push(note);
    }

    notes.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(notes)
}

/// Load global notes from `~/.claude/theassociate/notes/`.
pub fn load_global_notes(claude_home: &Path) -> Result<Vec<Note>> {
    let notes_dir = claude_home.join("theassociate").join("notes");
    load_notes_from_dir(&notes_dir)
}

/// Load project notes from `~/.claude/theassociate/projects/{encoded_id}/notes/`.
pub fn load_project_notes(claude_home: &Path, encoded_id: &str) -> Result<Vec<Note>> {
    let notes_dir = claude_home
        .join("theassociate")
        .join("projects")
        .join(encoded_id)
        .join("notes");
    load_notes_from_dir(&notes_dir)
}

/// Save a note to the appropriate directory based on `note.project_path`.
pub fn save_note(claude_home: &Path, note: &Note) -> Result<()> {
    let dir = match &note.project_path {
        None => claude_home.join("theassociate").join("notes"),
        Some(project_path) => {
            let encoded = crate::data::path_encoding::encode_project_path(
                &std::path::PathBuf::from(project_path),
            );
            claude_home
                .join("theassociate")
                .join("projects")
                .join(encoded)
                .join("notes")
        }
    };
    std::fs::create_dir_all(&dir)?;
    let file_path = dir.join(format!("{}.json", note.id));
    let text = serde_json::to_string_pretty(note)?;
    std::fs::write(&file_path, text)?;
    Ok(())
}

/// Delete a note by ID from the appropriate directory.
pub fn delete_note(
    claude_home: &Path,
    note_id: &str,
    encoded_project_id: Option<&str>,
) -> Result<()> {
    let dir = match encoded_project_id {
        None => claude_home.join("theassociate").join("notes"),
        Some(enc) => claude_home
            .join("theassociate")
            .join("projects")
            .join(enc)
            .join("notes"),
    };
    let file_path = dir.join(format!("{}.json", note_id));
    // Guard against path traversal
    if !file_path.starts_with(&dir) {
        return Err(anyhow::anyhow!("Invalid note path"));
    }
    if file_path.exists() {
        std::fs::remove_file(&file_path)?;
    }
    Ok(())
}
