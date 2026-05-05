use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::async_runtime::JoinHandle;
use tokio::sync::{watch, Mutex};

pub struct AppState {
    pub db: SqlitePool,
    pub http: reqwest::Client,
    pub poller_handle: Mutex<Option<JoinHandle<()>>>,
    pub account_locks: Mutex<HashMap<String, Arc<Mutex<()>>>>,
    pub shutdown_tx: watch::Sender<bool>,
    pub shutdown_rx: watch::Receiver<bool>,
    /// Held for the duration of any OAuth login flow. try_lock() fails fast
    /// if another login is already in progress.
    pub login_mutex: Mutex<()>,
}

impl AppState {
    pub fn new(db: SqlitePool) -> Self {
        let http = reqwest::Client::builder()
            .use_rustls_tls()
            .https_only(true)
            .timeout(Duration::from_secs(20))
            .connect_timeout(Duration::from_secs(10))
            .user_agent("codex-cli")
            .build()
            .expect("reqwest client");

        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        Self {
            db,
            http,
            poller_handle: Mutex::new(None),
            account_locks: Mutex::new(HashMap::new()),
            shutdown_tx,
            shutdown_rx,
            login_mutex: Mutex::new(()),
        }
    }

    /// Returns the per-account mutex, creating it on first use.
    /// Held by both `refresh_usage` and the re-login path of `login_account`
    /// to serialize keychain + accounts-row writes for a single account.
    pub async fn account_lock(&self, account_id: &str) -> Arc<Mutex<()>> {
        let mut locks = self.account_locks.lock().await;
        locks
            .entry(account_id.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }
}
