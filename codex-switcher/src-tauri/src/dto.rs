use serde::Serialize;

#[derive(sqlx::FromRow, Clone)]
pub struct UsageSnapshotRow {
    pub id: i64,
    pub account_id: String,
    pub fetched_at: i64,
    pub primary_used_pct: f64,
    pub primary_reset_at: i64,
    pub primary_window_secs: i64,
    pub secondary_used_pct: f64,
    pub secondary_reset_at: i64,
    pub secondary_window_secs: i64,
    pub limit_reached: i64,
    pub credits_has_credits: Option<i64>,
    pub credits_unlimited: Option<i64>,
    pub credits_balance: Option<f64>,
}

#[derive(Serialize, Clone)]
pub struct UsageSnapshotDto {
    pub id: i64,
    pub account_id: String,
    pub fetched_at: i64,
    pub primary_used_pct: f64,
    pub primary_reset_at: i64,
    pub primary_window_secs: i64,
    pub secondary_used_pct: f64,
    pub secondary_reset_at: i64,
    pub secondary_window_secs: i64,
    pub limit_reached: bool,
    pub credits_has_credits: Option<bool>,
    pub credits_unlimited: Option<bool>,
    pub credits_balance: Option<f64>,
}

impl From<UsageSnapshotRow> for UsageSnapshotDto {
    fn from(r: UsageSnapshotRow) -> Self {
        Self {
            id: r.id,
            account_id: r.account_id,
            fetched_at: r.fetched_at,
            primary_used_pct: r.primary_used_pct,
            primary_reset_at: r.primary_reset_at,
            primary_window_secs: r.primary_window_secs,
            secondary_used_pct: r.secondary_used_pct,
            secondary_reset_at: r.secondary_reset_at,
            secondary_window_secs: r.secondary_window_secs,
            limit_reached: r.limit_reached != 0,
            credits_has_credits: r.credits_has_credits.map(|v| v != 0),
            credits_unlimited: r.credits_unlimited.map(|v| v != 0),
            credits_balance: r.credits_balance,
        }
    }
}

#[derive(Serialize, Clone, sqlx::FromRow)]
pub struct AccountRow {
    pub id: String,
    pub label: String,
    pub email: String,
    pub plan_type: String,
    pub session_status: String,
    pub created_at: i64,
    pub last_refreshed_at: Option<i64>,
    pub sort_order: i64,
}

#[derive(Serialize, Clone)]
pub struct AccountWithUsageDto {
    #[serde(flatten)]
    pub account: AccountRow,
    pub latest_snapshot: Option<UsageSnapshotDto>,
}

#[derive(Serialize, serde::Deserialize, Clone)]
pub struct SettingsDto {
    pub poll_interval_minutes: u64,
    pub token_refresh_days: u64,
}

/// Flattened JOIN row used by `get_accounts` / `get_best_account`.
#[derive(sqlx::FromRow)]
pub struct JoinedRow {
    pub a_id: String,
    pub a_label: String,
    pub a_email: String,
    pub a_plan_type: String,
    pub a_session_status: String,
    pub a_created_at: i64,
    pub a_last_refreshed_at: Option<i64>,
    pub a_sort_order: i64,

    pub s_id: Option<i64>,
    pub s_account_id: Option<String>,
    pub s_fetched_at: Option<i64>,
    pub s_primary_used_pct: Option<f64>,
    pub s_primary_reset_at: Option<i64>,
    pub s_primary_window_secs: Option<i64>,
    pub s_secondary_used_pct: Option<f64>,
    pub s_secondary_reset_at: Option<i64>,
    pub s_secondary_window_secs: Option<i64>,
    pub s_limit_reached: Option<i64>,
    pub s_credits_has_credits: Option<i64>,
    pub s_credits_unlimited: Option<i64>,
    pub s_credits_balance: Option<f64>,
}

impl JoinedRow {
    pub fn into_dto(self) -> AccountWithUsageDto {
        let account = AccountRow {
            id: self.a_id,
            label: self.a_label,
            email: self.a_email,
            plan_type: self.a_plan_type,
            session_status: self.a_session_status,
            created_at: self.a_created_at,
            last_refreshed_at: self.a_last_refreshed_at,
            sort_order: self.a_sort_order,
        };

        let latest_snapshot = match (
            self.s_id,
            self.s_account_id,
            self.s_fetched_at,
            self.s_primary_used_pct,
            self.s_primary_reset_at,
            self.s_primary_window_secs,
            self.s_secondary_used_pct,
            self.s_secondary_reset_at,
            self.s_secondary_window_secs,
            self.s_limit_reached,
        ) {
            (
                Some(id),
                Some(aid),
                Some(fa),
                Some(pup),
                Some(pra),
                Some(pws),
                Some(sup),
                Some(sra),
                Some(sws),
                Some(lr),
            ) => Some(UsageSnapshotDto {
                id,
                account_id: aid,
                fetched_at: fa,
                primary_used_pct: pup,
                primary_reset_at: pra,
                primary_window_secs: pws,
                secondary_used_pct: sup,
                secondary_reset_at: sra,
                secondary_window_secs: sws,
                limit_reached: lr != 0,
                credits_has_credits: self.s_credits_has_credits.map(|v| v != 0),
                credits_unlimited: self.s_credits_unlimited.map(|v| v != 0),
                credits_balance: self.s_credits_balance,
            }),
            _ => None,
        };

        AccountWithUsageDto { account, latest_snapshot }
    }
}
