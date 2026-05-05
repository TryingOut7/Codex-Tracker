use tauri::Manager;

pub mod api;
pub mod auth;
pub mod commands;
pub mod db;
pub mod dto;
pub mod error;
pub mod poller;
pub mod state;
pub mod tray;

pub use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                tracing_subscriber::EnvFilter::new("codex_switcher=info,warn")
            }),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;

            let db = tauri::async_runtime::block_on(db::init_pool(&app_data_dir))?;

            let poll_minutes: u64 = tauri::async_runtime::block_on(async {
                sqlx::query_scalar::<_, String>(
                    "SELECT value FROM settings WHERE key = 'poll_interval_minutes'",
                )
                .fetch_one(&db)
                .await
                .unwrap_or_else(|_| "15".to_string())
                .parse()
                .unwrap_or(15)
            });

            let app_state = AppState::new(db);
            let shutdown_rx = app_state.shutdown_rx.clone();
            app.manage(app_state);

            // Spawn poller after state is managed; the first tick is skipped
            // by start_poller, so no race against the handle assignment.
            let app_handle = app.handle().clone();
            let handle = tauri::async_runtime::spawn(poller::start_poller(
                app_handle,
                poll_minutes,
                shutdown_rx,
            ));

            let state_ref = app.state::<AppState>();
            tauri::async_runtime::block_on(async {
                *state_ref.poller_handle.lock().await = Some(handle);
            });

            tray::install(app.handle())?;

            // With LSUIElement=true the app is an Accessory; AppKit will not
            // auto-show or focus the main window. Explicitly show + focus it
            // so the user sees the dashboard on first launch (plan §26-1).
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<AppState>() {
                    let _ = state.shutdown_tx.send(true);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::accounts::login_account,
            commands::accounts::get_accounts,
            commands::accounts::delete_account,
            commands::accounts::update_account_label,
            commands::usage::refresh_usage,
            commands::usage::refresh_all_usage,
            commands::usage::get_best_account,
            commands::usage::get_usage_history,
            commands::usage::get_settings,
            commands::usage::update_settings,
            commands::debug::open_web_inspector,
        ])
        .run(tauri::generate_context!())
        .expect("error running app");
}
