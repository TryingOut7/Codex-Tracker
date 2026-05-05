import type { AccountWithUsage, UsageSnapshot } from '../types';

export function makeSnapshot(overrides: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return {
    id: 1,
    account_id: 'acc-1',
    fetched_at: 1_700_000_000,
    primary_used_pct: 20,
    primary_reset_at: 1_700_018_000,
    primary_window_secs: 18_000,
    secondary_used_pct: 10,
    secondary_reset_at: 1_700_604_800,
    secondary_window_secs: 604_800,
    limit_reached: false,
    credits_has_credits: null,
    credits_unlimited: null,
    credits_balance: null,
    ...overrides,
  };
}

export function makeAccount(overrides: Partial<AccountWithUsage> = {}): AccountWithUsage {
  return {
    id: 'acc-1',
    label: 'Work',
    email: 'work@example.com',
    plan_type: 'plus',
    session_status: 'active',
    created_at: 1_700_000_000,
    last_refreshed_at: 1_700_000_000,
    sort_order: 0,
    latest_snapshot: makeSnapshot(),
    ...overrides,
  };
}
