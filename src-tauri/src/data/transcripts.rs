use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::Path;

use anyhow::Result;

use crate::models::transcript::{parse_envelope, TranscriptEnvelope, TranscriptItem};

/// State for incrementally reading a JSONL transcript.
#[derive(Debug)]
pub struct TranscriptReader {
    pub items: Vec<TranscriptItem>,
    pub last_offset: u64,
    pub tail_lines: usize,
}

impl TranscriptReader {
    pub fn with_tail_lines(tail_lines: usize) -> Self {
        Self {
            items: Vec::new(),
            last_offset: 0,
            tail_lines,
        }
    }

    /// Initial load: read last N lines from end of file.
    pub fn load_initial(&mut self, path: &Path) -> Result<()> {
        self.items.clear();
        self.last_offset = 0;

        if !path.exists() {
            return Ok(());
        }

        let content = std::fs::read_to_string(path)?;
        let lines: Vec<&str> = content.lines().collect();
        let start = lines.len().saturating_sub(self.tail_lines);

        for line in &lines[start..] {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if let Ok(envelope) = serde_json::from_str::<TranscriptEnvelope>(line) {
                let parsed = parse_envelope(&envelope);
                self.items.extend(parsed);
            }
        }

        self.last_offset = content.len() as u64;
        Ok(())
    }

    /// Incremental read: only parse new lines since last_offset.
    pub fn read_new(&mut self, path: &Path) -> Result<(bool, usize)> {
        if !path.exists() {
            return Ok((false, 0));
        }

        let file = std::fs::File::open(path)?;
        let file_len = file.metadata()?.len();

        if file_len < self.last_offset {
            self.items.clear();
            self.last_offset = 0;
        }

        if file_len <= self.last_offset {
            return Ok((false, 0));
        }

        let mut reader = BufReader::new(file);
        reader.seek(SeekFrom::Start(self.last_offset))?;

        let mut had_new = false;
        let mut line = String::new();
        loop {
            line.clear();
            let bytes_read = reader.read_line(&mut line)?;
            if bytes_read == 0 {
                break;
            }
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Ok(envelope) = serde_json::from_str::<TranscriptEnvelope>(trimmed) {
                let parsed = parse_envelope(&envelope);
                if !parsed.is_empty() {
                    had_new = true;
                    self.items.extend(parsed);
                }
            }
        }

        const MAX_TRANSCRIPT_ITEMS: usize = 5000;
        let drained = if self.items.len() > MAX_TRANSCRIPT_ITEMS {
            let drain_count = self.items.len() - MAX_TRANSCRIPT_ITEMS;
            self.items.drain(0..drain_count);
            drain_count
        } else {
            0
        };

        self.last_offset = file_len;
        Ok((had_new, drained))
    }
}
