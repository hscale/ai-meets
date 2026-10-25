# Lessons Learned: AI Meets Engineering & Cross-Platform Desktop Architecture

## 1. Window Vibrancy vs. True Non-Rectangular Transparency in Tauri
- **Problem**: When applying macOS window vibrancy via `window_vibrancy::apply_vibrancy(window, NSVisualEffectMaterial::HudWindow, None, None)`, macOS adds an `NSVisualEffectView` spanning the complete rectangular frame of the `NSWindow` (e.g., 940x220). Even if the HTML document background is transparent, the visual effect view fills the entire window rectangle with an opaque/translucent dark-grey box (`rgb(48, 53, 63)`), destroying the floating rounded pill look.
- **Solution**: Do not apply native vibrancy to the entire OS window when building floating shaped HUDs or floating pill widgets. Keep `transparent: true`, `decorations: false`, and `shadow: false` in `tauri.conf.json`. Style the floating widgets directly using CSS glassmorphism (`backdrop-blur-xl`, `bg-slate-950/90`, `border border-slate-700/60`, `rounded-2xl`). This confines all blurring and backgrounds strictly to the card's rounded boundary while leaving the surrounding window canvas completely transparent.

## 2. Cursor Event Routing on Floating Transparent Overlays
- **Problem**: A full-screen or enlarged overlay window (e.g. 940x220) to accommodate expanding drawers (like the AI Copilot card) captures cursor clicks on empty transparent areas, blocking user interaction with background windows.
- **Solution**:
  1. Add `pointer-events-none` to the outer layout container spanning the window.
  2. Add `pointer-events-auto` specifically to interactive cards, buttons, and drag regions.
  3. Combine with native `set_ignore_cursor_events(locked)` via Tauri IPC when the user toggles click-through mode for uninterrupted presentation/gaming modes.

## 3. Audio Thread Concurrency with `cpal` on macOS CoreAudio
- **Problem**: `cpal::Stream` contains raw pointers to CoreAudio HAL units that are not marked `Send` or `Sync`. Storing or awaiting `cpal::Stream` inside Tokio async tasks or state structs fails at compile time with `the trait Send is not implemented for cpal::Stream`.
- **Solution**: Decouple the audio capture lifecycle from async Tokio runtimes. Spawn a dedicated OS thread (`std::thread::spawn`) that builds, starts, and owns the `cpal::Stream`. Control stream termination via an atomic flag (`Arc<AtomicBool>`) and send audio samples across threads using lock-free ring buffers (`rtrb`) or crossbeam channels.

## 4. Mutex Guards and Asynchronous Boundaries
- **Problem**: Holding `parking_lot::MutexGuard` or `std::sync::MutexGuard` across `.await` points causes compilation errors because sync lock guards cannot be safely moved across thread boundaries during coroutine suspension.
- **Solution**: Use `tokio::sync::Mutex` or `tokio::sync::RwLock` for state accessed across async network calls (e.g., LLM translation requests), or restrict synchronous mutex lock scopes to synchronous blocks before calling `.await`.

## 5. Tauri v2 macOS `Info.plist` Configuration
- **Problem**: Tauri v2 `tauri.conf.json` does not accept raw inline JSON objects under `bundle.macOS.infoPlist`. Supplying an object causes `tauri build` to fail with invalid type deserialization errors.
- **Solution**: Create a dedicated `src-tauri/Info.plist` XML file containing required entitlements (such as `NSAudioCaptureUsageDescription` and `NSMicrophoneUsageDescription`) and reference it as a path string: `"infoPlist": "Info.plist"`.
