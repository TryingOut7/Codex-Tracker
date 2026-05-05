use crate::api::fetch_wham_usage;
use crate::auth::storage::StoredTokens;
use crate::error::AppError;
use base64::{
    engine::general_purpose::{URL_SAFE, URL_SAFE_NO_PAD},
    Engine,
};
use codex_oauth::{login, Token};

pub struct LoginResult {
    pub tokens: StoredTokens,
    pub email: String,
    pub plan_type: String,
}

/// Returns true if TCP port 1455 is currently bound on localhost.
fn port_1455_in_use() -> bool {
    std::net::TcpListener::bind(("127.0.0.1", 1455)).is_err()
}

/// Full login flow. Opens system browser, blocks until user completes OAuth.
pub async fn do_login(http: &reqwest::Client) -> Result<LoginResult, AppError> {
    if port_1455_in_use() {
        return Err(AppError::Port1455InUse);
    }

    // codex_oauth::login() handles: PKCE, local server on 1455, browser open,
    // state validation, code exchange. 120s timeout enforced upstream.
    let token: Token = login()
        .await
        .map_err(|e| AppError::OAuthFailed(e.to_string()))?;

    let maybe_account_id = extract_account_id(&token.id_token).ok();

    // First API call: verify token works + get email/plan_type.
    // If JWT extraction failed, omit the header and adopt account_id from response.
    let usage =
        fetch_wham_usage(http, &token.access_token, maybe_account_id.as_deref()).await?;

    let account_id = maybe_account_id
        .or_else(|| usage.account_id.clone())
        .or_else(|| usage.user_id.clone())
        .ok_or(AppError::InvalidJwt)?;

    let tokens = StoredTokens {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        id_token: token.id_token,
        account_id,
        expires_in: token.expires_in,
        issued_at: token.issued_at,
    };

    Ok(LoginResult {
        email: usage.email.unwrap_or_default(),
        plan_type: usage.plan_type.unwrap_or_else(|| "unknown".to_string()),
        tokens,
    })
}

/// Decodes JWT payload (no signature verification — only for extracting claims).
pub fn extract_account_id(jwt: &str) -> Result<String, AppError> {
    let parts: Vec<&str> = jwt.splitn(3, '.').collect();
    if parts.len() != 3 {
        return Err(AppError::InvalidJwt);
    }

    let pad = (4 - parts[1].len() % 4) % 4;
    let padded = format!("{}{}", parts[1], "=".repeat(pad));

    // JWTs use URL-safe base64; STANDARD has no `-` / `_`, so don't fall back to it.
    let bytes = URL_SAFE_NO_PAD
        .decode(parts[1])
        .or_else(|_| URL_SAFE.decode(&padded))
        .map_err(|_| AppError::InvalidJwt)?;

    let claims: serde_json::Value = serde_json::from_slice(&bytes).map_err(AppError::from)?;

    claims["https://api.openai.com/profile"]["user_id"]
        .as_str()
        .or_else(|| claims["sub"].as_str())
        .map(str::to_owned)
        .ok_or(AppError::InvalidJwt)
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

    fn make_jwt(payload: &serde_json::Value) -> String {
        // Header is irrelevant for our extractor.
        let header = URL_SAFE_NO_PAD.encode(b"{\"alg\":\"none\",\"typ\":\"JWT\"}");
        let payload =
            URL_SAFE_NO_PAD.encode(serde_json::to_vec(payload).unwrap());
        let signature = "";
        format!("{header}.{payload}.{signature}")
    }

    #[test]
    fn extracts_user_id_from_openai_profile_claim() {
        let jwt = make_jwt(&serde_json::json!({
            "sub": "auth0|abc",
            "https://api.openai.com/profile": { "user_id": "user_42" }
        }));
        assert_eq!(extract_account_id(&jwt).unwrap(), "user_42");
    }

    #[test]
    fn falls_back_to_sub_claim() {
        let jwt = make_jwt(&serde_json::json!({ "sub": "auth0|fallback-id" }));
        assert_eq!(extract_account_id(&jwt).unwrap(), "auth0|fallback-id");
    }

    /// Plan §10 / fix #2: JWT base64 alphabet is URL-safe (`-` and `_`),
    /// not standard. The decoder must accept either, with or without padding.
    /// We force a payload whose encoding contains both characters by
    /// inserting bytes (UTF-8 emoji + tilde fillers) that the encoder maps
    /// to the URL-safe-only positions.
    #[test]
    fn handles_url_safe_alphabet_with_dashes_and_underscores() {
        // u{1F680} → 0xF0 0x9F 0x9A 0x80 = bits forcing `-` in base64-url.
        let jwt = make_jwt(&serde_json::json!({
            "sub": "rocket-\u{1F680}-id"
        }));
        let payload_seg = jwt.split('.').nth(1).unwrap();
        // Sanity: at least one URL-safe-only char appears, validating the
        // engine choice (STANDARD would have used `+`/`/` instead).
        assert!(
            payload_seg.contains('-') || payload_seg.contains('_'),
            "expected URL-safe alphabet in encoded payload, got `{payload_seg}`",
        );
        assert_eq!(
            extract_account_id(&jwt).unwrap(),
            "rocket-\u{1F680}-id",
        );
    }

    /// Decode a JWT with explicit `=` padding (URL_SAFE, not URL_SAFE_NO_PAD).
    #[test]
    fn handles_padded_url_safe_payload() {
        use base64::{engine::general_purpose::URL_SAFE, Engine};
        let header = URL_SAFE.encode(b"{\"alg\":\"none\"}");
        let payload =
            URL_SAFE.encode(br#"{"sub":"padded-id-with-three-bytes"}"#);
        // URL_SAFE leaves trailing `=`, which our decoder strips before retrying.
        let jwt = format!("{header}.{payload}.");
        assert_eq!(
            extract_account_id(&jwt).unwrap(),
            "padded-id-with-three-bytes",
        );
    }

    #[test]
    fn rejects_malformed_jwt() {
        assert!(matches!(
            extract_account_id("not-a-jwt"),
            Err(AppError::InvalidJwt)
        ));
        assert!(matches!(
            extract_account_id("only.two"),
            Err(AppError::InvalidJwt)
        ));
    }

    #[test]
    fn rejects_jwt_without_user_id_or_sub() {
        let jwt = make_jwt(&serde_json::json!({ "unrelated": "x" }));
        assert!(matches!(
            extract_account_id(&jwt),
            Err(AppError::InvalidJwt)
        ));
    }
}
