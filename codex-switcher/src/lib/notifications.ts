import type { AccountWithUsage } from '../types';

const RESET_THRESHOLD = 50;

export function detectResets(
  prev: AccountWithUsage[],
  curr: AccountWithUsage[],
): AccountWithUsage[] {
  const prevMap = new Map(prev.map((a) => [a.id, a]));

  return curr.filter((a) => {
    const before = prevMap.get(a.id);
    if (!before) return false;
    const prevPct = before.latest_snapshot?.primary_used_pct;
    const currPct = a.latest_snapshot?.primary_used_pct;
    if (prevPct == null || currPct == null) return false;
    return prevPct >= RESET_THRESHOLD && currPct < RESET_THRESHOLD;
  });
}
