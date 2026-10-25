use anyhow::Result;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRecord {
    pub id: String,
    pub title: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub src_lang: String,
    pub tgt_lang: String,
    pub audio_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptRecord {
    pub id: String,
    pub session_id: String,
    pub speaker: String,
    pub timestamp_ms: i64,
    pub src_text: String,
    pub tgt_text: String,
    pub is_question: bool,
    pub suggested_answer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlossaryEntry {
    pub id: i64,
    pub source: String,
    pub target: String,
    pub match_key: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeProfile {
    pub id: String,
    pub name: String,
    pub profile_type: String, // "interview", "sales", "meeting", "custom"
    pub content: String,      // Raw text of CV, battlecard, FAQ, or notes
    pub is_active: bool,
    pub updated_at: String,
}

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(app_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&app_dir)?;
        let db_path = app_dir.join("aimeets.db");
        let conn = Connection::open(db_path)?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                src_lang TEXT NOT NULL,
                tgt_lang TEXT NOT NULL,
                audio_source TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS transcripts (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                speaker TEXT NOT NULL,
                timestamp_ms INTEGER NOT NULL,
                src_text TEXT NOT NULL,
                tgt_text TEXT NOT NULL,
                is_question INTEGER NOT NULL DEFAULT 0,
                suggested_answer TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS glossary (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                target TEXT NOT NULL,
                match_key TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                profile_type TEXT NOT NULL,
                content TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            ",
        )?;

        Ok(())
    }

    // Sessions & Transcripts
    pub fn create_session(&self, session: &SessionRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO sessions (id, title, started_at, ended_at, src_lang, tgt_lang, audio_source)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                session.id,
                session.title,
                session.started_at,
                session.ended_at,
                session.src_lang,
                session.tgt_lang,
                session.audio_source
            ],
        )?;
        Ok(())
    }

    pub fn end_session(&self, session_id: &str, ended_at: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE sessions SET ended_at = ?1 WHERE id = ?2",
            params![ended_at, session_id],
        )?;
        Ok(())
    }

    pub fn insert_transcript(&self, t: &TranscriptRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO transcripts (id, session_id, speaker, timestamp_ms, src_text, tgt_text, is_question, suggested_answer)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                t.id,
                t.session_id,
                t.speaker,
                t.timestamp_ms,
                t.src_text,
                t.tgt_text,
                if t.is_question { 1 } else { 0 },
                t.suggested_answer
            ],
        )?;
        Ok(())
    }

    pub fn list_sessions(&self) -> Result<Vec<SessionRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, title, started_at, ended_at, src_lang, tgt_lang, audio_source FROM sessions ORDER BY started_at DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok(SessionRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                started_at: row.get(2)?,
                ended_at: row.get(3)?,
                src_lang: row.get(4)?,
                tgt_lang: row.get(5)?,
                audio_source: row.get(6)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_session_transcripts(&self, session_id: &str) -> Result<Vec<TranscriptRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, speaker, timestamp_ms, src_text, tgt_text, is_question, suggested_answer
             FROM transcripts WHERE session_id = ?1 ORDER BY timestamp_ms ASC"
        )?;
        let rows = stmt.query_map(params![session_id], |row| {
            let is_q: i32 = row.get(6)?;
            Ok(TranscriptRecord {
                id: row.get(0)?,
                session_id: row.get(1)?,
                speaker: row.get(2)?,
                timestamp_ms: row.get(3)?,
                src_text: row.get(4)?,
                tgt_text: row.get(5)?,
                is_question: is_q == 1,
                suggested_answer: row.get(7)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn delete_session(&self, session_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM transcripts WHERE session_id = ?1", params![session_id])?;
        conn.execute("DELETE FROM sessions WHERE id = ?1", params![session_id])?;
        Ok(())
    }

    pub fn clear_all_history(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM transcripts", [])?;
        conn.execute("DELETE FROM sessions", [])?;
        Ok(())
    }

    // Glossary
    pub fn list_glossary(&self) -> Result<Vec<GlossaryEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, source, target, match_key, created_at FROM glossary ORDER BY id DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok(GlossaryEntry {
                id: row.get(0)?,
                source: row.get(1)?,
                target: row.get(2)?,
                match_key: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn add_glossary_entry(&self, source: &str, target: &str) -> Result<i64> {
        let match_key = source.trim().to_lowercase();
        let created_at = chrono::Utc::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO glossary (source, target, match_key, created_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(match_key) DO UPDATE SET target = excluded.target",
            params![source.trim(), target.trim(), match_key, created_at],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn delete_glossary_entry(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM glossary WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Profiles / Knowledge Base
    pub fn list_profiles(&self) -> Result<Vec<KnowledgeProfile>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, profile_type, content, is_active, updated_at FROM profiles ORDER BY updated_at DESC")?;
        let rows = stmt.query_map([], |row| {
            let active: i32 = row.get(4)?;
            Ok(KnowledgeProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                profile_type: row.get(2)?,
                content: row.get(3)?,
                is_active: active == 1,
                updated_at: row.get(5)?,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn save_profile(&self, profile: &KnowledgeProfile) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO profiles (id, name, profile_type, content, is_active, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, profile_type = excluded.profile_type,
             content = excluded.content, is_active = excluded.is_active, updated_at = excluded.updated_at",
            params![
                profile.id,
                profile.name,
                profile.profile_type,
                profile.content,
                if profile.is_active { 1 } else { 0 },
                profile.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn set_active_profile(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE profiles SET is_active = 0", [])?;
        conn.execute("UPDATE profiles SET is_active = 1 WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_active_profile(&self) -> Result<Option<KnowledgeProfile>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, profile_type, content, is_active, updated_at FROM profiles WHERE is_active = 1 LIMIT 1")?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            let active: i32 = row.get(4)?;
            Ok(Some(KnowledgeProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                profile_type: row.get(2)?,
                content: row.get(3)?,
                is_active: active == 1,
                updated_at: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn delete_profile(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM profiles WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Settings
    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }
}
