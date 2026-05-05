import type { AccountWithUsage } from '../types';

export type ThresholdStatus = 'under' | null;

export function getThresholdStatus(
  account: AccountWithUsage,
  threshold: number,
): ThresholdStatus {
  if (threshold === 0) return null;
  if (account.session_status !== 'active') return null;
  const snap = account.latest_snapshot;
  if (!snap) return null;
  if (snap.limit_reached) return null;
  if (snap.primary_used_pct <= threshold) return 'under';
  return null;
}
