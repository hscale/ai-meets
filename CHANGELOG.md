# Changelog

All notable changes to **AI Meets** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-10-25

### Fixed
- **Overlay Window Dragging & Interactive Controls**:
  - Implemented explicit programmatic dragging via `getCurrentWindow().startDragging()` on `onMouseDown` on the overlay header bar, ensuring smooth window movement when clicking on text, badges, or icons.
  - Added `data-tauri-drag-region="deep"` and set `pointer-events-none select-none` on decorative header elements.
  - Fixed button click handling on the overlay toolbar (font size switcher, Copilot toggle, Lock button) by isolating event propagation (`onMouseDown`/`onClick` stopPropagation) and removing conflicting drag flags.
  - Removed root `pointer-events-none` from `SubtitleOverlay` and `ComposePopup` which previously hindered WebKit mouse event hit-testing.
  - Added global click-through state synchronization (`is_overlay_locked` in `AppState` + `overlay:lock_changed` IPC event) with toggle support in the System Tray menu and Main Dashboard.

## [0.1.1] - 2026-10-25

### Fixed
- **Overlay Window Transparency & Scoped Glassmorphism**:
  - Removed full-window native vibrancy (`NSVisualEffectMaterial::HudWindow`) and full-window blur in `src-tauri/src/overlay/mod.rs` which rendered an opaque dark-grey rectangular canvas (940x220) around the floating subtitle pill.
  - Added strict `background: transparent !important;` to `<html>`, `<body>`, and `#root` in `overlay.html` and `compose.html`.
  - Added `pointer-events-none` on overlay outer layout and `pointer-events-auto` on subtitle and copilot cards to allow click-through on transparent margins.
  - Enhanced CSS glassmorphism styling (`backdrop-blur-2xl`, `bg-slate-950/90`, `border-slate-700/60`, `rounded-2xl`) cleanly scoped to floating cards.

## [0.1.0] - 2026-10-25

### Added
- **Core Tauri v2 & Rust Application Core**:
  - Implemented multi-window desktop shell hosting `main`, `overlay`, and `compose` webviews.
  - Setup system tray icon with menu actions for quick overlay toggle, click-through lock, and settings.
- **Audio Loopback & Microphone Capture**:
  - Built cross-platform audio service (`cpal`) supporting macOS ScreenCaptureKit and Windows WASAPI loopback.
  - Implemented thread-isolated audio capture runner maintaining `Send + Sync` guarantees.
  - Added real-time resampler converting arbitrary input rates to 16kHz mono float32 for ASR and VAD.
  - Implemented real-time RMS audio waveform visualizer.
- **ASR & Voice Activity Detection**:
  - Implemented energy and zero-crossing rate Voice Activity Detection (`SimpleVad`).
  - Added sliding speech segmentation buffer with configurable min/max speech durations and end-silence thresholds.
- **Hybrid Machine Translation Engine**:
  - Supported local OpenAI-compatible endpoints (`llama-server` / `Ollama`) with Hunyuan-MT2 models.
  - Added cloud API integrations for OpenAI (`gpt-4o-mini`), Anthropic Claude (`claude-3-5-sonnet`), and Google Gemini (`gemini-2.0-flash`).
  - Added in-context glossary terminology injection from local SQLite dictionary.
- **Real-Time AI Question Detection & Answer Suggestion Copilot**:
  - Built multi-lingual heuristic question intent classifier covering EN, VI, JA, ZH, and KO patterns.
  - Implemented contextual Knowledge Profiles management (Resume/CV for interviews, Battlecards for sales, Meeting agendas).
  - Added rolling conversation context buffer maintaining the last 15 dialogue turns.
  - Implemented real-time asynchronous answer generation providing structured bullet-point talking points and concise suggested responses.
- **Floating Subtitles & Subtitle Controls**:
  - Created glassmorphic always-on-top subtitle overlay with native vibrancy blur.
  - Added click-through lock toggle (`set_ignore_cursor_events`) to prevent interference during presentations.
  - Supported bilingual view, configurable font sizes, and embedded Copilot card drawer.
- **Type & Translate ("Compose Mode")**:
  - Added global shortcut (`F2`) quick input bar for on-the-fly translation.
  - Implemented synthetic auto-paste keystroke automation (`Cmd+V` / `Ctrl+V`).
- **Session History & Export**:
  - Added SQLite database storage for sessions and transcripts.
  - Implemented export functionality supporting SubRip (`.srt`), Markdown (`.md`), and CSV (`.csv`) formats.
- **Production Build & Packaging**:
  - Configured macOS permissions in `Info.plist` (`NSAudioCaptureUsageDescription`, `NSMicrophoneUsageDescription`).
  - Generated application bundles: `AI Meets.app` (17.61 MiB) and `AI Meets_0.1.0_aarch64.dmg` (6.77 MiB).
