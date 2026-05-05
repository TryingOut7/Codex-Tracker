use tauri::{AppHandle, Manager};

/// Opens Safari Web Inspector for the main window. Used by the tray menu.
pub fn open_main_web_inspector(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        w.open_devtools();
    }
}

/// Invokable from the frontend (e.g. ⌘⌥I) for debugging without a context menu.
#[tauri::command]
pub fn open_web_inspector(app: AppHandle) {
    open_main_web_inspector(&app);
}
