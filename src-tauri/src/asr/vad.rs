pub struct SimpleVad {
    energy_threshold: f32,
    speech_frame_count: usize,
    silence_frame_count: usize,
    min_speech_frames: usize,
    max_silence_frames: usize,
    is_speaking: bool,
}

impl SimpleVad {
    pub fn new(energy_threshold: f32, min_speech_ms: usize, end_silence_ms: usize, frame_ms: usize) -> Self {
        let min_speech_frames = (min_speech_ms / frame_ms).max(1);
        let max_silence_frames = (end_silence_ms / frame_ms).max(1);
        Self {
            energy_threshold,
            speech_frame_count: 0,
            silence_frame_count: 0,
            min_speech_frames,
            max_silence_frames,
            is_speaking: false,
        }
    }

    /// Computes RMS (Root Mean Square) energy of a 16kHz audio slice
    pub fn compute_rms(samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return 0.0;
        }
        let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
        (sum_sq / (samples.len() as f32)).sqrt()
    }

    /// Evaluates audio frame (e.g. 30ms-50ms) and returns (is_currently_speaking, speech_boundary_ended)
    pub fn process_frame(&mut self, samples: &[f32]) -> (bool, bool) {
        let rms = Self::compute_rms(samples);
        let mut boundary_ended = false;

        if rms > self.energy_threshold {
            self.speech_frame_count += 1;
            self.silence_frame_count = 0;
            if self.speech_frame_count >= self.min_speech_frames {
                self.is_speaking = true;
            }
        } else {
            if self.is_speaking {
                self.silence_frame_count += 1;
                if self.silence_frame_count >= self.max_silence_frames {
                    self.is_speaking = false;
                    self.speech_frame_count = 0;
                    self.silence_frame_count = 0;
                    boundary_ended = true;
                }
            } else {
                self.speech_frame_count = 0;
            }
        }

        (self.is_speaking, boundary_ended)
    }

    pub fn reset(&mut self) {
        self.speech_frame_count = 0;
        self.silence_frame_count = 0;
        self.is_speaking = false;
    }
}
