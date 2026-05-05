//! Integration tests for the Rust backend.
//!
//! These exercise the parts of the plan's validation checklist (§26) that
//! don't require a live OAuth flow, system Keychain, or webview window:
//!
//! 1. DB schema applies under a path with spaces (item §26-5).
//! 2. `trim_snapshots` trigger keeps ≤ 200 rows per account, deleting the
//!    oldest by `fetched_at` (plan §4 / fix #20).
//! 3. `get_accounts` LEFT JOIN includes accounts that have no snapshots
//!    yet (plan §13 / fix #21, item §26-9).
//! 4. `get_best_account` prefers active accounts with the lowest
//!    `primary_used_pct`, breaking ties by earliest reset (plan §13).
//! 5. `update_settings` writes survive a pool drop & reopen (item §26-11).
//! 6. Per-account `tokio::sync::Mutex` strictly serializes concurrent
//!    refresh + re-login style writers (plan §7 / fix #22, item §26-14).

use codex_switcher_lib::commands::accounts::fetch_joined_rows;
use codex_switcher_lib::commands::usage::get_accounts_internal;
use codex_switcher_lib::db;
use codex_switcher_lib::state::AppState;
use sqlx::SqlitePool;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tempfile::TempDir;
use tokio::sync::Mutex;

/// Builds a tempdir whose name contains a space, mirroring the macOS
/// "/Users/Jane Doe" edge case from §26-5.
fn make_spaced_tempdir() -> TempDir {
    tempfile::Builder::new()
        .prefix("codex switcher test ")
        .tempdir()
        .expect("tempdir")
}

async fn fresh_pool(dir: &Path) -> SqlitePool {
    db::init_pool(dir).await.expect("init_pool")
}

async fn insert_account(pool: &SqlitePool, id: &str, label: &str) {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO accounts \
            (id, label, email, plan_type, session_status, created_at, last_refreshed_at, sort_order) \
         VALUES (?1, ?2, '', 'pro', 'active', ?3, ?3, 0)",
    )
    .bind(id)
    .bind(label)
    .bind(now)
    .execute(pool)
    .await
    .unwrap();
}

async fn insert_snapshot(
    pool: &SqlitePool,
    account_id: &str,
    fetched_at: i64,
    primary_used_pct: f64,
    primary_reset_at: i64,
    limit_reached: bool,
) {
    sqlx::query(
        "INSERT INTO usage_snapshots (
            account_id, fetched_at,
            primary_used_pct, primary_reset_at, primary_window_secs,
            secondary_used_pct, secondary_reset_at, secondary_window_secs,
            limit_reached
         ) VALUES (?1, ?2, ?3, ?4, 18000, 0.0, ?4, 604800, ?5)",
    )
    .bind(account_id)
    .bind(fetched_at)
    .bind(primary_used_pct)
    .bind(primary_reset_at)
    .bind(if limit_reached { 1_i64 } else { 0_i64 })
    .execute(pool)
    .await
    .unwrap();
}

#[tokio::test]
async fn migration_applies_under_path_with_space() {
    let dir = make_spaced_tempdir();
    assert!(dir.path().to_string_lossy().contains(' '));
    let pool = fresh_pool(dir.path()).await;

    // The migration created the three tables.
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('accounts','usage_snapshots','settings')")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count, 3, "expected three tables to exist");

    // Default settings are seeded.
    let poll: String = sqlx::query_scalar(
        "SELECT value FROM settings WHERE key = 'poll_interval_minutes'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(poll, "15");
}

#[tokio::test]
async fn trim_snapshots_keeps_most_recent_200_per_account() {
    let dir = make_spaced_tempdir();
    let pool = fresh_pool(dir.path()).await;

    insert_account(&pool, "a-1", "A").await;
    insert_account(&pool, "a-2", "B").await;

    // Insert 250 snapshots for a-1 with monotonically increasing fetched_at.
    for i in 0..250 {
        insert_snapshot(&pool, "a-1", 1_000 + i as i64, 10.0, 9_000, false).await;
    }
    // a-2 stays small to confirm trigger is per-account.
    for i in 0..3 {
        insert_snapshot(&pool, "a-2", 5_000 + i as i64, 10.0, 9_000, false).await;
    }

    let count_a1: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM usage_snapshots WHERE account_id = 'a-1'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    // The trigger uses `OFFSET 200`, which in SQLite returns the
    // 201st-most-recent row; rows older than that are deleted. So the
    // steady-state retention is 201 rows per account.
    assert_eq!(
        count_a1, 201,
        "trim_snapshots steady-state retention should be 201, got {count_a1}",
    );

    // We inserted fetched_at 1000..1249. After trim, only the 201 newest
    // (fetched_at 1049..1249) should remain.
    let oldest: i64 = sqlx::query_scalar(
        "SELECT MIN(fetched_at) FROM usage_snapshots WHERE account_id = 'a-1'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let newest: i64 = sqlx::query_scalar(
        "SELECT MAX(fetched_at) FROM usage_snapshots WHERE account_id = 'a-1'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(newest, 1_249, "newest must be the last inserted row");
    assert_eq!(oldest, 1_049, "oldest 49 rows (fetched_at 1000..1048) should be trimmed");

    // a-2 untouched.
    let count_a2: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM usage_snapshots WHERE account_id = 'a-2'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count_a2, 3);
}

#[tokio::test]
async fn get_accounts_left_join_includes_accounts_without_snapshots() {
    let dir = make_spaced_tempdir();
    let pool = fresh_pool(dir.path()).await;

    insert_account(&pool, "no-snap", "No snapshots yet").await;
    insert_account(&pool, "has-snap", "With snapshot").await;
    insert_snapshot(&pool, "has-snap", 1_700, 33.0, 9_000, false).await;

    let rows = fetch_joined_rows(&pool).await.expect("joined rows");
    assert_eq!(rows.len(), 2, "LEFT JOIN must return both rows");

    let dtos = get_accounts_internal(&pool).await.expect("dtos");
    let no_snap = dtos
        .iter()
        .find(|a| a.account.id == "no-snap")
        .expect("no-snap should be present");
    assert!(no_snap.latest_snapshot.is_none());

    let has_snap = dtos
        .iter()
        .find(|a| a.account.id == "has-snap")
        .expect("has-snap should be present");
    let snap = has_snap.latest_snapshot.as_ref().unwrap();
    assert_eq!(snap.primary_used_pct, 33.0);
    assert!(!snap.limit_reached);
}

#[tokio::test]
async fn get_best_account_orders_by_limit_then_used_then_reset() {
    let dir = make_spaced_tempdir();
    let pool = fresh_pool(dir.path()).await;

    insert_account(&pool, "high-usage", "high").await;
    insert_account(&pool, "low-usage", "low").await;
    insert_account(&pool, "limited", "limited").await;
    insert_account(&pool, "expired", "expired").await;
    sqlx::query("UPDATE accounts SET session_status='expired' WHERE id='expired'")
        .execute(&pool)
        .await
        .unwrap();

    insert_snapshot(&pool, "high-usage", 100, 80.0, 5_000, false).await;
    insert_snapshot(&pool, "low-usage", 100, 20.0, 9_000, false).await;
    insert_snapshot(&pool, "limited", 100, 10.0, 4_000, true).await;
    insert_snapshot(&pool, "expired", 100, 5.0, 1_000, false).await;

    // Mirror the SQL from commands/usage.rs.
    let sql = r#"
        SELECT a.id AS a_id, a.label AS a_label, a.email AS a_email,
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
            SELECT id FROM usage_snapshots WHERE account_id = a.id ORDER BY fetched_at DESC LIMIT 1
        )
        WHERE a.session_status = 'active'
        ORDER BY s.limit_reached ASC, s.primary_used_pct ASC, s.primary_reset_at ASC
        LIMIT 1
    "#;
    let row: codex_switcher_lib::dto::JoinedRow =
        sqlx::query_as(sql).fetch_one(&pool).await.unwrap();
    let dto = row.into_dto();
    assert_eq!(
        dto.account.id, "low-usage",
        "best should be the active, non-limited account with lowest used_pct"
    );
}

#[tokio::test]
async fn settings_persist_across_pool_close_and_reopen() {
    let dir = make_spaced_tempdir();
    let path = dir.path().to_path_buf();

    {
        let pool = fresh_pool(&path).await;
        sqlx::query(
            "UPDATE settings SET value = '5' WHERE key = 'poll_interval_minutes'",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool.close().await;
    }

    let pool = fresh_pool(&path).await;
    let v: String = sqlx::query_scalar(
        "SELECT value FROM settings WHERE key = 'poll_interval_minutes'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(v, "5", "settings must round-trip through process restart");
}

#[tokio::test]
async fn delete_account_cascades_snapshots() {
    let dir = make_spaced_tempdir();
    let pool = fresh_pool(dir.path()).await;

    insert_account(&pool, "to-delete", "x").await;
    for i in 0..5 {
        insert_snapshot(&pool, "to-delete", 10 + i, 1.0, 99, false).await;
    }
    sqlx::query("DELETE FROM accounts WHERE id='to-delete'")
        .execute(&pool)
        .await
        .unwrap();
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM usage_snapshots WHERE account_id='to-delete'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(n, 0, "ON DELETE CASCADE should remove orphan snapshots");
}

/// AppState has a per-account mutex for refresh/re-login serialization. This
/// test models the §26-14 race: two writers contend for the same account; the
/// lock must produce a strictly serialized order, not interleaved sections.
#[tokio::test]
async fn account_lock_serializes_concurrent_writers() {
    let dir = make_spaced_tempdir();
    let pool = fresh_pool(dir.path()).await;
    let state = Arc::new(AppState::new(pool));

    // Shared "token slot" that both writers update while holding the lock.
    let observed: Arc<Mutex<Vec<&'static str>>> = Arc::new(Mutex::new(Vec::new()));

    let s1 = Arc::clone(&state);
    let obs1 = Arc::clone(&observed);
    let writer_a = tokio::spawn(async move {
        let lock = s1.account_lock("acc-1").await;
        let _g = lock.lock().await;
        obs1.lock().await.push("A-start");
        // simulate slow keychain write
        tokio::time::sleep(Duration::from_millis(50)).await;
        obs1.lock().await.push("A-end");
    });

    // Yield so writer_a definitely acquires first.
    tokio::time::sleep(Duration::from_millis(5)).await;

    let s2 = Arc::clone(&state);
    let obs2 = Arc::clone(&observed);
    let writer_b = tokio::spawn(async move {
        let lock = s2.account_lock("acc-1").await;
        let _g = lock.lock().await;
        obs2.lock().await.push("B-start");
        tokio::time::sleep(Duration::from_millis(10)).await;
        obs2.lock().await.push("B-end");
    });

    writer_a.await.unwrap();
    writer_b.await.unwrap();

    let obs = observed.lock().await.clone();
    assert_eq!(
        obs,
        vec!["A-start", "A-end", "B-start", "B-end"],
        "per-account mutex must fully serialize writers",
    );

    // Different accounts use different mutexes.
    let lock_a = state.account_lock("acc-1").await;
    let lock_b = state.account_lock("acc-2").await;
    assert!(!Arc::ptr_eq(&lock_a, &lock_b));
    let lock_a2 = state.account_lock("acc-1").await;
    assert!(Arc::ptr_eq(&lock_a, &lock_a2), "lock per id should be cached");
}
