pub mod vad;

use serde::{Deserialize, Serialize};
use std::time::Instant;
pub use vad::SimpleVad;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeechSegment {
    pub id: String,
    pub session_id: String,
    pub timestamp_ms: i64,
    pub speaker: String,
    pub text: String,
    pub is_final: bool,
}

pub struct SpeechPipelineConfig {
    pub energy_threshold: f32, // default ~0.015
    pub min_speech_ms: usize,  // default ~200ms
    pub end_silence_ms: usize, // default ~500ms
    pub max_speech_ms: usize,  // default ~8000ms
}

impl Default for SpeechPipelineConfig {
    fn default() -> Self {
        Self {
            energy_threshold: 0.015,
            min_speech_ms: 200,
            end_silence_ms: 500,
            max_speech_ms: 8000,
        }
    }
}

pub struct SpeechBuffer {
    vad: SimpleVad,
    config: SpeechPipelineConfig,
    current_audio: Vec<f32>,
    session_start: Instant,
    speaker: String,
}

impl SpeechBuffer {
    pub fn new(config: SpeechPipelineConfig, speaker: String) -> Self {
        let vad = SimpleVad::new(config.energy_threshold, config.min_speech_ms, config.end_silence_ms, 30);
        Self {
            vad,
            config,
            current_audio: Vec::new(),
            session_start: Instant::now(),
            speaker,
        }
    }

    /// Feeds incoming 16kHz mono audio chunks.
    /// Returns Some((timestamp_ms, audio_samples)) when a speech segment is completed.
    pub fn feed(&mut self, chunk: &[f32]) -> Option<(i64, Vec<f32>)> {
        self.current_audio.extend_from_slice(chunk);
        let (_is_speaking, boundary_ended) = self.vad.process_frame(chunk);

        let max_samples = (self.config.max_speech_ms * 16000) / 1000;
        let force_cut = self.current_audio.len() >= max_samples;

        if (boundary_ended || force_cut) && !self.current_audio.is_empty() {
            let timestamp_ms = self.session_start.elapsed().as_millis() as i64;
            let audio_segment = std::mem::take(&mut self.current_audio);
            self.vad.reset();
            return Some((timestamp_ms, audio_segment));
        }

        None
    }

    pub fn speaker(&self) -> &str {
        &self.speaker
    }
}
