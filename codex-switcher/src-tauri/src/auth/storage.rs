use crate::error::AppError;
use keyring::Entry;
use serde::{Deserialize, Serialize};

const KEYCHAIN_SERVICE: &str = "com.motosan.codex-switcher";

#[derive(Serialize, Deserialize, Clone)]
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub id_token: String,
    pub account_id: String,
    pub expires_in: u64,
    pub issued_at: u64,
}

pub fn keychain_save(uuid: &str, t: &StoredTokens) -> Result<(), AppError> {
    let json = serde_json::to_string(t).map_err(AppError::from)?;
    Entry::new(KEYCHAIN_SERVICE, uuid)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .set_password(&json)
        .map_err(|e| AppError::Keychain(e.to_string()))
}

pub fn keychain_load(uuid: &str) -> Result<StoredTokens, AppError> {
    let json = Entry::new(KEYCHAIN_SERVICE, uuid)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .get_password()
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    serde_json::from_str(&json).map_err(AppError::from)
}

pub fn keychain_delete(uuid: &str) -> Result<(), AppError> {
    Entry::new(KEYCHAIN_SERVICE, uuid)
        .map_err(|e| AppError::Keychain(e.to_string()))?
        .delete_credential()
        .map_err(|e| AppError::Keychain(e.to_string()))
}
