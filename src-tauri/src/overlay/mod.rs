use tauri::{AppHandle, Manager, WebviewWindow};

pub struct OverlayManager;

impl OverlayManager {
    /// Applies platform-specific styles for always-on-top transparent overlay
    pub fn setup_overlay_window(window: &WebviewWindow) {
        #[cfg(target_os = "macos")]
        {
            use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
            let _ = apply_vibrancy(window, NSVisualEffectMaterial::HudWindow, None, None);
        }

        #[cfg(target_os = "windows")]
        {
            use window_vibrancy::apply_blur;
            let _ = apply_blur(window, Some((18, 18, 24, 180)));
        }
    }

    /// Toggles click-through (ignore cursor events) on the overlay window
    pub fn set_click_through(app: &AppHandle, locked: bool) -> anyhow::Result<()> {
        if let Some(window) = app.get_webview_window("overlay") {
            window.set_ignore_cursor_events(locked)?;
        }
        Ok(())
    }

    /// Toggles overlay window visibility
    pub fn set_visible(app: &AppHandle, visible: bool) -> anyhow::Result<()> {
        if let Some(window) = app.get_webview_window("overlay") {
            if visible {
                window.show()?;
                window.set_focus()?;
            } else {
                window.hide()?;
            }
        }
        Ok(())
    }
}
