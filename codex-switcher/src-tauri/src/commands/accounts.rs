use crate::auth::oauth::do_login;
use crate::auth::storage::{keychain_delete, keychain_save};
use crate::dto::{AccountWithUsageDto, JoinedRow};
use crate::error::{AppError, AppResult};
use crate::state::AppState;
use serde_json::json;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use super::usage::{fetch_and_persist_snapshot, get_accounts_internal};

#[tauri::command]
pub async fn login_account(
    state: State<'_, AppState>,
    app: AppHandle,
    label: Option<String>,
    existing_account_id: Option<String>,
) -> AppResult<AccountWithUsageDto> {
    let _ = app.emit("login-progress", json!({ "step": "browser_opened" }));

    let _login_guard = state
        .login_mutex
        .try_lock()
        .map_err(|_| AppError::LoginAlreadyInProgress)?;

    let result = do_login(&state.http).await?;

    let _ = app.emit("login-progress", json!({ "step": "callback_received" }));

    let now = chrono::Utc::now().timestamp();

    let account_id = match existing_account_id.clone() {
        Some(id) => {
            let lock = state.account_lock(&id).await;
            let _g = lock.lock().await;

            sqlx::query(
                "UPDATE accounts SET session_status='active', email=?1, plan_type=?2, last_refreshed_at=?3 WHERE id=?4",
            )
            .bind(&result.email)
            .bind(&result.plan_type)
            .bind(now)
            .bind(&id)
            .execute(&state.db)
            .await?;

            keychain_save(&id, &result.tokens)?;
            id
        }
        None => {
            let id = Uuid::new_v4().to_string();
            let label = label
                .filter(|l| !l.trim().is_empty())
                .unwrap_or_else(|| {
                    if !result.email.is_empty() {
                        result.email.clone()
                    } else {
                        format!("Account {}", &id[..8])
                    }
                });

            sqlx::query(
                "INSERT INTO accounts \
                    (id, label, email, plan_type, session_status, created_at, last_refreshed_at, sort_order) \
                 VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?5, \
                    (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM accounts))",
            )
            .bind(&id)
            .bind(&label)
            .bind(&result.email)
            .bind(&result.plan_type)
            .bind(now)
            .execute(&state.db)
            .await?;

            keychain_save(&id, &result.tokens)?;
            id
        }
    };

    // Initial snapshot
    fetch_and_persist_snapshot(
        &state.http,
        &state.db,
        &account_id,
        &result.tokens.access_token,
        &result.tokens.account_id,
    )
    .await?;

    let _ = app.emit("login-progress", json!({ "step": "complete" }));

    let all = get_accounts_internal(&state.db).await?;
    let _ = app.emit("usage-updated", &all);

    let dto = all
        .into_iter()
        .find(|a| a.account.id == account_id)
        .ok_or(AppError::NotFound(account_id))?;
    Ok(dto)
}

#[tauri::command]
pub async fn get_accounts(
    state: State<'_, AppState>,
) -> AppResult<Vec<AccountWithUsageDto>> {
    get_accounts_internal(&state.db).await
}

#[tauri::command]
pub async fn delete_account(
    state: State<'_, AppState>,
    app: AppHandle,
    id: String,
) -> AppResult<()> {
    sqlx::query("DELETE FROM accounts WHERE id = ?1")
        .bind(&id)
        .execute(&state.db)
        .await?;

    if let Err(e) = keychain_delete(&id) {
        tracing::warn!(account_id = %id, error = %e, "keychain_delete failed (continuing)");
    }

    state.account_locks.lock().await.remove(&id);

    let all = get_accounts_internal(&state.db).await?;
    let _ = app.emit("usage-updated", &all);
    Ok(())
}

#[tauri::command]
pub async fn update_account_label(
    state: State<'_, AppState>,
    app: AppHandle,
    id: String,
    label: String,
) -> AppResult<()> {
    sqlx::query("UPDATE accounts SET label = ?1 WHERE id = ?2")
        .bind(&label)
        .bind(&id)
        .execute(&state.db)
        .await?;
    let all = get_accounts_internal(&state.db).await?;
    let _ = app.emit("usage-updated", &all);
    Ok(())
}

#[allow(dead_code)]
pub async fn list_account_ids(db: &sqlx::SqlitePool) -> Result<Vec<String>, AppError> {
    let rows: Vec<(String,)> = sqlx::query_as("SELECT id FROM accounts")
        .fetch_all(db)
        .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

pub async fn fetch_joined_rows(
    db: &sqlx::SqlitePool,
) -> Result<Vec<JoinedRow>, AppError> {
    let sql = r#"
        SELECT
            a.id                AS a_id,
            a.label             AS a_label,
            a.email             AS a_email,
            a.plan_type         AS a_plan_type,
            a.session_status    AS a_session_status,
            a.created_at        AS a_created_at,
            a.last_refreshed_at AS a_last_refreshed_at,
            a.sort_order        AS a_sort_order,

            s.id                    AS s_id,
            s.account_id            AS s_account_id,
            s.fetched_at            AS s_fetched_at,
            s.primary_used_pct      AS s_primary_used_pct,
            s.primary_reset_at      AS s_primary_reset_at,
            s.primary_window_secs   AS s_primary_window_secs,
            s.secondary_used_pct    AS s_secondary_used_pct,
            s.secondary_reset_at    AS s_secondary_reset_at,
            s.secondary_window_secs AS s_secondary_window_secs,
            s.limit_reached         AS s_limit_reached,
            s.credits_has_credits   AS s_credits_has_credits,
            s.credits_unlimited     AS s_credits_unlimited,
            s.credits_balance       AS s_credits_balance
        FROM accounts a
        LEFT JOIN usage_snapshots s
               ON s.id = (
                   SELECT id FROM usage_snapshots
                   WHERE account_id = a.id
                   ORDER BY fetched_at DESC LIMIT 1
               )
        ORDER BY a.sort_order ASC, a.created_at ASC
    "#;
    let rows: Vec<JoinedRow> = sqlx::query_as(sql).fetch_all(db).await?;
    Ok(rows)
}
