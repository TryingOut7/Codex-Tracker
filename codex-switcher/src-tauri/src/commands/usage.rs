use crate::api::{fetch_wham_usage, WhamResponse};
use crate::auth::refresh::ensure_fresh_token;
use crate::auth::storage::keychain_load;
use crate::dto::{AccountWithUsageDto, JoinedRow, SettingsDto, UsageSnapshotDto, UsageSnapshotRow};
use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde_json::json;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager, State};

use super::accounts::fetch_joined_rows;

pub async fn get_accounts_internal(
    db: &SqlitePool,
) -> Result<Vec<AccountWithUsageDto>, AppError> {
    let rows = fetch_joined_rows(db).await?;
    Ok(rows.into_iter().map(JoinedRow::into_dto).collect())
}

async fn current_refresh_days(db: &SqlitePool) -> u64 {
    sqlx::query_scalar::<_, String>(
        "SELECT value FROM settings WHERE key = 'token_refresh_days'",
    )
    .fetch_one(db)
    .await
    .ok()
    .and_then(|s| s.parse().ok())
    .unwrap_or(7)
}

async fn current_poll_minutes(db: &SqlitePool) -> u64 {
    sqlx::query_scalar::<_, String>(
        "SELECT value FROM settings WHERE key = 'poll_interval_minutes'",
    )
    .fetch_one(db)
    .await
    .ok()
    .and_then(|s| s.parse().ok())
    .unwrap_or(15)
}

/// Fetch wham/usage and persist as a new snapshot row.
pub async fn fetch_and_persist_snapshot(
    http: &reqwest::Client,
    db: &SqlitePool,
    account_uuid: &str,
    access_token: &str,
    chatgpt_account_id: &str,
) -> Result<UsageSnapshotDto, AppError> {
    let resp: WhamResponse =
        fetch_wham_usage(http, access_token, Some(chatgpt_account_id)).await?;

    let now = chrono::Utc::now().timestamp();

    let rate_limit = resp.rate_limit.unwrap_or_default();
    let primary = rate_limit.primary_window.unwrap_or_default();
    let secondary = rate_limit.secondary_window.unwrap_or_default();

    let limit_reached = rate_limit.limit_reached.unwrap_or(false) as i64;

    let credits = resp.credits.as_ref();
    let credits_has = credits.and_then(|c| c.has_credits).map(|b| b as i64);
    let credits_unl = credits.and_then(|c| c.unlimited).map(|b| b as i64);
    let credits_bal = credits.and_then(|c| c.balance_f64());

    let row: UsageSnapshotRow = sqlx::query_as(
        "INSERT INTO usage_snapshots (
            account_id, fetched_at,
            primary_used_pct, primary_reset_at, primary_window_secs,
            secondary_used_pct, secondary_reset_at, secondary_window_secs,
            limit_reached,
            credits_has_credits, credits_unlimited, credits_balance
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         RETURNING *",
    )
    .bind(account_uuid)
    .bind(now)
    .bind(primary.used_percent.unwrap_or(0.0))
    .bind(primary.reset_at.unwrap_or(now))
    .bind(primary.limit_window_seconds.unwrap_or(0))
    .bind(secondary.used_percent.unwrap_or(0.0))
    .bind(secondary.reset_at.unwrap_or(now))
    .bind(secondary.limit_window_seconds.unwrap_or(0))
    .bind(limit_reached)
    .bind(credits_has)
    .bind(credits_unl)
    .bind(credits_bal)
    .fetch_one(db)
    .await?;

    sqlx::query("UPDATE accounts SET last_refreshed_at = ?1 WHERE id = ?2")
        .bind(now)
        .bind(account_uuid)
        .execute(db)
        .await?;

    // If usage call returned email/plan_type and our row has none yet, backfill.
    if let Some(email) = resp.email {
        if !email.is_empty() {
            sqlx::query("UPDATE accounts SET email = ?1 WHERE id = ?2 AND (email = '' OR email IS NULL)")
                .bind(&email)
                .bind(account_uuid)
                .execute(db)
                .await?;
        }
    }
    if let Some(plan) = resp.plan_type {
        sqlx::query("UPDATE accounts SET plan_type = ?1 WHERE id = ?2")
            .bind(&plan)
            .bind(account_uuid)
            .execute(db)
            .await?;
    }

    Ok(row.into())
}

#[tauri::command]
pub async fn refresh_usage(
    state: State<'_, AppState>,
    app: AppHandle,
    id: String,
) -> AppResult<UsageSnapshotDto> {
    let lock = state.account_lock(&id).await;
    let _g = lock.lock().await;

    let tokens = match keychain_load(&id) {
        Ok(t) => t,
        Err(e) => {
            tracing::warn!(account_id = %id, error = %e, "keychain_load failed");
            sqlx::query(
                "UPDATE accounts SET session_status='expired' WHERE id=?1",
            )
            .bind(&id)
            .execute(&state.db)
            .await?;
            let _ = app.emit("account-expired", json!({ "id": id, "email": "" }));
            return Err(e);
        }
    };

    let refresh_days = current_refresh_days(&state.db).await;

    let fresh = match ensure_fresh_token(tokens, &id, &state.db, refresh_days).await {
        Ok(t) => t,
        Err(AppError::RefreshFailed(msg)) => {
            sqlx::query("UPDATE accounts SET session_status='expired' WHERE id=?1")
                .bind(&id)
                .execute(&state.db)
                .await?;
            let email: String = sqlx::query_scalar("SELECT email FROM accounts WHERE id=?1")
                .bind(&id)
                .fetch_one(&state.db)
                .await
                .unwrap_or_default();
            let _ = app.emit("account-expired", json!({ "id": &id, "email": email }));
            return Err(AppError::RefreshFailed(msg));
        }
        Err(e) => return Err(e),
    };

    let snap = match fetch_and_persist_snapshot(
        &state.http,
        &state.db,
        &id,
        &fresh.access_token,
        &fresh.account_id,
    )
    .await
    {
        Ok(s) => s,
        Err(AppError::TokenExpired) => {
            sqlx::query("UPDATE accounts SET session_status='expired' WHERE id=?1")
                .bind(&id)
                .execute(&state.db)
                .await?;
            let email: String = sqlx::query_scalar("SELECT email FROM accounts WHERE id=?1")
                .bind(&id)
                .fetch_one(&state.db)
                .await
                .unwrap_or_default();
            let _ = app.emit("account-expired", json!({ "id": &id, "email": email }));
            return Err(AppError::TokenExpired);
        }
        Err(e) => return Err(e),
    };

    let all = get_accounts_internal(&state.db).await?;
    let _ = app.emit("usage-updated", &all);
    Ok(snap)
}

#[tauri::command]
pub async fn refresh_all_usage(
    _state: State<'_, AppState>,
    app: AppHandle,
) -> AppResult<Vec<UsageSnapshotDto>> {
    refresh_all_usage_internal(&app).await
}

/// Internal helper used by both `refresh_all_usage` and the poller.
pub async fn refresh_all_usage_internal(
    app: &AppHandle,
) -> AppResult<Vec<UsageSnapshotDto>> {
    let state = app.state::<AppState>();

    let ids: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM accounts WHERE session_status = 'active' ORDER BY sort_order ASC",
    )
    .fetch_all(&state.db)
    .await?;

    let mut out = Vec::with_capacity(ids.len());
    let mut last_recoverable: Option<AppError> = None;

    for id in ids {
        let lock = state.account_lock(&id).await;
        let guard = lock.lock().await;

        let tokens = match keychain_load(&id) {
            Ok(t) => t,
            Err(e) => {
                tracing::warn!(account_id = %id, error = %e, "keychain_load failed in refresh_all");
                sqlx::query("UPDATE accounts SET session_status='expired' WHERE id=?1")
                    .bind(&id)
                    .execute(&state.db)
                    .await?;
                let _ = app.emit("account-expired", json!({ "id": &id, "email": "" }));
                drop(guard);
                continue;
            }
        };

        let refresh_days = current_refresh_days(&state.db).await;

        let fresh = match ensure_fresh_token(tokens, &id, &state.db, refresh_days).await {
            Ok(t) => t,
            Err(AppError::RefreshFailed(_)) => {
                sqlx::query("UPDATE accounts SET session_status='expired' WHERE id=?1")
                    .bind(&id)
                    .execute(&state.db)
                    .await?;
                let email: String =
                    sqlx::query_scalar("SELECT email FROM accounts WHERE id=?1")
                        .bind(&id)
                        .fetch_one(&state.db)
                        .await
                        .unwrap_or_default();
                let _ = app.emit("account-expired", json!({ "id": &id, "email": email }));
                drop(guard);
                continue;
            }
            Err(e @ (AppError::Network(_) | AppError::RateLimited)) => {
                last_recoverable = Some(e);
                drop(guard);
                continue;
            }
            Err(e) => {
                tracing::warn!(account_id = %id, error = %e, "refresh failed");
                drop(guard);
                continue;
            }
        };

        match fetch_and_persist_snapshot(
            &state.http,
            &state.db,
            &id,
            &fresh.access_token,
            &fresh.account_id,
        )
        .await
        {
            Ok(s) => out.push(s),
            Err(AppError::TokenExpired) => {
                sqlx::query("UPDATE accounts SET session_status='expired' WHERE id=?1")
                    .bind(&id)
                    .execute(&state.db)
                    .await?;
                let email: String =
                    sqlx::query_scalar("SELECT email FROM accounts WHERE id=?1")
                        .bind(&id)
                        .fetch_one(&state.db)
                        .await
                        .unwrap_or_default();
                let _ = app.emit("account-expired", json!({ "id": &id, "email": email }));
            }
            Err(e @ (AppError::Network(_) | AppError::RateLimited)) => {
                last_recoverable = Some(e);
            }
            Err(e) => {
                tracing::warn!(account_id = %id, error = %e, "snapshot persist failed");
            }
        }

        drop(guard);
    }

    let all = get_accounts_internal(&state.db).await?;
    let _ = app.emit("usage-updated", &all);

    if out.is_empty() {
        if let Some(e) = last_recoverable {
            return Err(e);
        }
    }
    Ok(out)
}

#[tauri::command]
pub async fn get_best_account(
    state: State<'_, AppState>,
) -> AppResult<Option<AccountWithUsageDto>> {
    let sql = r#"
        SELECT
            a.id  AS a_id, a.label AS a_label, a.email AS a_email,
            a.plan_type AS a_plan_type, a.session_status AS a_session_status,
            a.created_at AS a_created_at, a.last_refreshed_at AS a_last_refreshed_at,
            a.sort_order AS a_sort_order,
            s.id AS s_id, s.account_id AS s_account_id, s.fetched_at AS s_fetched_at,
            s.primary_used_pct AS s_primary_used_pct,
            s.primary_reset_at AS s_primary_reset_at,
            s.primary_window_secs AS s_primary_window_secs,
            s.secondary_used_pct AS s_secondary_used_pct,
            s.secondary_reset_at AS s_secondary_reset_at,
            s.secondary_window_secs AS s_secondary_window_secs,
            s.limit_reached AS s_limit_reached,
            s.credits_has_credits AS s_credits_has_credits,
            s.credits_unlimited AS s_credits_unlimited,
            s.credits_balance AS s_credits_balance
        FROM accounts a
        JOIN usage_snapshots s ON s.id = (
            SELECT id FROM usage_snapshots
            WHERE account_id = a.id
            ORDER BY fetched_at DESC LIMIT 1
        )
        WHERE a.session_status = 'active'
        ORDER BY
            s.limit_reached ASC,
            s.primary_used_pct ASC,
            s.primary_reset_at ASC
        LIMIT 1
    "#;
    let row: Option<JoinedRow> = sqlx::query_as(sql).fetch_optional(&state.db).await?;
    Ok(row.map(JoinedRow::into_dto))
}

#[tauri::command]
pub async fn get_usage_history(
    state: State<'_, AppState>,
    id: String,
    days: u32,
) -> AppResult<Vec<UsageSnapshotDto>> {
    let cutoff = chrono::Utc::now().timestamp() - (days as i64) * 86_400;
    let rows: Vec<UsageSnapshotRow> = sqlx::query_as(
        "SELECT * FROM usage_snapshots
         WHERE account_id = ?1 AND fetched_at >= ?2
         ORDER BY fetched_at DESC",
    )
    .bind(&id)
    .bind(cutoff)
    .fetch_all(&state.db)
    .await?;
    Ok(rows.into_iter().map(UsageSnapshotDto::from).collect())
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<SettingsDto> {
    let poll = current_poll_minutes(&state.db).await;
    let refresh = current_refresh_days(&state.db).await;
    Ok(SettingsDto {
        poll_interval_minutes: poll,
        token_refresh_days: refresh,
    })
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    app: AppHandle,
    settings: SettingsDto,
) -> AppResult<()> {
    sqlx::query("UPDATE settings SET value = ?1 WHERE key = 'poll_interval_minutes'")
        .bind(settings.poll_interval_minutes.to_string())
        .execute(&state.db)
        .await?;

    sqlx::query("UPDATE settings SET value = ?1 WHERE key = 'token_refresh_days'")
        .bind(settings.token_refresh_days.to_string())
        .execute(&state.db)
        .await?;

    {
        let mut handle = state.poller_handle.lock().await;
        if let Some(h) = handle.take() {
            h.abort();
        }
    }
    let new_handle = tauri::async_runtime::spawn(crate::poller::start_poller(
        app.clone(),
        settings.poll_interval_minutes,
        state.shutdown_rx.clone(),
    ));
    *state.poller_handle.lock().await = Some(new_handle);

    Ok(())
}
