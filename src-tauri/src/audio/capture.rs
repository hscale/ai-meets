use anyhow::Result;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use log::{error, info};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedSender;

use super::resample::AudioResampler;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub is_loopback: bool,
}

pub struct AudioCaptureService {
    is_running: Arc<AtomicBool>,
}

impl AudioCaptureService {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn list_input_devices() -> Result<Vec<AudioDeviceInfo>> {
        let host = cpal::default_host();
        let default_device = host.default_input_device().and_then(|d| d.name().ok());
        let devices = host.input_devices()?;
        let mut list = Vec::new();

        for dev in devices {
            if let Ok(name) = dev.name() {
                let is_default = default_device.as_deref() == Some(&name);
                list.push(AudioDeviceInfo {
                    id: name.clone(),
                    name: name.clone(),
                    is_default,
                    is_loopback: false,
                });
            }
        }
        Ok(list)
    }

    pub fn list_audio_sources() -> Result<Vec<AudioDeviceInfo>> {
        let mut sources = Vec::new();

        #[cfg(target_os = "macos")]
        sources.push(AudioDeviceInfo {
            id: "system_audio".to_string(),
            name: "System Audio (ScreenCaptureKit Loopback)".to_string(),
            is_default: true,
            is_loopback: true,
        });

        #[cfg(target_os = "windows")]
        sources.push(AudioDeviceInfo {
            id: "system_audio_wasapi".to_string(),
            name: "System Audio (WASAPI Loopback)".to_string(),
            is_default: true,
            is_loopback: true,
        });

        if let Ok(mics) = Self::list_input_devices() {
            sources.extend(mics);
        }

        Ok(sources)
    }

    /// Starts capturing audio in a dedicated OS thread.
    /// This keeps non-Send cpal::Stream completely local to the capture thread.
    pub fn start_capture(
        &mut self,
        device_name: Option<String>,
        tx: UnboundedSender<Vec<f32>>,
    ) -> Result<()> {
        if self.is_running.load(Ordering::SeqCst) {
            return Ok(());
        }

        let is_running = self.is_running.clone();
        is_running.store(true, Ordering::SeqCst);

        std::thread::spawn(move || {
            let host = cpal::default_host();
            let device = match device_name {
                Some(ref name) => match host.input_devices() {
                    Ok(mut devs) => devs.find(|d| d.name().map(|n| n == *name).unwrap_or(false)),
                    Err(e) => {
                        error!("Failed to enumerate input devices: {}", e);
                        return;
                    }
                },
                None => host.default_input_device(),
            };

            let device = match device {
                Some(d) => d,
                None => {
                    error!("No valid audio input device found");
                    return;
                }
            };

            let config = match device.default_input_config() {
                Ok(c) => c,
                Err(e) => {
                    error!("Failed to get default input config: {}", e);
                    return;
                }
            };

            let sample_rate = config.sample_rate().0;
            let channels = config.channels();
            info!(
                "Capture thread started for device '{}' ({} Hz, {} channels)",
                device.name().unwrap_or_default(),
                sample_rate,
                channels
            );

            let resampler = AudioResampler::new(sample_rate, 16000, channels);
            let run_flag = is_running.clone();

            let err_fn = |err| error!("Audio stream runtime error: {:?}", err);

            let stream_res = match config.sample_format() {
                cpal::SampleFormat::F32 => device.build_input_stream(
                    &config.into(),
                    move |data: &[f32], _: &_| {
                        if run_flag.load(Ordering::Relaxed) {
                            let resampled = resampler.process(data);
                            if !resampled.is_empty() {
                                let _ = tx.send(resampled);
                            }
                        }
                    },
                    err_fn,
                    None,
                ),
                cpal::SampleFormat::I16 => device.build_input_stream(
                    &config.into(),
                    move |data: &[i16], _: &_| {
                        if run_flag.load(Ordering::Relaxed) {
                            let f32_data: Vec<f32> = data
                                .iter()
                                .map(|&s| s as f32 / i16::MAX as f32)
                                .collect();
                            let resampled = resampler.process(&f32_data);
                            if !resampled.is_empty() {
                                let _ = tx.send(resampled);
                            }
                        }
                    },
                    err_fn,
                    None,
                ),
                cpal::SampleFormat::U16 => device.build_input_stream(
                    &config.into(),
                    move |data: &[u16], _: &_| {
                        if run_flag.load(Ordering::Relaxed) {
                            let f32_data: Vec<f32> = data
                                .iter()
                                .map(|&s| (s as f32 - 32768.0) / 32768.0)
                                .collect();
                            let resampled = resampler.process(&f32_data);
                            if !resampled.is_empty() {
                                let _ = tx.send(resampled);
                            }
                        }
                    },
                    err_fn,
                    None,
                ),
                format => {
                    error!("Unsupported sample format: {:?}", format);
                    return;
                }
            };

            let stream = match stream_res {
                Ok(s) => s,
                Err(e) => {
                    error!("Failed to build input stream: {}", e);
                    return;
                }
            };

            if let Err(e) = stream.play() {
                error!("Failed to play stream: {}", e);
                return;
            }

            // Keep thread alive until stopped
            while is_running.load(Ordering::Relaxed) {
                std::thread::sleep(std::time::Duration::from_millis(50));
            }

            info!("Audio capture thread terminated cleanly");
        });

        Ok(())
    }

    pub fn stop_capture(&mut self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    pub fn is_active(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }
}
