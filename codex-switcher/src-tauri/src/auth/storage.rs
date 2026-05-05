use crate::error::AppError;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const KEYCHAIN_SERVICE: &str = "com.motosan.codex-switcher";
// Single keychain entry holds all accounts — macOS prompts only once.
const KEYCHAIN_ACCOUNT: &str = "all_accounts";

#[derive(Serialize, Deserialize, Clone)]
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub id_token: String,
    pub account_id: String,
    pub expires_in: u64,
    pub issued_at: u64,
}

fn entry() -> Result<Entry, AppError> {
    Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| AppError::Keychain(e.to_string()))
}

fn load_all() -> Result<HashMap<String, StoredTokens>, AppError> {
    let e = entry()?;
    match e.get_password() {
        Ok(json) => serde_json::from_str(&json).map_err(AppError::from),
        Err(keyring::Error::NoEntry) => Ok(HashMap::new()),
        Err(e) => Err(AppError::Keychain(e.to_string())),
    }
}

fn save_all(map: &HashMap<String, StoredTokens>) -> Result<(), AppError> {
    let json = serde_json::to_string(map).map_err(AppError::from)?;
    entry()?.set_password(&json).map_err(|e| AppError::Keychain(e.to_string()))
}

pub fn keychain_save(uuid: &str, t: &StoredTokens) -> Result<(), AppError> {
    let mut map = load_all()?;
    map.insert(uuid.to_string(), t.clone());
    save_all(&map)
}

pub fn keychain_load(uuid: &str) -> Result<StoredTokens, AppError> {
    load_all()?
        .remove(uuid)
        .ok_or_else(|| AppError::Keychain(format!("no entry for {uuid}")))
}

pub fn keychain_delete(uuid: &str) -> Result<(), AppError> {
    let mut map = load_all()?;
    map.remove(uuid);
    save_all(&map)
}
