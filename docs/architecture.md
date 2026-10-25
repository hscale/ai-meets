# AI Meets Architecture Specification

## Overview

**AI Meets** is a cross-platform desktop application designed for real-time meeting transcription, bidirectional translation, and AI-driven question answering (Meeting & Interview Copilot). The software runs locally on macOS and Windows, integrating native audio loopback capture, Voice Activity Detection (VAD), speech-to-text, machine translation, and contextual answer suggestion.

---

## Process & Subsystem Architecture

```
+-----------------------------------------------------------------------------------+
|                              TAURI V2 HOST PROCESS                                |
|                                                                                   |
|  +--------------------------+  +--------------------------+  +-----------------+  |
|  |     Main Webview         |  |     Overlay Webview      |  | Compose Webview |  |
|  |  Dashboard & Settings    |  | Transparent Subtitles HUD|  | Type & Translate|  |
|  +------------+-------------+  +------------+-------------+  +--------+--------+  |
|               |                             |                         |           |
|               +----------------------+------+-------------------------+           |
|                                      |                                            |
|                              Tauri IPC Protocol                                   |
|                                      v                                            |
|  +-----------------------------------------------------------------------------+  |
|  |                               Rust Core                                     |  |
|  |                                                                             |  |
|  |  +--------------------+  +----------------------+  +---------------------+  |  |
|  |  | Audio Capture Svc  |  |   ASR & VAD Pipeline |  | Translation Engine  |  |  |
|  |  | (ScreenCaptureKit/ |  | (Silero VAD +         |  | (Local llama-server|  |  |
|  |  |  WASAPI / CPAL)    |  |  Resampler 16kHz)    |  |  Cloud APIs)        |  |  |
|  |  +---------+----------+  +----------+-----------+  +----------+----------+  |  |
|  |            |                        |                         |             |  |
|  |            v                        v                         v             |  |
|  |  +--------------------+  +----------------------+  +---------------------+  |  |
|  |  | Lock-free Buffer   |  | Copilot Detector &   |  | SQLite Persistence  |  |  |
|  |  | (rtrb / channels)  |  | Answer Suggester     |  | (Sessions, Terms)   |  |  |
|  |  +--------------------+  +----------------------+  +---------------------+  |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## Core Components

### 1. Audio Capture Engine (`src-tauri/src/audio/`)
- **System Audio Loopback**:
  - **macOS 14.2+**: Utilizes `ScreenCaptureKit` process loopback without virtual audio device extensions (zero-driver dependency).
  - **Windows 10/11**: Uses WASAPI Loopback capture via `cpal` / `windows-sys`.
- **Microphone Chain**:
  - Independent microphone stream for local speaker audio.
  - Multi-channel downmixing to mono.
  - Linear/sinc interpolation resampler converting arbitrary input sample rates (44.1kHz, 48kHz, 96kHz) to uniform **16,000 Hz, 32-bit float mono**.

### 2. Speech Segmentation & VAD (`src-tauri/src/asr/`)
- **Voice Activity Detection**:
  - Analyzes 30ms audio frames calculating Root-Mean-Square (RMS) signal energy and zero-crossing rates.
  - Enforces speech onset (`min_speech_ms`) and trailing boundary detection (`end_silence_ms`).
  - Implements forced segmentation windows (`max_speech_ms`) to prevent buffer overflow during continuous speech.

### 3. Translation & Glossary Pipeline (`src-tauri/src/translation/`)
- **Hybrid AI Providers**:
  - **Local Model**: OpenAI-compatible endpoint (`/v1/chat/completions`) connecting to `llama-server` or `Ollama`. Defaults to Tencent's `Hunyuan-MT2 1.8B` or `LMT-60 0.6B`.
  - **OpenAI-Compatible Custom Backends (`openai_compatible`)**: Generic client supporting arbitrary Base URLs (DeepSeek, Groq, OpenRouter, Together AI, Mistral, SiliconFlow, local vLLM/Ollama), custom Bearer tokens, and model identifiers. Includes canonical endpoint normalizer (`normalize_openai_endpoint`).
  - **Cloud APIs**: Official native integrations for OpenAI (`gpt-4o-mini`, `gpt-4o`), Anthropic Claude (`claude-3-5-sonnet`, `claude-3-haiku`), Google Gemini (`gemini-2.0-flash`).
- **Live Provider Benchmarking & Comparison (`commands::test_provider`)**:
  - Measures millisecond round-trip latency (`Instant::now()`) and captures translated text across candidate backends.
  - Returns structured `ProviderTestResult` with execution diagnostics, allowing side-by-side leaderboard ranking without altering active session config.
- **In-Context Glossary Injection**:
  - SQLite terminology lookups matching words in the source utterance.
  - Injects constraints into prompt: `"Source Term" translates to "Target Term"`.

### 4. AI Question Detection & Answer Suggester (`src-tauri/src/copilot/`)
- **Multi-Lingual Question Detector**:
  - Regex-based heuristic detector covering English, Vietnamese, Japanese, Chinese, and Korean interrogative patterns.
  - Detects explicit interrogatives (5W1H), auxiliary verb questions (*can you*, *could you*, *have you*), and conversational question patterns.
- **Contextual Knowledge Grounding**:
  - Retrieves active Knowledge Profile (Resume/CV, Product Battlecards, Meeting Agenda).
  - Rolling conversation buffer (last 10–15 turns).
- **Asynchronous Suggestion Dispatch**:
  - Dispatches non-blocking query to the selected LLM.
  - Emits real-time `copilot:suggestion` payload containing structured bullet-point talking points and a concise suggested answer.

### 5. Multi-Window Presentation (`src-tauri/src/overlay/` & `src-tauri/src/compose/`)
- **Live Subtitles HUD**:
  - Floating transparent window with true non-rectangular background transparency.
  - Tightly bounded frame (760x110 default, minHeight 60) with `m-0 p-0` outer container eliminating transparent dead-zones that intercept mouse clicks.
  - Native dynamic height resizing (`commands::resize_overlay` + `ResizeObserver`) synchronizing physical window height with visual card height when the Copilot drawer expands (~230px) or collapses (~110px).
  - Avoids full-window native vibrancy/blur (e.g. `NSVisualEffectMaterial::HudWindow`) to prevent an opaque rectangular bounding box around floating pills.
  - Applies CSS glassmorphism (`backdrop-filter: blur()`, `rounded-2xl`, translucent borders) scoped directly to the subtitle card and copilot drawer.
  - Single-click toggle from Dashboard or Tray menu (`toggle_overlay_visible`) and click-through lock toggle (`set_ignore_cursor_events`).
- **Type & Translate (Compose)**:
  - Global hotkey (`F2`) triggers a floating quick translation palette.
  - Auto-paste mechanism simulating platform clipboard copy and synthetic paste keystroke (`Cmd+V` / `Ctrl+V`).

### 6. Storage & Database (`src-tauri/src/db.rs`)
- SQLite schema with foreign-key cascading:
  - `sessions`: Session metadata, duration, language pairs, audio device.
  - `transcripts`: Timestamped speech records, original and translated text, question flags, and generated suggestions.
  - `glossary`: Custom dictionary mapping with unique match keys.
  - `profiles`: User knowledge bases with active profile state.
  - `app_settings`: Persistent key-value configuration.
