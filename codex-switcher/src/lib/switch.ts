import type { AccountWithUsage } from '../types';

export interface SwitchSuggestion {
  current: AccountWithUsage;
  next: AccountWithUsage | null;
}

const SWITCH_THRESHOLD = 80;

function activeWithSnap(a: AccountWithUsage) {
  return a.session_status === 'active' && a.latest_snapshot != null;
}

export function getSwitchSuggestion(
  accounts: AccountWithUsage[],
): SwitchSuggestion | null {
  const active = accounts.filter(activeWithSnap);
  if (active.length === 0) return null;

  // "current" = the most-used account (the one being burned)
  const current = [...active].sort(
    (a, b) => b.latest_snapshot!.primary_used_pct - a.latest_snapshot!.primary_used_pct,
  )[0];

  if (current.latest_snapshot!.primary_used_pct <= SWITCH_THRESHOLD) return null;

  // "next" = the least-used active account that isn't limit_reached
  const next =
    active
      .filter((a) => a.id !== current.id && !a.latest_snapshot!.limit_reached)
      .sort((a, b) => a.latest_snapshot!.primary_used_pct - b.latest_snapshot!.primary_used_pct)[0] ??
    null;

  return { current, next };
}
