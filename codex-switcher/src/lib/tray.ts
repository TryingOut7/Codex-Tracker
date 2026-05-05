import type { AccountWithUsage } from '../types';

export type TrayStatus = 'good' | 'warn' | 'bad' | 'none';

function pickBest(accounts: AccountWithUsage[]): AccountWithUsage | null {
  const candidates = accounts.filter(
    (a) => a.session_status === 'active' && a.latest_snapshot && !a.latest_snapshot.limit_reached,
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) => a.latest_snapshot!.primary_used_pct - b.latest_snapshot!.primary_used_pct,
  )[0];
}

export function getTrayStatus(accounts: AccountWithUsage[]): TrayStatus {
  const activeWithSnap = accounts.filter(
    (a) => a.session_status === 'active' && a.latest_snapshot,
  );
  if (activeWithSnap.length === 0) return 'none';

  // All active accounts hit their limit
  if (activeWithSnap.every((a) => a.latest_snapshot!.limit_reached)) return 'bad';

  const best = pickBest(accounts);
  if (!best?.latest_snapshot) return 'none';
  const pct = best.latest_snapshot.primary_used_pct;
  if (pct >= 85) return 'bad';
  if (pct >= 60) return 'warn';
  return 'good';
}

export function buildTrayTooltip(best: AccountWithUsage | null): string {
  if (!best?.latest_snapshot) return 'Codex Switcher — no accounts available';
  const pct = Math.round(best.latest_snapshot.primary_used_pct);
  return `Codex Switcher — ${best.label} (${pct}% used)`;
}
