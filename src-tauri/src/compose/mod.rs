use anyhow::Result;
use tauri::{AppHandle, Manager};

pub struct ComposeManager;

impl ComposeManager {
    pub fn toggle(app: &AppHandle) -> Result<()> {
        if let Some(window) = app.get_webview_window("compose") {
            if window.is_visible()? {
                window.hide()?;
            } else {
                window.show()?;
                window.set_focus()?;
            }
        }
        Ok(())
    }

    pub fn auto_paste(text: &str) -> Result<()> {
        // Step 1: Copy translated text to system clipboard via arboard or platform commands
        #[cfg(target_os = "macos")]
        {
            use std::process::Command;
            let mut child = Command::new("pbcopy")
                .stdin(std::process::Stdio::piped())
                .spawn()?;
            if let Some(mut stdin) = child.stdin.take() {
                use std::io::Write;
                stdin.write_all(text.as_bytes())?;
            }
            let _ = child.wait()?;

            // Step 2: Simulate Cmd+V keystroke using AppleScript
            let script = r#"
                tell application "System Events"
                    keystroke "v" using {command down}
                end tell
            "#;
            let _ = Command::new("osascript")
                .arg("-e")
                .arg(script)
                .output()?;
        }

        #[cfg(target_os = "windows")]
        {
            // Windows clip command or winapi SendInput
            use std::process::Command;
            let mut child = Command::new("cmd")
                .args(["/c", "clip"])
                .stdin(std::process::Stdio::piped())
                .spawn()?;
            if let Some(mut stdin) = child.stdin.take() {
                use std::io::Write;
                stdin.write_all(text.as_bytes())?;
            }
            let _ = child.wait()?;

            // Send Ctrl+V via powershell or SendInput
            let script = r#"$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v')"#;
            let _ = Command::new("powershell")
                .args(["-Command", script])
                .output()?;
        }

        Ok(())
    }
}
