use crate::error::AppError;

const USAGE_URL: &str = "https://chatgpt.com/backend-api/wham/usage";

#[derive(serde::Deserialize, Default, Debug)]
#[serde(default)]
pub struct WhamResponse {
    pub user_id: Option<String>,
    pub account_id: Option<String>,
    pub email: Option<String>,
    pub plan_type: Option<String>,
    pub rate_limit: Option<RateLimit>,
    pub credits: Option<Credits>,
}

#[derive(serde::Deserialize, Default, Debug)]
#[serde(default)]
pub struct RateLimit {
    pub allowed: Option<bool>,
    pub limit_reached: Option<bool>,
    pub primary_window: Option<Window>,
    pub secondary_window: Option<Window>,
}

#[derive(serde::Deserialize, Default, Debug)]
#[serde(default)]
pub struct Window {
    pub used_percent: Option<f64>,
    pub limit_window_seconds: Option<i64>,
    pub reset_at: Option<i64>,
}

#[derive(serde::Deserialize, Default, Debug)]
#[serde(default)]
pub struct Credits {
    pub has_credits: Option<bool>,
    pub unlimited: Option<bool>,
    /// API may return string ("12.34"), number, or null.
    pub balance: Option<serde_json::Value>,
}

impl Credits {
    pub fn balance_f64(&self) -> Option<f64> {
        match &self.balance {
            Some(serde_json::Value::Number(n)) => n.as_f64(),
            Some(serde_json::Value::String(s)) => {
                s.trim().trim_start_matches('$').parse::<f64>().ok()
            }
            _ => None,
        }
    }
}

pub async fn fetch_wham_usage(
    client: &reqwest::Client,
    access_token: &str,
    account_id: Option<&str>,
) -> Result<WhamResponse, AppError> {
    let mut req = client
        .get(USAGE_URL)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("User-Agent", "codex-cli")
        .header("Accept", "application/json")
        .header("Origin", "https://chatgpt.com")
        .header("Referer", "https://chatgpt.com/");

    if let Some(id) = account_id {
        req = req.header("ChatGPT-Account-Id", id);
    }

    let resp = req.send().await?;
    let status = resp.status().as_u16();

    match status {
        200 => resp.json::<WhamResponse>().await.map_err(AppError::from),
        401 | 403 => Err(AppError::TokenExpired),
        429 => Err(AppError::RateLimited),
        code => {
            let body = resp.text().await.unwrap_or_default();
            tracing::warn!(code, %body, "wham/usage non-200");
            Err(AppError::ApiError { code, body })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Plan §12 / fix #3: every Credits field is optional and `null`-tolerant.
    #[test]
    fn credits_decodes_with_all_nulls() {
        let body = r#"{
            "rate_limit": null,
            "credits": { "has_credits": null, "unlimited": null, "balance": null }
        }"#;
        let resp: WhamResponse = serde_json::from_str(body).unwrap();
        let credits = resp.credits.unwrap();
        assert!(credits.has_credits.is_none());
        assert!(credits.unlimited.is_none());
        assert_eq!(credits.balance_f64(), None);
    }

    #[test]
    fn credits_balance_accepts_number_string_and_dollar_prefix() {
        let n: Credits =
            serde_json::from_str(r#"{ "balance": 12.5 }"#).unwrap();
        assert_eq!(n.balance_f64(), Some(12.5));

        let s: Credits =
            serde_json::from_str(r#"{ "balance": "7.25" }"#).unwrap();
        assert_eq!(s.balance_f64(), Some(7.25));

        let dollar: Credits =
            serde_json::from_str(r#"{ "balance": "$2.71" }"#).unwrap();
        assert_eq!(dollar.balance_f64(), Some(2.71));

        let null: Credits = serde_json::from_str(r#"{ "balance": null }"#).unwrap();
        assert_eq!(null.balance_f64(), None);

        let absent: Credits = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(absent.balance_f64(), None);
    }

    #[test]
    fn wham_response_tolerates_missing_top_level_fields() {
        // Real-world: the endpoint sometimes returns only the rate_limit.
        let body = r#"{
            "user_id": "u-1",
            "rate_limit": {
                "primary_window": { "used_percent": 12.5, "reset_at": 1700000000, "limit_window_seconds": 18000 }
            }
        }"#;
        let resp: WhamResponse = serde_json::from_str(body).unwrap();
        assert_eq!(resp.user_id.as_deref(), Some("u-1"));
        assert!(resp.email.is_none());
        assert!(resp.plan_type.is_none());
        let primary = resp.rate_limit.unwrap().primary_window.unwrap();
        assert_eq!(primary.used_percent, Some(12.5));
        assert_eq!(primary.limit_window_seconds, Some(18_000));
    }

    #[test]
    fn wham_response_decodes_full_payload() {
        let body = r#"{
            "user_id": "u-1",
            "account_id": "acc-2",
            "email": "a@b.test",
            "plan_type": "pro",
            "rate_limit": {
                "allowed": true,
                "limit_reached": false,
                "primary_window":   { "used_percent": 22.0, "reset_at": 100, "limit_window_seconds": 18000 },
                "secondary_window": { "used_percent": 80.5, "reset_at": 200, "limit_window_seconds": 604800 }
            },
            "credits": { "has_credits": true, "unlimited": false, "balance": "0.00" }
        }"#;
        let r: WhamResponse = serde_json::from_str(body).unwrap();
        assert_eq!(r.email.as_deref(), Some("a@b.test"));
        assert_eq!(r.plan_type.as_deref(), Some("pro"));
        let rl = r.rate_limit.unwrap();
        assert_eq!(rl.limit_reached, Some(false));
        assert_eq!(rl.secondary_window.unwrap().used_percent, Some(80.5));
        assert_eq!(r.credits.as_ref().unwrap().balance_f64(), Some(0.0));
    }

    /// Empty object must not panic.
    #[test]
    fn wham_response_empty_object() {
        let r: WhamResponse = serde_json::from_str("{}").unwrap();
        assert!(r.user_id.is_none() && r.rate_limit.is_none() && r.credits.is_none());
    }
}
