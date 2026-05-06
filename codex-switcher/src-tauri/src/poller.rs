use serde_json::json;
use tauri::Emitter;
use tokio::sync::watch;
use tokio::time::{interval, Duration, MissedTickBehavior};

/// Compute the next backoff-tick count from the current value and a ceiling.
/// Schedule for `max=16`: 0 → 1 → 3 → 7 → 15 → 16 → 16 …
/// Schedule for `max=8`:  0 → 1 → 3 → 7 → 8  → 8 …
pub fn next_backoff(current: u64, max: u64) -> u64 {
    (current * 2 + 1).min(max)
}

pub async fn start_poller(
    app: tauri::AppHandle,
    interval_minutes: u64,
    mut shutdown: watch::Receiver<bool>,
) {
    let base = Duration::from_secs(interval_minutes.max(1) * 60);
    let mut ticker = interval(base);
    ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);
    ticker.tick().await; // skip immediate tick on start

    let mut backoff_ticks: u64 = 0;

    loop {
        tokio::select! {
            biased;
            _ = shutdown.changed() => {
                if *shutdown.borrow() { break; }
            }
            _ = ticker.tick() => {
                if backoff_ticks > 0 {
                    backoff_ticks -= 1;
                    let retry_in_secs = backoff_ticks * interval_minutes * 60;
                    let _ = app.emit("poll-backoff", json!({
                        "ticks_remaining": backoff_ticks,
                        "reason": "backoff",
                        "retry_in_secs": retry_in_secs
                    }));
                    tracing::debug!(remaining_ticks = backoff_ticks, "skip due to backoff");
                    continue;
                }

                match crate::commands::usage::refresh_all_usage_internal(&app).await {
                    Ok(_) => {
                        let _ = app.emit("poll-backoff", json!({
                            "ticks_remaining": 0u64,
                            "reason": "cleared",
                            "retry_in_secs": 0u64
                        }));
                    }
                    Err(crate::error::AppError::RateLimited) => {
                        backoff_ticks = next_backoff(backoff_ticks, 16);
                        let retry_in_secs = backoff_ticks * interval_minutes * 60;
                        let _ = app.emit("poll-backoff", json!({
                            "ticks_remaining": backoff_ticks,
                            "reason": "rate_limited",
                            "retry_in_secs": retry_in_secs
                        }));
                        tracing::warn!(backoff_ticks, "rate-limited; backing off");
                    }
                    Err(crate::error::AppError::Network(e)) => {
                        backoff_ticks = next_backoff(backoff_ticks, 8);
                        let retry_in_secs = backoff_ticks * interval_minutes * 60;
                        let _ = app.emit("poll-backoff", json!({
                            "ticks_remaining": backoff_ticks,
                            "reason": "network",
                            "retry_in_secs": retry_in_secs
                        }));
                        tracing::warn!(error = %e, backoff_ticks, "network error; backing off");
                    }
                    Err(e) => {
                        tracing::warn!(error = %e, "refresh cycle error (no backoff)");
                    }
                }
            }
        }
    }

    tracing::info!("poller exited cleanly");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 429 schedule from the plan: 1, 3, 7, 15, 16, 16 …
    #[test]
    fn rate_limit_schedule() {
        let mut t = 0;
        let mut hits = vec![];
        for _ in 0..6 {
            t = next_backoff(t, 16);
            hits.push(t);
        }
        assert_eq!(hits, vec![1, 3, 7, 15, 16, 16]);
    }

    /// Network schedule from the plan: 1, 3, 7, 8, 8 …
    #[test]
    fn network_schedule() {
        let mut t = 0;
        let mut hits = vec![];
        for _ in 0..5 {
            t = next_backoff(t, 8);
            hits.push(t);
        }
        assert_eq!(hits, vec![1, 3, 7, 8, 8]);
    }

    /// Backoff at the cap should not wrap around.
    #[test]
    fn backoff_does_not_overflow_cap() {
        assert_eq!(next_backoff(16, 16), 16);
        assert_eq!(next_backoff(100, 16), 16);
    }
}
