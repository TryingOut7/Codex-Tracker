use serde::Serialize;

#[derive(thiserror::Error, Debug)]
pub enum AppError {
    #[error("OAuth login failed: {0}")]
    OAuthFailed(String),
    #[error("Token refresh failed: {0}")]
    RefreshFailed(String),
    #[error("Session expired")]
    TokenExpired,
    #[error("Network error: {0}")]
    Network(String),
    #[error("API error {code}: {body}")]
    ApiError { code: u16, body: String },
    #[error("Rate limited — retry later")]
    RateLimited,
    #[error("Database error: {0}")]
    Database(String),
    #[error("Keychain error: {0}")]
    Keychain(String),
    #[error("Invalid JWT")]
    InvalidJwt,
    #[error("Account not found: {0}")]
    NotFound(String),
    #[error("JSON error: {0}")]
    Json(String),
    #[error("Port 1455 in use — close Codex CLI first")]
    Port1455InUse,
    #[error("Login already in progress — check your browser to complete it")]
    LoginAlreadyInProgress,
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

impl From<sqlx::migrate::MigrateError> for AppError {
    fn from(e: sqlx::migrate::MigrateError) -> Self {
        AppError::Database(e.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Network(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Json(e.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
