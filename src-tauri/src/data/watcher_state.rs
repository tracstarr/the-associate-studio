use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct WatcherState {
    #[serde(default)]
    pub hook_offsets: HashMap<String, u64>,
}

impl WatcherState {
    pub fn load(ide_dir: &Path) -> Self {
        let path = ide_dir.join("watcher-state.json");
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, ide_dir: &Path) {
        let path = ide_dir.join("watcher-state.json");
        if let Ok(json) = serde_json::to_string(self) {
            std::fs::write(path, json).ok();
        }
    }

    pub fn get_offset(&self, key: &str) -> Option<u64> {
        self.hook_offsets.get(key).copied()
    }

    pub fn set_offset(&mut self, key: String, offset: u64) {
        self.hook_offsets.insert(key, offset);
    }
}
