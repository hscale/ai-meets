# Changelog

All notable changes to **AI Meets** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-10-26

### Enhanced & Public-Ready
- **Prominent & Unmissable Start Meeting Controls**:
  - Added primary **Start Meeting / Stop Meeting Action Card** directly in the left sidebar navigation right below the brand header, displaying live status indicator (`Recording...` vs `System Ready`) and active language direction (`EN → VI`).
  - Redesigned empty dialogue state on the **Live Meeting** tab with an interactive Hero Card featuring a prominent **Start Meeting Now** button, audio device label, and language preview.
  - Enhanced top header Start/Stop button with bold typography, high-contrast glow, and clear tooltips.
  - Added native **Start / Stop Meeting** option into the System Tray menu.
- **Repository Public-Ready Sanitization**:
  - Sanitized all documentation and codebase to remove legacy research notes, external references, and internal draft artifacts, preparing the project for public open-source distribution.
  - Reframed technical insights in `README.md` and `LESSONS_LEARNED.md` to sound architectural principles covering streaming cadence, VAD segmentation, and multilingual MT optimization.
  - Removed redundant `docs/lessons_learned.md`.

## [0.1.9] - 2026-10-26

### Fixed & Enhanced
- **Persistent Settings & Preferences (SQLite Store & React State Sync)**:
  - **Fixed Settings Form Blank on Re-open**: Resolved race condition where `Dashboard.tsx` form states captured default empty values on mount before `loadInitialData()` resolved asynchronously. Added synchronization `useEffect` so AI model provider, API keys, base URLs, and model identifiers immediately populate with saved database credentials.
  - **Full AppPreferences Persistence**: Added `AppPreferences` data contract in Rust backend and frontend store, persisting meeting language pairs (`src_lang`, `tgt_lang`), default audio input device, subtitles mode (`bilingual` / `single`), copilot mode, HUD box layout (`split` / `docked`), and font size across sessions in SQLite `app_settings`.
  - **Cold-Start Engine Hydration in Rust**: Updated `AppState::new(db)` in `src-tauri/src/state.rs` to hydrate `TranslationEngine`, `CopilotSuggester`, active languages, and window layout mode from SQLite upon application launch, rather than falling back to default localhost configs.
  - **Unified Settings Tab UI**: Added a dedicated **Meeting & Language Preferences** section at the top of the **Settings** tab with language selectors, audio device selection, display modes, and HUD layout options. Replaced intrusive `alert()` with a smooth "Saved & Active" badge.

## [0.1.8] - 2026-10-26

### Added
- **Decoupled Multi-Box Split Architecture (AI Copilot & Live Subtitles)**:
  - Created a dedicated, independent floating HUD window for the AI Copilot (`copilot` window / `/copilot.html`), decoupling it completely from the Live Subtitles window.
  - Enabled free, independent multi-screen positioning: users can now drag the Live Subtitles HUD (e.g. to bottom center) and the AI Copilot HUD (e.g. to top right or a second monitor) independently without interference.
  - Added seamless **Split vs. Docked Layout Switcher**:
    - **Split Mode (Default / 2 Boxes)**: Live Subtitles and AI Copilot exist as two separate floating, draggable windows.
    - **Docked Mode (1 Box)**: Glues the Copilot drawer into the Subtitles HUD for a unified single-window experience.
  - Added dedicated controls across all touchpoints:
    - On Subtitles HUD: Dedicated `X` close button, quick Split/Dock button (`Layers` / `ExternalLink`), and independent Copilot toggle.
    - On Copilot HUD: "Dock with Subtitles" button, click-through lock, and close buttons.
    - In Dashboard: "HUD Layout" switcher (`[Split (2 Boxes) | Docked (1 Box)]`) and independent toggles for Subtitles and Copilot with independent click-through locks.
    - In System Tray: "Toggle Live Subtitles" and "Toggle AI Copilot Window" options.
  - Configured dynamic height tracking with `ResizeObserver` calling `resize_copilot(height)` to ensure zero dead transparent zones.
- **Added Explicit Close Button on Live Subtitles HUD**:
  - Added dedicated `X` close button to the top control bar of the Live Subtitles floating HUD, allowing single-click dismissal without needing to open the Dashboard or System Tray.

## [0.1.7] - 2026-10-26

### Added
- **Single / Bilingual Modes for Live Transcription & AI Copilot**:
  - Added live transcription mode switcher (`[Bilingual | Single]`) across both the floating Subtitles HUD and the Dashboard dialogue stream. Bilingual mode displays both target translation and original source speech; Single mode displays clean translated text only.
  - Added AI Copilot mode switcher (`[Bilingual | Single]`) in `CopilotCard`. Bilingual mode displays both primary answer and secondary/English answer with clear labels, plus question translation; Single mode displays concise primary response only.
- **Keywords Highlighting in AI Copilot**:
  - Implemented `HighlightText` component that highlights `**bold concepts**` as styled pill badges and scans for domain keywords and technical metrics.
  - Added keyword pill tag list (`suggestion.keywords`) rendered at the top of the Copilot card for quick architectural scanning (e.g., *Database-per-Service*, *Expand and Contract*, *Transactional Outbox*, *Zero Downtime*).
- **Selectable, Copyable, and Editable Live Transcription**:
  - Subtitle text is now fully selectable with mouse drag (`select-text cursor-text`) in both Subtitles HUD and Dashboard.
  - Added instant one-click Copy button with visual checkmark feedback on each subtitle item.
  - Added inline Editing with Save (`Check`) and Cancel (`X`) buttons on both Subtitles HUD and Dashboard, persisting edits to SQLite via backend command `update_transcript` and broadcasting real-time updates via `subtitle:updated`.

## [0.1.6] - 2026-10-26

### Fixed
- **AI Copilot Drawer Toggle on Subtitles HUD**:
  - Fixed issue where clicking the `✨` button on the Subtitles HUD did not open the Copilot drawer when no suggestion had arrived yet. The drawer condition was previously bound to `{showCopilot && latestSuggestion}`, which caused the drawer to remain hidden if `latestSuggestion` was null.
  - Sized the empty Copilot state cleanly in compact mode (`Listening for questions in meeting, or type below...`) and preserved the manual question input bar.
  - Added an active state on the `✨` button (`bg-indigo-600 text-white`) and an explicit `X` close button on the drawer header.
  - Added automatic drawer opening when incoming question suggestions arrive via `useEffect`.

- **Graceful Offline Fallback & Diagnostics for AI Copilot**:
  - Resolved silent suggestion failure when the local AI inference engine (e.g., `llama-server` on `127.0.0.1:8080`) is offline or unreachable.
  - Implemented `generate_smart_fallback` in `CopilotSuggester` delivering domain-grounded bullet points, architectural talking points (e.g., dual-write, outbox pattern, strangler fig, zero-downtime migrations for microservices), and sample answers in English, Vietnamese, Japanese, and Chinese based on active Knowledge Profiles.
  - Added clear offline diagnostic advisories (`[Offline Mode: AI backend at http://127.0.0.1:8080/v1 was unreachable]`) inside the sample answer so users immediately know their inference provider status while still receiving instant, actionable meeting talking points.
  - Updated both automatic meeting speech transcription processing and manual question asking to utilize fallback generation on LLM failure, ensuring suggestions are always persisted to SQLite and emitted via `copilot:suggestion` to both the Subtitles HUD and Main Dashboard.

## [0.1.5] - 2026-10-26

### Refactored
- **Renamed "Overlay" to "Subtitles"**:
  - Replaced ambiguous, developer-centric "Overlay" label with user-friendly "Subtitles" across the Dashboard sidebar and System Tray menu (`Toggle Live Subtitles`).
  - Added dynamic active state styling on the Subtitles button reflecting window visibility and click-through lock status.
  - Implemented `toggle_overlay_visible` Tauri command allowing single-click toggle of the Subtitles HUD from the dashboard.

### Fixed
- **Subtitles Window Bounding Box & Mouse Click-Through Occlusion**:
  - Eliminated dead padding (`p-2`), horizontal margins (`max-w-3xl mx-auto`), and top vertical spacing (`flex-col justify-end`) that previously caused the invisible transparent window webview to capture mouse events outside the visible card.
  - Sized the Subtitles window tightly to 760x110 (minHeight 60px) and configured full 100% card width.
  - Added native dynamic height tracking with `ResizeObserver` calling `resize_overlay(height)` in Rust, dynamically expanding the window when the Copilot card drawer opens (~230px) and shrinking it back to fit subtitles only (~110px).
  - Users can now move the mouse directly around the card borders and interact with applications beneath the window without dead-zone mouse interception.

## [0.1.4] - 2026-10-26

### Added
- **OpenAI API Compatible Provider (`openai_compatible`)**:
  - Implemented generic OpenAI-compatible chat completion client supporting custom API Base URLs, Bearer authentication tokens, and arbitrary model names.
  - Enabled one-click presets for popular inference providers: **DeepSeek** (`deepseek-chat`), **Groq** (`llama-3.3-70b-versatile`), **OpenRouter** (`meta-llama/llama-3.3-70b-instruct`), **Together AI** (`meta-llama/Llama-3.3-70B-Instruct-Turbo`), **Mistral** (`mistral-small-latest`), **SiliconFlow** (`deepseek-ai/DeepSeek-V3`), and **Local vLLM / Ollama** (`qwen2.5:7b`).
  - Added robust endpoint normalization (`normalize_openai_endpoint`) automatically handling trailing slashes, root base URLs, and pre-existing `/chat/completions` paths.
  - Wired OpenAI-compatible model dispatch into both real-time meeting translation and the AI Question Copilot suggester.
- **Provider Comparison & Benchmarking Tool**:
  - Added Tauri backend command `test_provider(client_config, sample_text, src_lang, tgt_lang)` executing live isolated inference, measuring round-trip latency in milliseconds, and returning sample translations or diagnostics.
  - Added "Test Active Provider" button with animated latency badge (`⚡ X ms`) and status alert banner in Settings.
  - Added "Multi-Provider Comparison & Benchmark" card evaluating latency and translation fidelity side-by-side across all configured AI backends in a ranked leaderboard.

### Changed
- Extended `TranslationConfig` schema with `custom_endpoint` and `custom_api_key`.
- Updated unit test suite in `translation::engine` and `commands` verifying endpoint normalization and result serialization.

## [0.1.3] - 2026-10-26

### Fixed
- **Tauri v2 ACL Capabilities & Dual-Layer Dragging**:
  - Added `src-tauri/capabilities/default.json` granting `core:default`, `core:window:default`, and `core:window:allow-start-dragging` permissions across all windows, resolving the ACL denial on `plugin:window|start_dragging`.
  - Added native `drag_window` command in Rust (`WebviewWindow::start_dragging`) to guarantee window movement even if client-side plugin ACLs are restricted.
  - Implemented dual-layer dragging: native `-webkit-app-region: drag` for OS WindowServer composited drag and fallback `invoke("drag_window")` on `onMouseDown`.
  - Configured `-webkit-app-region: no-drag` on the right-side control toolbar, subtitles stream, and copilot card drawer so all buttons and selections receive mouse events.
- **Automated UI QA Verification**:
  - Developed and executed an automated Swift/Quartz test suite verifying window movement by (+120, +70) and return, as well as exact coordinate hit-testing for font size buttons (`SM`, `MD`, `LG`).
  - Visually and programmatically confirmed active button states and clean non-rectangular transparency with zero rectangular backdrops.

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
