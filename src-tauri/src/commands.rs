use anyhow::Result;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use uuid::Uuid;

use crate::audio::{AudioCaptureService, AudioDeviceInfo};
use crate::compose::ComposeManager;
use crate::copilot::{QuestionDetector, QuestionSuggestion};
use crate::db::{GlossaryEntry, KnowledgeProfile, SessionRecord, TranscriptRecord};
use crate::overlay::OverlayManager;
use crate::state::AppState;
use crate::translation::TranslationConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStatus {
    pub is_recording: bool,
    pub session_id: Option<String>,
    pub src_lang: String,
    pub tgt_lang: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveSubtitleEvent {
    pub id: String,
    pub session_id: String,
    pub speaker: String,
    pub timestamp_ms: i64,
    pub src_text: String,
    pub tgt_text: String,
    pub is_question: bool,
    pub is_final: bool,
}

// -------------------------------------------------------------
// Audio & Devices
// -------------------------------------------------------------

#[tauri::command]
pub async fn list_audio_sources() -> Result<Vec<AudioDeviceInfo>, String> {
    AudioCaptureService::list_audio_sources().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_input_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    AudioCaptureService::list_input_devices().map_err(|e| e.to_string())
}

// -------------------------------------------------------------
// Session Management
// -------------------------------------------------------------

#[tauri::command]
pub async fn start_session(
    app: AppHandle,
    state: State<'_, AppState>,
    title: String,
    src_lang: String,
    tgt_lang: String,
    audio_source: String,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    let started_at = chrono::Utc::now().to_rfc3339();

    let record = SessionRecord {
        id: session_id.clone(),
        title: if title.is_empty() { "Untitled Meeting".to_string() } else { title },
        started_at,
        ended_at: None,
        src_lang: src_lang.clone(),
        tgt_lang: tgt_lang.clone(),
        audio_source: audio_source.clone(),
    };

    state.db.create_session(&record).map_err(|e| e.to_string())?;

    *state.active_session_id.lock().await = Some(session_id.clone());
    *state.active_src_lang.lock().await = src_lang;
    *state.active_tgt_lang.lock().await = tgt_lang;
    state.recent_dialogue.lock().await.clear();

    // Start background audio capture
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Vec<f32>>();
    let dev_name = if audio_source == "system_audio" || audio_source == "system_audio_wasapi" {
        None
    } else {
        Some(audio_source)
    };

    let mut capture = state.audio_capture.lock().await;
    if let Err(e) = capture.start_capture(dev_name, tx) {
        log::warn!("Audio capture device start fallback warning: {}", e);
    }

    // Spawn audio processor task emitting volume levels
    let app_handle = app.clone();
    tokio::spawn(async move {
        while let Some(chunk) = rx.recv().await {
            let rms = crate::asr::SimpleVad::compute_rms(&chunk);
            let _ = app_handle.emit("audio:level", rms);
        }
    });

    // Show overlay by default when session starts
    let _ = OverlayManager::set_visible(&app, true);

    Ok(session_id)
}

#[tauri::command]
pub async fn stop_session(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let active_id = {
        let mut id_lock = state.active_session_id.lock().await;
        id_lock.take()
    };

    if let Some(session_id) = active_id {
        let ended_at = chrono::Utc::now().to_rfc3339();
        let _ = state.db.end_session(&session_id, &ended_at);
    }

    state.audio_capture.lock().await.stop_capture();
    let _ = app.emit("session:stopped", ());
    Ok(())
}

#[tauri::command]
pub async fn get_app_status(state: State<'_, AppState>) -> Result<AppStatus, String> {
    let is_recording = state.active_session_id.lock().await.is_some();
    let session_id = state.active_session_id.lock().await.clone();
    let src_lang = state.active_src_lang.lock().await.clone();
    let tgt_lang = state.active_tgt_lang.lock().await.clone();

    Ok(AppStatus {
        is_recording,
        session_id,
        src_lang,
        tgt_lang,
    })
}

// -------------------------------------------------------------
// Live Speech Ingestion & Copilot Processing
// -------------------------------------------------------------

#[tauri::command]
pub async fn process_speech_chunk(
    app: AppHandle,
    state: State<'_, AppState>,
    speaker: String,
    src_text: String,
) -> Result<LiveSubtitleEvent, String> {
    let session_id = state.active_session_id.lock().await.clone().unwrap_or_else(|| "live-test".to_string());
    let src_lang = state.active_src_lang.lock().await.clone();
    let tgt_lang = state.active_tgt_lang.lock().await.clone();

    let glossary_items = state.db.list_glossary().unwrap_or_default();
    let glossary_pairs: Vec<(String, String)> = glossary_items.into_iter().map(|g| (g.source, g.target)).collect();

    // 1. Translate
    let tgt_text = {
        let engine = state.translation_engine.read().await;
        engine.translate(&src_text, &src_lang, &tgt_lang, &glossary_pairs).await.unwrap_or_else(|_| src_text.clone())
    };

    // 2. Check if question
    let is_question = QuestionDetector::is_question(&src_text);

    let event_id = Uuid::new_v4().to_string();
    let timestamp_ms = chrono::Utc::now().timestamp_millis();

    state.push_dialogue(&speaker, &src_text).await;

    let event = LiveSubtitleEvent {
        id: event_id.clone(),
        session_id: session_id.clone(),
        speaker: speaker.clone(),
        timestamp_ms,
        src_text: src_text.clone(),
        tgt_text: tgt_text.clone(),
        is_question,
        is_final: true,
    };

    // Emit live subtitle event to both main and overlay windows
    let _ = app.emit("subtitle:stream", &event);

    // 3. If question, trigger AI Copilot Suggestion in background!
    if is_question {
        let app_handle = app.clone();
        let db = state.db.clone();
        let suggester = state.copilot_suggester.clone();
        let q_id = event_id.clone();
        let q_text = src_text.clone();
        let target_lang = tgt_lang.clone();
        let recent_history = state.get_recent_dialogue().await;
        let s_id = session_id.clone();
        let spk = speaker.clone();

        tokio::spawn(async move {
            let active_profile = db.get_active_profile().ok().flatten();
            let knowledge_text = active_profile.as_ref().map(|p| p.content.as_str());

            let suggester_guard = suggester.read().await;
            let suggestion = match suggester_guard.generate_suggestion(
                &q_id,
                &q_text,
                &recent_history,
                knowledge_text,
                &target_lang,
            ).await {
                Ok(s) => s,
                Err(err) => {
                    eprintln!("Copilot backend query failed: {}. Generating contextual fallback.", err);
                    suggester_guard.generate_smart_fallback(
                        &q_id,
                        &q_text,
                        &recent_history,
                        knowledge_text,
                        &target_lang,
                        &err.to_string(),
                    )
                }
            };

            let _ = app_handle.emit("copilot:suggestion", &suggestion);
            if let Some(copilot_win) = app_handle.get_webview_window("copilot") {
                let _ = copilot_win.show();
                let _ = app_handle.emit("copilot:visibility_changed", true);
            }

            let transcript_rec = TranscriptRecord {
                id: q_id,
                session_id: s_id,
                speaker: spk,
                timestamp_ms,
                src_text,
                tgt_text,
                is_question: true,
                suggested_answer: Some(suggestion.sample_answer),
            };
            let _ = db.insert_transcript(&transcript_rec);
        });
    } else {
        let transcript_rec = TranscriptRecord {
            id: event_id,
            session_id,
            speaker,
            timestamp_ms,
            src_text,
            tgt_text,
            is_question: false,
            suggested_answer: None,
        };
        let _ = state.db.insert_transcript(&transcript_rec);
    }

    Ok(event)
}

// -------------------------------------------------------------
// Manual Copilot Ask
// -------------------------------------------------------------

#[tauri::command]
pub async fn ask_copilot_manual(
    app: AppHandle,
    state: State<'_, AppState>,
    question_text: String,
) -> Result<QuestionSuggestion, String> {
    let q_id = Uuid::new_v4().to_string();
    let tgt_lang = state.active_tgt_lang.lock().await.clone();
    let active_profile = state.db.get_active_profile().map_err(|e| e.to_string())?;
    let knowledge_text = active_profile.as_ref().map(|p| p.content.as_str());
    let recent_history = state.get_recent_dialogue().await;

    let suggester = state.copilot_suggester.read().await;
    let suggestion = match suggester.generate_suggestion(
        &q_id,
        &question_text,
        &recent_history,
        knowledge_text,
        &tgt_lang,
    ).await {
        Ok(s) => s,
        Err(err) => {
            eprintln!("Manual Copilot query failed: {}. Generating contextual fallback.", err);
            suggester.generate_smart_fallback(
                &q_id,
                &question_text,
                &recent_history,
                knowledge_text,
                &tgt_lang,
                &err.to_string(),
            )
        }
    };

    let _ = app.emit("copilot:suggestion", &suggestion);
    if let Some(copilot_win) = app.get_webview_window("copilot") {
        let _ = copilot_win.show();
        let _ = app.emit("copilot:visibility_changed", true);
    }
    Ok(suggestion)
}

// -------------------------------------------------------------
// Overlay & Compose Windows
// -------------------------------------------------------------

#[tauri::command]
pub async fn drag_window(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e: tauri::Error| e.to_string())
}

#[tauri::command]
pub async fn set_overlay_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    if visible {
        let _ = app.emit("overlay:visibility_changed", true);
    } else {
        let _ = app.emit("overlay:visibility_changed", false);
    }
    OverlayManager::set_visible(&app, visible).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_overlay_visible(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        let is_vis = window.is_visible().unwrap_or(false);
        if is_vis {
            window.hide().map_err(|e| e.to_string())?;
            let _ = app.emit("overlay:visibility_changed", false);
            Ok(false)
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            let _ = app.emit("overlay:visibility_changed", true);
            Ok(true)
        }
    } else {
        Err("Overlay window not found".to_string())
    }
}

#[tauri::command]
pub async fn resize_overlay(app: AppHandle, width: Option<f64>, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("overlay") {
        let current_size = window.inner_size().map_err(|e| e.to_string())?;
        let scale = window.scale_factor().unwrap_or(1.0);
        let target_width = width.unwrap_or((current_size.width as f64) / scale);
        // Ensure height is at least 60px
        let safe_height = height.max(60.0);
        window
            .set_size(tauri::LogicalSize::new(target_width, safe_height))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn set_overlay_locked(app: AppHandle, state: State<'_, AppState>, locked: bool) -> Result<(), String> {
    *state.is_overlay_locked.lock().await = locked;
    let _ = app.emit("overlay:lock_changed", locked);
    OverlayManager::set_click_through(&app, locked).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_copilot_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    if visible {
        let _ = app.emit("copilot:visibility_changed", true);
    } else {
        let _ = app.emit("copilot:visibility_changed", false);
    }
    OverlayManager::set_copilot_visible(&app, visible).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_copilot_visible(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("copilot") {
        let is_vis = window.is_visible().unwrap_or(false);
        if is_vis {
            window.hide().map_err(|e| e.to_string())?;
            let _ = app.emit("copilot:visibility_changed", false);
            Ok(false)
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
            let _ = app.emit("copilot:visibility_changed", true);
            Ok(true)
        }
    } else {
        Err("Copilot window not found".to_string())
    }
}

#[tauri::command]
pub async fn resize_copilot(app: AppHandle, width: Option<f64>, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("copilot") {
        let current_size = window.inner_size().map_err(|e| e.to_string())?;
        let scale = window.scale_factor().unwrap_or(1.0);
        let target_width = width.unwrap_or((current_size.width as f64) / scale);
        let safe_height = height.max(60.0);
        window
            .set_size(tauri::LogicalSize::new(target_width, safe_height))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn set_copilot_locked(app: AppHandle, state: State<'_, AppState>, locked: bool) -> Result<(), String> {
    *state.is_copilot_locked.lock().await = locked;
    let _ = app.emit("copilot:lock_changed", locked);
    OverlayManager::set_copilot_click_through(&app, locked).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_copilot_split_mode(app: AppHandle, state: State<'_, AppState>, is_split: bool) -> Result<(), String> {
    *state.is_copilot_split.lock().await = is_split;
    let _ = app.emit("copilot:split_changed", is_split);
    if is_split {
        if let Some(window) = app.get_webview_window("copilot") {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = app.emit("copilot:visibility_changed", true);
        }
    } else {
        if let Some(window) = app.get_webview_window("copilot") {
            let _ = window.hide();
            let _ = app.emit("copilot:visibility_changed", false);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_copilot_split_mode(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(*state.is_copilot_split.lock().await)
}

#[tauri::command]
pub async fn toggle_compose(app: AppHandle) -> Result<(), String> {
    ComposeManager::toggle(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn compose_translate(
    state: State<'_, AppState>,
    text: String,
    src_lang: String,
    tgt_lang: String,
) -> Result<String, String> {
    let glossary_items = state.db.list_glossary().unwrap_or_default();
    let glossary_pairs: Vec<(String, String)> = glossary_items.into_iter().map(|g| (g.source, g.target)).collect();
    let engine = state.translation_engine.read().await;
    engine.translate(&text, &src_lang, &tgt_lang, &glossary_pairs).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn compose_submit(app: AppHandle, translated_text: String) -> Result<(), String> {
    ComposeManager::auto_paste(&translated_text).map_err(|e| e.to_string())?;
    let _ = ComposeManager::toggle(&app);
    Ok(())
}

// -------------------------------------------------------------
// Knowledge Profiles
// -------------------------------------------------------------

#[tauri::command]
pub async fn list_profiles(state: State<'_, AppState>) -> Result<Vec<KnowledgeProfile>, String> {
    state.db.list_profiles().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_profile(state: State<'_, AppState>, profile: KnowledgeProfile) -> Result<(), String> {
    state.db.save_profile(&profile).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_active_profile(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.set_active_profile(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_profile(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_profile(&id).map_err(|e| e.to_string())
}

// -------------------------------------------------------------
// History & Transcripts
// -------------------------------------------------------------

#[tauri::command]
pub async fn list_history(state: State<'_, AppState>) -> Result<Vec<SessionRecord>, String> {
    state.db.list_sessions().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_history_session(state: State<'_, AppState>, session_id: String) -> Result<Vec<TranscriptRecord>, String> {
    state.db.get_session_transcripts(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_history_session(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    state.db.delete_session(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_history(state: State<'_, AppState>) -> Result<(), String> {
    state.db.clear_all_history().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_transcript(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    src_text: String,
    tgt_text: String,
) -> Result<(), String> {
    state.db.update_transcript_text(&id, &src_text, &tgt_text).map_err(|e| e.to_string())?;
    let _ = app.emit("subtitle:updated", serde_json::json!({
        "id": id,
        "src_text": src_text,
        "tgt_text": tgt_text,
    }));
    Ok(())
}

#[tauri::command]
pub async fn export_transcript(state: State<'_, AppState>, session_id: String, format: String) -> Result<String, String> {
    let transcripts = state.db.get_session_transcripts(&session_id).map_err(|e| e.to_string())?;

    match format.to_lowercase().as_str() {
        "srt" => {
            let mut srt = String::new();
            for (idx, t) in transcripts.iter().enumerate() {
                let start_sec = t.timestamp_ms / 1000;
                let end_sec = start_sec + 3;
                let sh = start_sec / 3600;
                let sm = (start_sec % 3600) / 60;
                let ss = start_sec % 60;
                let sms = t.timestamp_ms % 1000;

                let eh = end_sec / 3600;
                let em = (end_sec % 3600) / 60;
                let es = end_sec % 60;
                let ems = sms;

                srt.push_str(&format!("{}\n", idx + 1));
                srt.push_str(&format!("{:02}:{:02}:{:02},{:03} --> {:02}:{:02}:{:02},{:03}\n", sh, sm, ss, sms, eh, em, es, ems));
                srt.push_str(&format!("[{}] {}\n{}\n\n", t.speaker, t.tgt_text, t.src_text));
            }
            Ok(srt)
        }
        "csv" => {
            let mut csv = String::from("id,speaker,timestamp_ms,source,translated,is_question,suggested_answer\n");
            for t in transcripts {
                csv.push_str(&format!(
                    "\"{}\",\"{}\",{},\"{}\",\"{}\",{},\"{}\"\n",
                    t.id,
                    t.speaker,
                    t.timestamp_ms,
                    t.src_text.replace('"', "\"\""),
                    t.tgt_text.replace('"', "\"\""),
                    t.is_question,
                    t.suggested_answer.unwrap_or_default().replace('"', "\"\"")
                ));
            }
            Ok(csv)
        }
        _ => {
            let mut md = String::from("# Meeting Transcript\n\n");
            for t in transcripts {
                let time_str = format!("{:02}:{:02}", (t.timestamp_ms / 1000) / 60, (t.timestamp_ms / 1000) % 60);
                md.push_str(&format!("### `[{}]` **{}**\n", time_str, t.speaker));
                md.push_str(&format!("- **Translation**: {}\n", t.tgt_text));
                md.push_str(&format!("- *Original*: {}\n", t.src_text));
                if let Some(ans) = t.suggested_answer {
                    md.push_str(&format!("> 💡 **AI Suggested Answer**: {}\n", ans));
                }
                md.push('\n');
            }
            Ok(md)
        }
    }
}

// -------------------------------------------------------------
// Glossary
// -------------------------------------------------------------

#[tauri::command]
pub async fn list_glossary(state: State<'_, AppState>) -> Result<Vec<GlossaryEntry>, String> {
    state.db.list_glossary().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_glossary_entry(state: State<'_, AppState>, source: String, target: String) -> Result<i64, String> {
    state.db.add_glossary_entry(&source, &target).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_glossary_entry(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.delete_glossary_entry(id).map_err(|e| e.to_string())
}

// -------------------------------------------------------------
// Settings
// -------------------------------------------------------------

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<TranslationConfig, String> {
    if let Ok(Some(json_str)) = state.db.get_setting("translation_config") {
        if let Ok(cfg) = serde_json::from_str(&json_str) {
            return Ok(cfg);
        }
    }
    Ok(TranslationConfig::default())
}

#[tauri::command]
pub async fn update_settings(state: State<'_, AppState>, settings: TranslationConfig) -> Result<(), String> {
    let json_str = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    state.db.set_setting("translation_config", &json_str).map_err(|e| e.to_string())?;

    state.translation_engine.write().await.update_config(settings.clone());
    state.copilot_suggester.write().await.update_config(settings);
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderTestResult {
    pub provider: String,
    pub model: String,
    pub latency_ms: u64,
    pub translation: String,
    pub success: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn test_provider(
    client_config: TranslationConfig,
    sample_text: String,
    src_lang: String,
    tgt_lang: String,
) -> Result<ProviderTestResult, String> {
    let start = std::time::Instant::now();
    let engine = crate::translation::TranslationEngine::new(client_config.clone());
    let res = engine.translate(&sample_text, &src_lang, &tgt_lang, &[]).await;
    let latency_ms = start.elapsed().as_millis() as u64;

    match res {
        Ok(trans) => Ok(ProviderTestResult {
            provider: client_config.provider,
            model: client_config.model_name,
            latency_ms,
            translation: trans,
            success: true,
            error: None,
        }),
        Err(e) => Ok(ProviderTestResult {
            provider: client_config.provider,
            model: client_config.model_name,
            latency_ms,
            translation: String::new(),
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_test_result_serde() {
        let result = ProviderTestResult {
            provider: "openai_compatible".to_string(),
            model: "deepseek-chat".to_string(),
            latency_ms: 245,
            translation: "Chào mừng mọi người".to_string(),
            success: true,
            error: None,
        };

        let json = serde_json::to_string(&result).expect("Serialize ProviderTestResult");
        assert!(json.contains("245"));
        assert!(json.contains("openai_compatible"));

        let de: ProviderTestResult = serde_json::from_str(&json).expect("Deserialize ProviderTestResult");
        assert_eq!(de.latency_ms, 245);
        assert_eq!(de.translation, "Chào mừng mọi người");
        assert!(de.success);
        assert!(de.error.is_none());
    }
}
