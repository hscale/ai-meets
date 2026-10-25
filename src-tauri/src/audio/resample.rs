pub struct AudioResampler {
    in_sample_rate: u32,
    out_sample_rate: u32,
    channels: u16,
}

impl AudioResampler {
    pub fn new(in_sample_rate: u32, out_sample_rate: u32, channels: u16) -> Self {
        Self {
            in_sample_rate,
            out_sample_rate,
            channels: channels.max(1),
        }
    }

    /// Converts multi-channel interleaved float32 samples to 16kHz mono float32
    pub fn process(&self, input: &[f32]) -> Vec<f32> {
        if input.is_empty() {
            return Vec::new();
        }

        // Step 1: Downmix channels to mono
        let mut mono = Vec::with_capacity(input.len() / self.channels as usize);
        if self.channels == 1 {
            mono.extend_from_slice(input);
        } else {
            for chunk in input.chunks(self.channels as usize) {
                let sum: f32 = chunk.iter().sum();
                mono.push(sum / (chunk.len() as f32));
            }
        }

        if self.in_sample_rate == self.out_sample_rate {
            return mono;
        }

        // Step 2: Linear interpolation resampling
        let ratio = self.in_sample_rate as f64 / self.out_sample_rate as f64;
        let out_len = ((mono.len() as f64) / ratio).floor() as usize;
        let mut resampled = Vec::with_capacity(out_len);

        for i in 0..out_len {
            let in_idx = (i as f64) * ratio;
            let idx0 = in_idx.floor() as usize;
            let idx1 = (idx0 + 1).min(mono.len() - 1);
            let frac = (in_idx - (idx0 as f64)) as f32;

            let sample = mono[idx0] * (1.0 - frac) + mono[idx1] * frac;
            resampled.push(sample);
        }

        resampled
    }
}
