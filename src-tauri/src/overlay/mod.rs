use tauri::{AppHandle, Manager, WebviewWindow};

pub struct OverlayManager;

impl OverlayManager {
    /// Applies platform-specific styles for always-on-top transparent overlay
    pub fn setup_overlay_window(_window: &WebviewWindow) {
        // Retain true window transparency without full-window vibrancy or blur.
        // Applying NSVisualEffectMaterial::HudWindow or window blur fills the entire
        // rectangular window frame (940x220) with a dark grey backdrop, ruining the
        // floating rounded pill design. CSS glassmorphism (backdrop-blur) on the inner
        // card container provides the desired frosted glass effect cleanly.
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

    /// Toggles click-through (ignore cursor events) on the copilot window
    pub fn set_copilot_click_through(app: &AppHandle, locked: bool) -> anyhow::Result<()> {
        if let Some(window) = app.get_webview_window("copilot") {
            window.set_ignore_cursor_events(locked)?;
        }
        Ok(())
    }

    /// Toggles copilot window visibility
    pub fn set_copilot_visible(app: &AppHandle, visible: bool) -> anyhow::Result<()> {
        if let Some(window) = app.get_webview_window("copilot") {
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
