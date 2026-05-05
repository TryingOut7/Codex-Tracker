use crate::auth::storage::{keychain_save, StoredTokens};
use crate::error::AppError;
use codex_oauth::{refresh, Token};

pub async fn ensure_fresh_token(
    tokens: StoredTokens,
    account_uuid: &str,
    db: &sqlx::SqlitePool,
    refresh_threshold_days: u64,
) -> Result<StoredTokens, AppError> {
    let now_unix = chrono::Utc::now().timestamp() as u64;
    let age_secs = now_unix.saturating_sub(tokens.issued_at);
    let threshold_secs = refresh_threshold_days * 86_400;

    let ot = Token {
        access_token: tokens.access_token.clone(),
        refresh_token: tokens.refresh_token.clone(),
        id_token: tokens.id_token.clone(),
        expires_in: tokens.expires_in,
        issued_at: tokens.issued_at,
    };

    if !ot.is_expired() && age_secs < threshold_secs {
        return Ok(tokens);
    }

    let new_token = refresh(&tokens.refresh_token)
        .await
        .map_err(|e| AppError::RefreshFailed(e.to_string()))?;

    let refreshed = StoredTokens {
        access_token: new_token.access_token,
        refresh_token: new_token.refresh_token,
        id_token: new_token.id_token,
        account_id: tokens.account_id.clone(),
        expires_in: new_token.expires_in,
        issued_at: new_token.issued_at,
    };

    keychain_save(account_uuid, &refreshed)?;

    sqlx::query("UPDATE accounts SET last_refreshed_at = ?1 WHERE id = ?2")
        .bind(now_unix as i64)
        .bind(account_uuid)
        .execute(db)
        .await?;

    Ok(refreshed)
}
