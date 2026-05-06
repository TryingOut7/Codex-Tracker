use tauri::Manager;
use tracing_subscriber::prelude::*;

pub mod api;
pub mod auth;
pub mod commands;
pub mod db;
pub mod dto;
pub mod error;
pub mod menu;
pub mod poller;
pub mod state;
pub mod tray;

pub use state::AppState;

fn init_logging() -> Option<tracing_appender::non_blocking::WorkerGuard> {
    // Resolve ~/Library/Logs/<identifier>/ — fall back to stderr-only if it fails.
    let log_dir = dirs_next::home_dir()
        .map(|h| h.join("Library/Logs/com.motosan.codex-switcher"))
        .filter(|p| std::fs::create_dir_all(p).is_ok());

    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("codex_switcher=info,warn"));

    let stderr_layer = tracing_subscriber::fmt::layer()
        .with_writer(std::io::stderr)
        .with_ansi(true);

    match log_dir {
        Some(dir) => {
            let appender = tracing_appender::rolling::daily(&dir, "codex-switcher.log");
            let (non_blocking, guard) = tracing_appender::non_blocking(appender);
            let file_layer = tracing_subscriber::fmt::layer()
                .with_writer(non_blocking)
                .with_ansi(false)
                .json();
            tracing_subscriber::registry()
                .with(env_filter)
                .with(stderr_layer)
                .with(file_layer)
                .init();
            Some(guard)
        }
        None => {
            tracing_subscriber::registry()
                .with(env_filter)
                .with(stderr_layer)
                .init();
            None
        }
    }
}

// Kept alive for the process lifetime so the background log-writer thread stays running.
static _LOG_GUARD: std::sync::OnceLock<Option<tracing_appender::non_blocking::WorkerGuard>> =
    std::sync::OnceLock::new();

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    _LOG_GUARD.get_or_init(init_logging);

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
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

            let app_menu = menu::build(app.handle())?;
            app.set_menu(app_menu)?;
            app.on_menu_event(|app, event| {
                menu::handle_event(app, event.id.as_ref());
            });

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
