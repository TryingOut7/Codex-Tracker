export type SessionStatus = 'active' | 'expired';
export type PlanType = 'plus' | 'pro' | 'free' | 'go' | 'unknown' | string;

export interface Account {
  id: string;
  label: string;
  email: string;
  plan_type: PlanType;
  session_status: SessionStatus;
  created_at: number;
  last_refreshed_at: number | null;
  sort_order: number;
}

export interface UsageSnapshot {
  id: number;
  account_id: string;
  fetched_at: number;
  primary_used_pct: number;
  primary_reset_at: number;
  primary_window_secs: number;
  secondary_used_pct: number;
  secondary_reset_at: number;
  secondary_window_secs: number;
  limit_reached: boolean;
  credits_has_credits: boolean | null;
  credits_unlimited: boolean | null;
  credits_balance: number | null;
}

export interface AccountWithUsage extends Account {
  latest_snapshot: UsageSnapshot | null;
}

export interface Settings {
  poll_interval_minutes: number;
  token_refresh_days: number;
}

export type LoginProgressStep = 'browser_opened' | 'callback_received' | 'complete';

export interface LoginProgressEvent {
  step: LoginProgressStep;
}

export interface AccountExpiredEvent {
  id: string;
  email: string;
}
