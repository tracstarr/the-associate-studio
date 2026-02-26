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

/// Load global notes from `~/.claude/notes/`.
pub fn load_global_notes(claude_home: &Path) -> Result<Vec<Note>> {
    let notes_dir = claude_home.join("notes");
    load_notes_from_dir(&notes_dir)
}

/// Load project notes from `~/.claude/projects/{encoded_id}/notes/`.
pub fn load_project_notes(claude_home: &Path, encoded_id: &str) -> Result<Vec<Note>> {
    let notes_dir = claude_home.join("projects").join(encoded_id).join("notes");
    load_notes_from_dir(&notes_dir)
}

/// Save a note to the appropriate directory based on `note.project_path`.
pub fn save_note(claude_home: &Path, note: &Note) -> Result<()> {
    let dir = match &note.project_path {
        None => claude_home.join("notes"),
        Some(project_path) => {
            let encoded = crate::data::path_encoding::encode_project_path(
                &std::path::PathBuf::from(project_path),
            );
            claude_home.join("projects").join(encoded).join("notes")
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
        None => claude_home.join("notes"),
        Some(enc) => claude_home.join("projects").join(enc).join("notes"),
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::note::Note;

    fn make_note(id: &str, modified: u64) -> Note {
        Note {
            id: id.to_string(),
            title: format!("Note {}", id),
            content: "Test content".to_string(),
            project_path: None,
            file_refs: vec![],
            created: 1000,
            modified,
        }
    }

    #[test]
    fn test_load_notes_empty_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let notes = load_notes_from_dir(tmp.path()).unwrap();
        assert!(notes.is_empty());
    }

    #[test]
    fn test_load_notes_nonexistent_dir() {
        let notes = load_notes_from_dir(Path::new("/does/not/exist")).unwrap();
        assert!(notes.is_empty());
    }

    #[test]
    fn test_save_and_load_global_note() {
        let tmp = tempfile::tempdir().unwrap();
        let note = make_note("note-1", 2000);

        save_note(tmp.path(), &note).unwrap();
        let loaded = load_global_notes(tmp.path()).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "note-1");
        assert_eq!(loaded[0].title, "Note note-1");
    }

    #[test]
    fn test_save_and_load_project_note() {
        let tmp = tempfile::tempdir().unwrap();
        let mut note = make_note("note-2", 3000);
        note.project_path = Some("/dev/my-project".to_string());

        save_note(tmp.path(), &note).unwrap();

        let encoded = crate::data::path_encoding::encode_project_path(
            &std::path::PathBuf::from("/dev/my-project"),
        );
        let loaded = load_project_notes(tmp.path(), &encoded).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "note-2");
    }

    #[test]
    fn test_notes_sorted_by_modified_desc() {
        let tmp = tempfile::tempdir().unwrap();
        let notes_dir = tmp.path().join("notes");
        std::fs::create_dir_all(&notes_dir).unwrap();

        for (id, modified) in [("old", 1000u64), ("new", 3000), ("mid", 2000)] {
            let note = make_note(id, modified);
            let text = serde_json::to_string_pretty(&note).unwrap();
            std::fs::write(notes_dir.join(format!("{}.json", id)), text).unwrap();
        }

        let loaded = load_global_notes(tmp.path()).unwrap();
        let ids: Vec<&str> = loaded.iter().map(|n| n.id.as_str()).collect();
        assert_eq!(ids, vec!["new", "mid", "old"]);
    }

    #[test]
    fn test_delete_note() {
        let tmp = tempfile::tempdir().unwrap();
        let note = make_note("to-delete", 1000);
        save_note(tmp.path(), &note).unwrap();

        assert_eq!(load_global_notes(tmp.path()).unwrap().len(), 1);
        delete_note(tmp.path(), "to-delete", None).unwrap();
        assert_eq!(load_global_notes(tmp.path()).unwrap().len(), 0);
    }

    #[test]
    fn test_delete_nonexistent_note_ok() {
        let tmp = tempfile::tempdir().unwrap();
        // Should not error when deleting a note that doesn't exist
        delete_note(tmp.path(), "nonexistent", None).unwrap();
    }

    #[test]
    fn test_ignores_non_json_files() {
        let tmp = tempfile::tempdir().unwrap();
        let notes_dir = tmp.path().join("notes");
        std::fs::create_dir_all(&notes_dir).unwrap();
        std::fs::write(notes_dir.join("readme.txt"), "Not a note").unwrap();

        let loaded = load_global_notes(tmp.path()).unwrap();
        assert!(loaded.is_empty());
    }
}
