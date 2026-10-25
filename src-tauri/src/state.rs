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
}

impl AppState {
    pub fn new(db: Database) -> Self {
        let trans_config = crate::translation::TranslationConfig::default();
        let translation_engine = Arc::new(RwLock::new(TranslationEngine::new(trans_config.clone())));
        let copilot_suggester = Arc::new(RwLock::new(CopilotSuggester::new(trans_config)));

        Self {
            db,
            audio_capture: Mutex::new(AudioCaptureService::new()),
            translation_engine,
            copilot_suggester,
            active_session_id: Arc::new(Mutex::new(None)),
            active_src_lang: Arc::new(Mutex::new("en".to_string())),
            active_tgt_lang: Arc::new(Mutex::new("vi".to_string())),
            recent_dialogue: Arc::new(Mutex::new(Vec::new())),
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
