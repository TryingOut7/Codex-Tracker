use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Manager,
};

/// Update the tray icon title and tooltip after a usage refresh.
///
/// `best` is the account with the lowest 5h-window usage, or None when
/// all accounts are expired / unavailable.
pub fn update_status(app: &AppHandle, best: Option<&crate::dto::AccountWithUsageDto>) {
    let tray: Option<TrayIcon> = app.tray_by_id("main-tray");
    let Some(tray) = tray else { return };

    match best {
        None => {
            let _ = tray.set_title(Some("—"));
            let _ = tray.set_tooltip(Some("Codex Switcher — no accounts available"));
        }
        Some(acc) => {
            let pct = acc
                .latest_snapshot
                .as_ref()
                .map(|s| s.primary_used_pct.round() as u32)
                .unwrap_or(0);

            let status_char = if acc.latest_snapshot.as_ref().map_or(false, |s| s.limit_reached) {
                "●" // red — shown next to icon in menu bar
            } else if pct >= 85 {
                "●"
            } else if pct >= 60 {
                "◑"
            } else {
                "○"
            };

            let title = format!("{status_char} {pct}%");
            let tooltip = format!("Codex Switcher — {} ({pct}% used)", acc.account.label);
            let _ = tray.set_title(Some(&title));
            let _ = tray.set_tooltip(Some(&tooltip));
        }
    }
}

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Codex Switcher", true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, "refresh", "Refresh All", true, None::<&str>)?;
    let devtools = MenuItem::with_id(
        app,
        "devtools",
        "Open Web Inspector… (⌘⌥I)",
        true,
        None::<&str>,
    )?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&open, &refresh, &devtools, &sep, &quit])?;

    TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .on_menu_event(|app, ev| match ev.id.as_ref() {
            "open" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "refresh" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::commands::usage::refresh_all_usage_internal(&app).await;
                });
            }
            "devtools" => {
                crate::commands::debug::open_main_web_inspector(app);
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => {
                if let Some(state) = app.try_state::<crate::state::AppState>() {
                    let _ = state.shutdown_tx.send(true);
                }
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
