CREATE TABLE IF NOT EXISTS accounts (
    id                TEXT PRIMARY KEY,
    label             TEXT NOT NULL,
    email             TEXT NOT NULL DEFAULT '',
    plan_type         TEXT NOT NULL DEFAULT 'unknown',
    session_status    TEXT NOT NULL DEFAULT 'active',
    created_at        INTEGER NOT NULL,
    last_refreshed_at INTEGER,
    sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS usage_snapshots (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id            TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    fetched_at            INTEGER NOT NULL,
    primary_used_pct      REAL    NOT NULL,
    primary_reset_at      INTEGER NOT NULL,
    primary_window_secs   INTEGER NOT NULL,
    secondary_used_pct    REAL    NOT NULL,
    secondary_reset_at    INTEGER NOT NULL,
    secondary_window_secs INTEGER NOT NULL,
    limit_reached         INTEGER NOT NULL DEFAULT 0,
    credits_has_credits   INTEGER,
    credits_unlimited     INTEGER,
    credits_balance       REAL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_account_time
    ON usage_snapshots(account_id, fetched_at DESC);

-- Trim trigger: index-only deletion using fetched_at boundary, no COUNT(*).
-- Removes rows older than the 200th-most-recent for the same account.
CREATE TRIGGER IF NOT EXISTS trim_snapshots
AFTER INSERT ON usage_snapshots
BEGIN
    DELETE FROM usage_snapshots
    WHERE account_id = NEW.account_id
      AND fetched_at < COALESCE((
        SELECT fetched_at FROM usage_snapshots
        WHERE account_id = NEW.account_id
        ORDER BY fetched_at DESC
        LIMIT 1 OFFSET 200
      ), 0);
END;

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings VALUES ('poll_interval_minutes', '15');
INSERT OR IGNORE INTO settings VALUES ('token_refresh_days',    '7');
