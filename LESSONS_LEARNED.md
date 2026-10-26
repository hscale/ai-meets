# Engineering Lessons Learned: AI Meets

## 1. Tauri v2 Multi-Webview Lifecycle & Concurrency

### Observation
Tauri v2 allows defining multiple window declarations in `tauri.conf.json` (`main`, `overlay`, `compose`). However, state management across multiple windows requires strict adherence to Rust's concurrency model:
- `tauri::State` must be `Send + Sync`.
- Non-`Send` types (such as `cpal::Stream` on macOS, which holds internal raw pointer closures to CoreAudio HAL) cannot be stored directly inside structs wrapped in `tauri::State`.

### Solution
- **Audio Capture Isolation**: Run the `cpal::Stream` inside a dedicated OS thread (`std::thread::spawn`), controlled via an `Arc<AtomicBool>`. This encapsulates non-`Send` audio streams entirely within their thread boundary while exposing lock-free channels to the async runtime.
- **Async Concurrency**: Use `tokio::sync::RwLock` and `tokio::sync::Mutex` instead of blocking primitives like `parking_lot::RwLock` whenever lock guards are held across `.await` points.

---

## 2. macOS Floating Click-Through Overlays & Gatekeeper

### Observation
- Traditional borderless windows intercept mouse clicks, preventing users from interacting with applications beneath the subtitle bar (Zoom controls, browser tabs, slides).
- Passing macOS Gatekeeper when downloading via curl requires proper removal of the quarantine attribute (`xattr -dr com.apple.quarantine`), and `Info.plist` must explicitly declare `NSAudioCaptureUsageDescription` and `NSMicrophoneUsageDescription`.

### Solution
- **Click-Through Mode**: Integrated `window.set_ignore_cursor_events(locked)` to toggle pass-through mouse events on demand.
- **Vibrancy Styling**: Leveraged `window-vibrancy` (`NSVisualEffectMaterial::HudWindow` on macOS and DWM blur on Windows) to create legible subtitles over varying background content without opaque solid rectangles.

---

## 3. Real-Time Streaming Cadence & Multilingual MT Optimization

### Observation
In live meeting transcription and subtitle translation across rapid dialogue:
- **Streaming Cadence**: Using fixed chunk sizes produces unnatural cuts and fragmented sentences. Implementing a sliding window with cadence factors (`min_cadence_ms: 200`, `max_cadence_ms: 1200`) and VAD-based silence boundaries stabilizes live text delivery.
- **Model Selection**: Compact transformer architectures such as Tencent's `Hunyuan-MT2 1.8B` (`Q8_0` for Standard, `Q4_K_M` for Lite) deliver state-of-the-art accuracy for Asian languages (Vietnamese, Japanese, Chinese, Korean) with memory footprints under 2 GB.
- **In-Context Glossary Prompting**: Rather than fine-tuning or constrained decoding, matching local terms and injecting `"Term" translates to "Target"` into the prompt is fast, resilient, and requires zero retraining.

---

## 4. Real-Time Meeting Copilot: Heuristic vs. Semantic Question Detection

### Observation
Sending every transcript turn to an LLM to determine if an answer is needed introduces latency, token consumption, and noisy UI notifications.

### Solution
- **Two-Tier Intent Gating**:
  1. **Tier 1 (Instant Heuristic Filter)**: Regex evaluation across multiple languages for interrogative syntax, 5W1H markers, and question marks (`< 1ms`).
  2. **Tier 2 (Context-Grounded Generation)**: Only when Tier 1 triggers does the background engine query the LLM with the active Knowledge Profile (Resume, Battlecard, Agenda) and recent turns.
- **UI Decoupling**: Answer suggestions stream into a dedicated Copilot card that can be docked or collapsed independently from the subtitle stream, ensuring subtitle rendering remains sub-50ms.

---

## 5. Generic OpenAI-Compatible Backends & Multi-Provider Benchmarking

### Observation
- Many modern fast AI inference services (DeepSeek, Groq, OpenRouter, Together AI, Mistral, SiliconFlow, Ollama, vLLM) adhere to the OpenAI REST specification (`/chat/completions`), but users provide disparate endpoint URL formats (e.g., `https://api.deepseek.com/v1`, `https://api.deepseek.com/v1/`, or full paths ending in `/chat/completions`).
- Users frequently ask which provider delivers the lowest latency for live meeting transcription and subtitle translation. Relying on marketing claims or static tables does not reflect real-time network conditions or geographical distances.

### Solution
- **Canonical Endpoint Normalization**:
  Created `normalize_openai_endpoint` that cleans whitespace, strips trailing slashes, and idempotently appends `/chat/completions` if not already present. This prevents redundant double paths (e.g. `/chat/completions/chat/completions`) while allowing users to enter either the root host or the full completion URL.
- **Isolated Benchmarking (`test_provider`)**:
  Instead of mutating global state or requiring active meeting audio, the `test_provider` command instantiates a transient `TranslationEngine` configured on-the-fly, sends a standardized meeting phrase ("Welcome everyone to our project architecture review meeting."), and measures high-resolution round-trip latency (`Instant::now()`).
- **Graceful Fault Reporting**:
  Network timeouts, bad keys, or unreachable endpoints are captured inside `ProviderTestResult { success: false, error: Some(err) }` rather than rejecting IPC promises, enabling multi-provider comparisons to execute in parallel or sequentially without breaking UI state.

---

## 6. Transparent Window Bounding Boxes & Mouse Hit-Testing Pitfalls

### Observation
- On macOS, a transparent `NSWindow` containing a `WKWebView` will intercept mouse clicks across the entire WebKit `NSView` rectangular frame (`window.width x window.height`), even if HTML elements inside are transparent or have zero opacity.
- Sizing a transparent window larger than its inner visual card (e.g. `940x220` with a centered `768px` card and `p-2` padding) creates invisible "dead zones" around the card (up to 86px on left/right and 120px on top) that intercept mouse clicks and prevent users from clicking on underlying application controls (such as Zoom controls, browser tabs, or code editors).

### Solution
- **Zero Outer Margins / Padding**:
  The outer webview container must have `m-0 p-0` and span `w-full`, ensuring the physical native window frame exactly tracks the visual boundary of the card.
- **Dynamic Window Height Resizing (`ResizeObserver` + Native IPC)**:
  Instead of hardcoding a large window height to accommodate optional drawers (like the AI Copilot card), configure a compact default height (`110px`) with `minHeight: 60px` in `tauri.conf.json`, and attach a `ResizeObserver` in the webview. When content expands or contracts, call `resize_overlay(height)` to dynamically adjust the native window's logical size in real time.
- **User-Centric Terminology**:
  Renamed internal technical jargon ("Overlay") to intuitive user-facing terminology ("Subtitles" / "Live Subtitles") with visual active state feedback.

---

## 7. Fault-Tolerant AI Copilot: UI Drawer Decoupling & Graceful Offline Fallbacks

### Observation
- **UI State Coupling**:
  Binding drawer rendering to both the visibility flag AND suggestion presence (`{showCopilot && latestSuggestion}`) caused user-initiated drawer toggles (`✨` button) to fail silently whenever no question had been asked yet. Users could not open the drawer ahead of time to inspect readiness, adjust layout, or enter manual questions.
- **Silent Failures on Unreachable Inference Endpoints**:
  When users launch the app with default settings (`provider: "local"`, endpoint: `http://127.0.0.1:8080/v1`) without actively running `llama-server`, backend inference queries throw `Connection refused (os error 61)`. In the background asynchronous loop, `if let Ok(suggestion) = ...` silently swallowed the error, emitting zero events. As a result, detected questions appeared in the Dialogue Stream while the AI Copilot card remained stuck on the initial empty placeholder without any explanation or response.

### Solution
- **Decoupled Drawer Rendering & Auto-Expansion**:
  In `SubtitleOverlay.tsx`, render the drawer container purely conditioned on `showCopilot`, and provide a compact empty state with the prompt: *"Listening for questions in meeting, or type below:"* alongside the manual question input bar. When a question is detected and a suggestion arrives, use an effect (`useEffect(() => if (latestSuggestion) setShowCopilot(true), [latestSuggestion])`) to expand the drawer automatically.
- **Knowledge-Grounded Smart Fallbacks (`generate_smart_fallback`)**:
  When the primary LLM call fails (offline server, timeout, or rate limit), rather than aborting or dropping the event, intercept the error and generate domain-grounded talking points and sample answers based on:
  1. **Knowledge Context**: Regex-extract matching facts from active Knowledge Profiles (e.g. CV/Resume, Product battlecards).
  2. **Domain Heuristics**: Pre-configured architectural best practices for common system design topics (e.g. database migrations in microservices: dual-write, outbox pattern, strangler fig, zero-downtime schema evolution).
  3. **Multi-Lingual Localization**: Tailor talking points and sample responses in English, Vietnamese, Japanese, and Chinese based on the active target language.
  4. **Diagnostic Advisory**: Append an explicit note indicating the offline provider status (e.g. `[Offline Mode: AI backend at http://127.0.0.1:8080/v1 was unreachable]`).
- **Resilient Persistence**:
  Always emit `copilot:suggestion` and persist the record with its suggested answer to SQLite, ensuring the dialogue stream and Copilot UI remain synchronized even in full offline environments.

---

## 8. Multi-Modal Subtitle Interactivity: Dual-Language Modes, In-Place Editing & Keyword Grounding

### Observation
- **Information Density & Language Needs**:
  During multi-lingual interviews and meetings, participants often face differing linguistic cognitive loads: some want only the translated stream to avoid visual distraction, while others need side-by-side bilingual verification (original speech + translation). In AI Copilot, candidates often need to read the question translation in their native tongue while practicing/saying the suggested answer in English.
- **ASR Acoustic Errors & Immutability**:
  Speech-to-text engines inevitably mishear domain acronyms, technical jargon, or proper nouns (e.g., "Kafka" vs "cup car", or complex database terminology). If transcripts are immutable, those misheard terms propagate into exported meeting notes, history, and AI Copilot contexts.
- **Glanceability of Key Talking Points**:
  Dense text paragraphs in AI suggestion cards reduce comprehension speed under high-pressure meeting scenarios. Without keyword visual hierarchy, users cannot scan crucial architectural talking points in sub-second glances.

### Solution
- **Synchronized Single / Bilingual Toggles**:
  Introduced `transcriptionMode` and `copilotMode` across the application store. In Single mode, UI hides secondary text for a minimalist view; in Bilingual mode, Subtitles HUD and Dashboard display stacked source and target text, and Copilot displays primary answer, secondary English response, and translated question.
- **Selectable & In-Place Editable Transcripts**:
  Removed CSS `select-none` from subtitle text blocks and enabled `select-text cursor-text`. Added inline edit inputs and quick copy actions on both the floating HUD and main window. Edits update the local store and invoke `update_transcript` in Rust to mutate SQLite records and broadcast `subtitle:updated` via IPC.
- **Visual Keyword Grounding (`HighlightText`)**:
  Implemented regex and markdown concept extraction wrapping architectural terms (e.g., `**Expand and Contract**`, `**Database-per-Service**`, `**Zero Downtime**`) into high-contrast highlighted badges and tag pills, enabling instant sub-second recognition during live speech.

---

## 9. Multi-Window Spatial Decoupling: Split vs. Docked Floating HUD Architecture

### Observation
- **Spatial Coupling Constraints**:
  Packaging multiple distinct real-time tools (Live Subtitles HUD and AI Question Copilot) inside a single Webview window bounds them to a shared screen region. During high-stakes meetings and interviews, users have distinct gaze patterns:
  1. Live Subtitles must sit immediately below the active speaker's video tile or presentation slide (typically center bottom or top center).
  2. The AI Copilot card needs to sit closer to the user's web camera, notes panel, or secondary monitor (e.g. top right or right sidebar) so glance movement appears natural without looking away from the camera.
- If both tools are "glued" into a single native window, moving one forcibly drags the other, causing screen clutter and awkward positioning.

### Solution
- **Dedicated Independent Webview Window (`copilot`)**:
  Registered an independent transparent borderless window (`label: "copilot"`, `url: "/copilot.html"`) in `tauri.conf.json` and `vite.config.ts`.
- **Dynamic Split / Dock State Synchronization**:
  Added `is_copilot_split` to `AppState` and synchronized it via Tauri IPC (`copilot:split_changed`).
  - **In Split Mode (Default)**: The Subtitles HUD only displays real-time speech, hugging a compact ~60-110px height. The AI Copilot floats as an independent, fully draggable window with its own `ResizeObserver`, draggable header, mode switcher, and lock controls.
  - **In Docked Mode**: The Copilot drawer embeds directly into the Subtitles HUD for users with limited screen real estate or single-monitor laptop setups.
- **Bi-Directional Spatial Controls**:
  Users can seamlessly switch between Split and Docked with a single click from the Subtitles HUD (`Layers`), the Copilot Window (`Dock with Subtitles`), the Dashboard sidebar, or the System Tray. Auto-revelation logic in `commands.rs` dynamically shows whichever window layout the user has selected upon question arrival.

---

## 10. Asynchronous Database Hydration & React State Synchronization

### Observation
- **Async Initialization vs. Mount Race Condition**:
  When a desktop app starts, the frontend root mounts synchronously with default fallback states (e.g., `provider = "local"`, empty API keys, default languages). Meanwhile, the backend database queries (`get_settings`, `get_app_preferences`) execute asynchronously over Tauri IPC.
  If the React components initialize form fields via `useState(settings.provider)` or `useState(settings.openai_api_key || "")`, those states capture the initial blank values at mount time. Because `useState` initializers do not re-run on subsequent re-renders, the form fields remain empty even after the store successfully loads the credentials from SQLite.
- Users perceive this as: *"all settings clear and not saved; each re-open the app all setting gone"*. Furthermore, clicking "Save" from such an un-synchronized form would inadvertently overwrite valid database records with blank values.
- In addition, critical user preferences like meeting language pairs (`srcLang`, `tgtLang`), audio devices, and display modes were previously held only in memory, resetting back to `en -> vi` on every app reboot.

### Solution
- **Continuous Store-to-Form Synchronization**:
  Added a synchronization `useEffect` in `Dashboard.tsx` listening to `[settings]`. As soon as the async database query completes and updates the Zustand store, the form fields populate immediately with the stored provider, endpoints, model names, and API keys.
- **Unified `AppPreferences` Persistence Contract**:
  Created `AppPreferences` in both Rust (`db.rs`, `commands.rs`) and TypeScript (`useAppStore.ts`), saving meeting languages, preferred audio device, transcription mode, copilot mode, font size, and window layout mode to SQLite `app_settings`.
- **Cold-Start Rust Engine Hydration**:
  Updated `AppState::new(db)` in `src-tauri/src/state.rs` to read `translation_config` and `app_preferences` synchronously from the database upon process boot. This ensures `TranslationEngine` and `CopilotSuggester` have valid user configurations before any network calls or audio captures begin.
- **Centralized Settings UI**:
  Consolidated language configuration, audio device preferences, display modes, and AI providers into a single, comprehensive **Settings & Preferences** tab with live auto-persisting indicators and save confirmation feedback.
