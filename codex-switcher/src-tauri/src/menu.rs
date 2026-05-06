use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Manager,
};

pub fn build(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let about = PredefinedMenuItem::about(
        app,
        Some("About Codex Switcher"),
        Some(AboutMetadata {
            name: Some("Codex Switcher".to_string()),
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            copyright: Some("© 2025 motosan".to_string()),
            comments: Some(
                "Track Codex usage across multiple ChatGPT accounts.".to_string(),
            ),
            ..Default::default()
        }),
    )?;
    let hide = PredefinedMenuItem::hide(app, None)?;
    let hide_others = PredefinedMenuItem::hide_others(app, None)?;
    let show_all = PredefinedMenuItem::show_all(app, None)?;
    let quit = MenuItem::with_id(
        app,
        "app:quit",
        "Quit Codex Switcher",
        true,
        Some("cmd+q"),
    )?;

    let app_menu = Submenu::with_items(
        app,
        "Codex Switcher",
        true,
        &[
            &about,
            &PredefinedMenuItem::separator(app)?,
            &hide,
            &hide_others,
            &show_all,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let refresh = MenuItem::with_id(app, "app:refresh", "Refresh All", true, Some("cmd+r"))?;
    let view_menu = Submenu::with_items(app, "View", true, &[&refresh])?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;

    Menu::with_items(app, &[&app_menu, &edit_menu, &view_menu, &window_menu])
}

pub fn handle_event(app: &AppHandle, id: &str) {
    match id {
        "app:quit" => {
            if let Some(state) = app.try_state::<crate::state::AppState>() {
                let _ = state.shutdown_tx.send(true);
            }
            app.exit(0);
        }
        "app:refresh" => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = crate::commands::usage::refresh_all_usage_internal(&app).await;
            });
        }
        _ => {}
    }
}
