# AI Meets: Real-Time Meeting Translator & AI Copilot

**AI Meets** is a high-performance, cross-platform desktop application designed for real-time meeting transcription, bidirectional translation, and **intelligent live question answering (Meeting & Interview Copilot)**. 

Reverse-engineered and elevated from `AI Translator` (`aitranslator.vn`), AI Meets runs with a native **Tauri v2 (Rust)** core, **React 19** frontend, and a **Hybrid AI engine** supporting both 100% private local models (`llama.cpp`, `whisper.cpp`) and frontier cloud models (OpenAI, Anthropic Claude, Google Gemini).

---

## Key Features

### 1. Real-Time Meeting Transcription & Translation
- **System Audio Capture**: Captures incoming meeting dialogue from Zoom, Google Meet, Microsoft Teams, Slack Huddles, and Web browsers (using **ScreenCaptureKit** on macOS 14.2+ and **WASAPI loopback** on Windows).
- **Microphone Capture**: Independent microphone audio input with noise gate, RMS normalization, and resampling to 16kHz mono float32.
- **Bilingual Subtitles**: Simultaneous display of original spoken utterance and real-time translation across English, Vietnamese, Japanese, Chinese, and Korean.
- **Hybrid AI & OpenAI Compatible Backends**: Choose 100% private zero-cost local models (llama-server / Ollama), frontier cloud APIs (OpenAI, Claude, Gemini), or any **OpenAI API Compatible** provider (DeepSeek, Groq, OpenRouter, Together AI, Mistral, SiliconFlow).
- **Multi-Provider Comparison & Benchmark**: Benchmark round-trip inference latency (ms) and translation fidelity side-by-side across all configured AI backends in real-time.

### 2. Live Floating HUD & Click-Through Subtitles
- **Vibrant Transparent Overlay**: Native floating subtitle bar (`tauri-nspanel` on macOS / DWM acrylic on Windows) that stays on top across full-screen desktops and spaces.
- **Click-Through Lock**: Toggle cursor pass-through mode so subtitles never block screen clicks during presentations or calls.
- **Customizable Styling**: Adjust font sizes, opacity, and toggle the Copilot drawer.

### 3. AI Question Detection & Answer Suggestion Copilot (New Feature)
- **Automatic Question Detection**: Heuristic and semantic intent classifier that immediately detects when an interviewer, client, or colleague asks a question.
- **Knowledge Base Grounding (Profiles)**:
  - **Interview Mode**: Upload your CV/Resume, past achievements, and target role requirements. When technical or behavioral questions are asked, Copilot suggests talking points tailored to your background.
  - **Sales / Demo Mode**: Load product battlecards, pricing tiers, FAQs, and competitor comparisons.
  - **Meeting / Consulting Mode**: Load agendas, technical requirements, and meeting notes.
- **Real-Time Suggestions**: Generates 2-3 punchy talking points and a natural 1-2 sentence suggested response.
- **One-Click Auto-Paste**: Send the suggested response directly to the active meeting chat or app (`Cmd+V` / `Ctrl+V`).

### 4. Type & Translate ("Compose Mode")
- Global hotkey (`F2`) summons a floating Spotlight/Raycast-style input bar.
- Type in any language for instant translation preview.
- Press **Enter** to auto-paste into whatever application was previously focused.

### 5. Custom Glossary & Terminology Mappings
- SQLite dictionary table ensures domain-specific terminology, technical acronyms, or brand names translate accurately via in-context prompt injection.

### 6. Session History & Subtitle Export
- Automatically logs all meeting transcripts with speaker tags and timestamps.
- One-click export to **`.srt`** (SubRip subtitles), **`.md`** (Markdown meeting minutes), or **`.csv`**.

---

## Architecture Overview

```
ai-meets/
├── src-tauri/                     # Rust Desktop Core (Tauri v2)
│   ├── Cargo.toml
│   ├── tauri.conf.json            # 3 Webview Windows: main, overlay, compose
│   └── src/
│       ├── main.rs & lib.rs       # Entrypoint & system tray menu
│       ├── commands.rs            # Tauri invoke commands
│       ├── state.rs               # Thread-safe application state
│       ├── db.rs                  # SQLite storage (sessions, transcripts, glossary, profiles)
│       ├── audio/                 # Audio capture (ScreenCaptureKit, WASAPI, CPAL, resampler)
│       ├── asr/                   # Speech buffer, VAD (Voice Activity Detection), Whisper pipeline
│       ├── translation/           # Translation engine (Local llama-server, OpenAI, Claude, Gemini)
│       ├── copilot/               # Question detector & real-time answer suggester
│       ├── overlay/               # macOS NSPanel & Windows Win32 window management
│       └── compose/               # Type & Translate with auto-paste automation
├── src/                           # React 19 Frontend
│   ├── components/
│   │   ├── Dashboard.tsx          # Main window (Live monitor, Profiles, Glossary, History, Settings)
│   │   ├── SubtitleOverlay.tsx    # Floating transparent subtitles HUD
│   │   ├── CopilotCard.tsx        # Real-time question answering card
│   │   ├── ComposePopup.tsx       # Type & Translate quick popup
│   │   └── AudioVisualizer.tsx    # Audio waveform / RMS visualizer
│   ├── store/useAppStore.ts       # Zustand state management
│   ├── types/index.ts             # TypeScript interfaces
│   ├── main.tsx                   # Main dashboard entry
│   ├── overlay.tsx                # Overlay window entry
│   └── compose.tsx                # Compose popup entry
├── index.html                     # Dashboard HTML
├── overlay.html                   # Overlay HTML
└── compose.html                   # Compose HTML
```

---

## Getting Started

### Prerequisites
- **Node.js** v20+ and **pnpm** (or bun / npm)
- **Rust** 1.78+ (`rustup default stable`)
- macOS 14.2+ (for ScreenCaptureKit) or Windows 10/11 (for WASAPI)

### Installation & Setup

1. Install frontend dependencies:
   ```bash
   pnpm install
   ```

2. Run in development mode (starts Vite + Tauri desktop app):
   ```bash
   pnpm tauri dev
   ```

3. Build production application binary / installer:
   ```bash
   pnpm tauri build
   ```
   *Output binary located at `src-tauri/target/release/ai-meets` or in `src-tauri/target/release/bundle/` (`.dmg` on macOS, `.msi` / `.exe` on Windows).*

---

## AI Model & Provider Options

In the **AI Models & Settings** tab, choose your preferred inference backend:

| Provider | Best For | Privacy | Setup |
| :--- | :--- | :--- | :--- |
| **Local (llama-server / Ollama)** | Complete privacy, zero cloud costs | 100% Local (never leaves device) | Point to `http://127.0.0.1:8080/v1` or `http://127.0.0.1:11434/v1` |
| **OpenAI (`gpt-4o-mini`)** | Fast, high-accuracy translation & Q&A | Cloud | Enter OpenAI API Key (`sk-...`) |
| **Anthropic (`claude-3-5-sonnet`)** | Deep technical interview reasoning | Cloud | Enter Anthropic API Key (`sk-ant-...`) |
| **Google Gemini (`gemini-2.0-flash`)** | Low-latency streaming translation | Cloud | Enter Google Gemini API Key (`AIza...`) |

---

## License
MIT License.
