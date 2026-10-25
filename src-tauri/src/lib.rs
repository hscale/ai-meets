pub mod asr;
pub mod audio;
pub mod commands;
pub mod compose;
pub mod copilot;
pub mod db;
pub mod overlay;
pub mod state;
pub mod translation;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use db::Database;
use overlay::OverlayManager;
use state::AppState;

pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle();
            let app_data_dir = app_handle.path().app_data_dir()?;
            let db = Database::new(app_data_dir)?;

            let state = AppState::new(db);
            app.manage(state);

            // Configure overlay window
            if let Some(overlay_win) = app.get_webview_window("overlay") {
                OverlayManager::setup_overlay_window(&overlay_win);
            }

            // Setup System Tray Menu
            setup_tray(&app_handle)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_audio_sources,
            commands::list_input_devices,
            commands::start_session,
            commands::stop_session,
            commands::get_app_status,
            commands::process_speech_chunk,
            commands::ask_copilot_manual,
            commands::set_overlay_visible,
            commands::set_overlay_locked,
            commands::toggle_compose,
            commands::compose_translate,
            commands::compose_submit,
            commands::list_profiles,
            commands::save_profile,
            commands::set_active_profile,
            commands::delete_profile,
            commands::list_history,
            commands::get_history_session,
            commands::delete_history_session,
            commands::clear_history,
            commands::export_transcript,
            commands::list_glossary,
            commands::add_glossary_entry,
            commands::delete_glossary_entry,
            commands::get_settings,
            commands::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AI Meets application");
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let toggle_overlay_item = MenuItem::with_id(app, "toggle_overlay", "Toggle Subtitles Overlay", true, None::<&str>)?;
    let toggle_lock_item = MenuItem::with_id(app, "toggle_lock", "Lock Subtitles (Click-Through)", true, None::<&str>)?;
    let compose_item = MenuItem::with_id(app, "compose", "Type & Translate (F2)", true, None::<&str>)?;
    let open_main_item = MenuItem::with_id(app, "open_main", "Open Dashboard", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit AI Meets", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &open_main_item,
            &toggle_overlay_item,
            &toggle_lock_item,
            &compose_item,
            &quit_item,
        ],
    )?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open_main" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "toggle_overlay" => {
                if let Some(win) = app.get_webview_window("overlay") {
                    let is_vis = win.is_visible().unwrap_or(false);
                    let _ = OverlayManager::set_visible(app, !is_vis);
                }
            }
            "toggle_lock" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let state = app_handle.state::<AppState>();
                    let mut lock_guard = state.is_overlay_locked.lock().await;
                    *lock_guard = !*lock_guard;
                    let locked = *lock_guard;
                    let _ = app_handle.emit("overlay:lock_changed", locked);
                    let _ = OverlayManager::set_click_through(&app_handle, locked);
                });
            }
            "compose" => {
                let _ = compose::ComposeManager::toggle(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { .. } = event {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
