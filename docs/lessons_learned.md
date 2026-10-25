# Lessons Learned: AI Meets Engineering & Cross-Platform Desktop Architecture

## 1. Window Vibrancy vs. True Non-Rectangular Transparency in Tauri
- **Problem**: When applying macOS window vibrancy via `window_vibrancy::apply_vibrancy(window, NSVisualEffectMaterial::HudWindow, None, None)`, macOS adds an `NSVisualEffectView` spanning the complete rectangular frame of the `NSWindow` (e.g., 940x220). Even if the HTML document background is transparent, the visual effect view fills the entire window rectangle with an opaque/translucent dark-grey box (`rgb(48, 53, 63)`), destroying the floating rounded pill look.
- **Solution**: Do not apply native vibrancy to the entire OS window when building floating shaped HUDs or floating pill widgets. Keep `transparent: true`, `decorations: false`, and `shadow: false` in `tauri.conf.json`. Style the floating widgets directly using CSS glassmorphism (`backdrop-blur-xl`, `bg-slate-950/90`, `border border-slate-700/60`, `rounded-2xl`). This confines all blurring and backgrounds strictly to the card's rounded boundary while leaving the surrounding window canvas completely transparent.

## 2. Cursor Event Routing & `pointer-events-none` Pitfall in WebKit
- **Problem**: Setting `pointer-events-none` on the root or top-level container of a transparent Webview (e.g., `<div className="... pointer-events-none ...">`) with child elements set to `pointer-events-auto` causes macOS WebKit to drop mouse events or fail hit-testing for parent drag regions and event listeners on `document`.
- **Solution**: Keep the container interactive (`pointer-events-auto` by default) and size the overlay window cleanly to the widget's active dimensions. For click-through presentation mode, rely on OS-level `window.set_ignore_cursor_events(locked)` rather than CSS `pointer-events-none`.

## 3. Tauri v2 Window Dragging Mechanics (`data-tauri-drag-region` vs `startDragging`)
- **Problem**: In Tauri v2's internal `drag.js`, bare `data-tauri-drag-region` checks `el === composedPath[0]`. If the drag header contains child icons (`<svg>`), text spans, or badges, clicking any child causes `el === composedPath[0]` to be `false`, completely preventing window dragging. Furthermore, wrapping clickable buttons inside a parent drag region without explicit propagation stops causes clicks to be swallowed or intercepted as window drag operations.
- **Solution**:
  1. Use programmatic `getCurrentWindow().startDragging()` on `onMouseDown` for the header element, verifying `!(e.target as HTMLElement).closest("button, select, input, a")`.
  2. Add `data-tauri-drag-region="deep"` so descendants without conflicting interactive roles trigger drag.
  3. Mark child decorative icons and text as `pointer-events-none select-none` so mouse clicks target the header directly.
  4. Stop mouse event propagation on interactive button clusters with `onMouseDown={(e) => e.stopPropagation()}` and `onClick={(e) => e.stopPropagation()}`.

## 4. Multi-Window Click-Through State Synchronization
- **Problem**: When `window.set_ignore_cursor_events(true)` is activated on the overlay window, the window ignores all mouse events. If the lock button is on the overlay itself, the user can never click it again to unlock.
- **Solution**:
  1. Synchronize lock state globally in `AppState.is_overlay_locked` and broadcast changes across all windows via `overlay:lock_changed` events.
  2. Implement click-through toggling from the System Tray menu and the Main Dashboard window so the user always has a primary control point to unlock the overlay.

## 5. Audio Thread Concurrency with `cpal` on macOS CoreAudio
- **Problem**: `cpal::Stream` contains raw pointers to CoreAudio HAL units that are not marked `Send` or `Sync`. Storing or awaiting `cpal::Stream` inside Tokio async tasks or state structs fails at compile time with `the trait Send is not implemented for cpal::Stream`.
- **Solution**: Decouple the audio capture lifecycle from async Tokio runtimes. Spawn a dedicated OS thread (`std::thread::spawn`) that builds, starts, and owns the `cpal::Stream`. Control stream termination via an atomic flag (`Arc<AtomicBool>`) and send audio samples across threads using lock-free ring buffers (`rtrb`) or crossbeam channels.

## 4. Mutex Guards and Asynchronous Boundaries
- **Problem**: Holding `parking_lot::MutexGuard` or `std::sync::MutexGuard` across `.await` points causes compilation errors because sync lock guards cannot be safely moved across thread boundaries during coroutine suspension.
- **Solution**: Use `tokio::sync::Mutex` or `tokio::sync::RwLock` for state accessed across async network calls (e.g., LLM translation requests), or restrict synchronous mutex lock scopes to synchronous blocks before calling `.await`.

## 6. Tauri v2 Capability ACL & `plugin:window|start_dragging`
- **Problem**: In Tauri v2, if no capability configuration (`src-tauri/capabilities/*.json`) is present, Tauri's Access Control List (ACL) strictly denies all calls from Webviews to core window commands (`plugin:window|start_dragging`, `plugin:window|set_focus`, etc.), causing `getCurrentWindow().startDragging()` to silently fail.
- **Solution**:
  1. Define `src-tauri/capabilities/default.json` with permissions for `core:default`, `core:window:default`, `core:window:allow-start-dragging`, and relevant plugin defaults.
  2. Implement an application-level Tauri command `drag_window` (`window.start_dragging()`) which is registered in `tauri::generate_handler!`, bypassing plugin ACL limits.
  3. Combine with native CSS `-webkit-app-region: drag` on draggable headers and `-webkit-app-region: no-drag` on interactive toolbars. This dual-layer approach provides 100% dragging reliability across both OS-composited and JS-dispatched interactions.

## 7. Automated Cross-Platform UI QA Testing
- **Problem**: Testing transparent floating windows, window dragging, and WebKit hit testing cannot be verified solely by unit tests or static analysis because OS WindowServer compositing, Quartz window levels, and WebKit mouse handling interact dynamically.
- **Solution**: Build automated Swift/Quartz test harnesses that query `CGWindowListCopyWindowInfo`, simulate authentic `CGEvent` mouse clicks and drags, verify exact delta changes in window coordinates, and capture visual proof with `screencapture`.
