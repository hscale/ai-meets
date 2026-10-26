use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

use crate::audio::AudioCaptureService;
use crate::copilot::CopilotSuggester;
use crate::db::Database;
use crate::translation::TranslationEngine;

pub struct AppState {
    pub db: Database,
    pub audio_capture: Mutex<AudioCaptureService>,
    pub translation_engine: Arc<RwLock<TranslationEngine>>,
    pub copilot_suggester: Arc<RwLock<CopilotSuggester>>,
    pub active_session_id: Arc<Mutex<Option<String>>>,
    pub active_src_lang: Arc<Mutex<String>>,
    pub active_tgt_lang: Arc<Mutex<String>>,
    pub recent_dialogue: Arc<Mutex<Vec<String>>>,
    pub is_overlay_locked: Arc<Mutex<bool>>,
    pub is_copilot_locked: Arc<Mutex<bool>>,
    pub is_copilot_split: Arc<Mutex<bool>>,
}

impl AppState {
    pub fn new(db: Database) -> Self {
        let trans_config = if let Ok(Some(json_str)) = db.get_setting("translation_config") {
            serde_json::from_str(&json_str).unwrap_or_else(|_| crate::translation::TranslationConfig::default())
        } else {
            crate::translation::TranslationConfig::default()
        };
        let translation_engine = Arc::new(RwLock::new(TranslationEngine::new(trans_config.clone())));
        let copilot_suggester = Arc::new(RwLock::new(CopilotSuggester::new(trans_config)));

        let (src_lang, tgt_lang, is_split) = if let Ok(Some(json_str)) = db.get_setting("app_preferences") {
            if let Ok(prefs) = serde_json::from_str::<crate::commands::AppPreferences>(&json_str) {
                (prefs.src_lang, prefs.tgt_lang, prefs.is_copilot_split)
            } else {
                ("en".to_string(), "vi".to_string(), true)
            }
        } else {
            ("en".to_string(), "vi".to_string(), true)
        };

        Self {
            db,
            audio_capture: Mutex::new(AudioCaptureService::new()),
            translation_engine,
            copilot_suggester,
            active_session_id: Arc::new(Mutex::new(None)),
            active_src_lang: Arc::new(Mutex::new(src_lang)),
            active_tgt_lang: Arc::new(Mutex::new(tgt_lang)),
            recent_dialogue: Arc::new(Mutex::new(Vec::new())),
            is_overlay_locked: Arc::new(Mutex::new(false)),
            is_copilot_locked: Arc::new(Mutex::new(false)),
            is_copilot_split: Arc::new(Mutex::new(is_split)),
        }
    }

    pub async fn push_dialogue(&self, speaker: &str, text: &str) {
        let mut d = self.recent_dialogue.lock().await;
        d.push(format!("[{}]: {}", speaker, text));
        if d.len() > 15 {
            d.remove(0);
        }
    }

    pub async fn get_recent_dialogue(&self) -> Vec<String> {
        self.recent_dialogue.lock().await.clone()
    }
}
