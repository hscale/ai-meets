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

## 3. Reverse-Engineering Insights from AI Translator (`aitranslator.vn`)

### Observation
Decompiling `meeting-translator`, `asr-worker`, and `llama-server` revealed:
- **Streaming Cadence**: Using fixed chunk sizes produces unnatural cuts. Implementing a sliding window with cadence factors (`min_cadence_ms: 200`, `max_cadence_ms: 1200`) and VAD-based silence boundaries stabilizes live text.
- **Model Selection**: Tencent's `Hunyuan-MT2 1.8B` (`Q8_0` for Standard, `Q4_K_M` for Lite) delivers the highest accuracy for Asian languages (Vietnamese, Japanese, Chinese, Korean) with memory footprints under 2 GB.
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
