import { memo, useMemo } from 'react';
import { Zap } from 'lucide-react';
import type { AccountWithUsage } from '../types';
import { CountdownTimer } from './CountdownTimer';
import { UsageBar } from './UsageBar';

function pickBest(accounts: AccountWithUsage[]): AccountWithUsage | null {
  const candidates = accounts.filter(
    (a) =>
      a.session_status === 'active' &&
      a.latest_snapshot &&
      !a.latest_snapshot.limit_reached,
  );
  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const sa = a.latest_snapshot!;
    const sb = b.latest_snapshot!;
    if (sa.primary_used_pct !== sb.primary_used_pct)
      return sa.primary_used_pct - sb.primary_used_pct;
    return sa.primary_reset_at - sb.primary_reset_at;
  })[0];
}

function BestAccountBannerBase({ accounts }: { accounts: AccountWithUsage[] }) {
  const best = useMemo(() => pickBest(accounts), [accounts]);
  if (!best || !best.latest_snapshot) return null;
  const snap = best.latest_snapshot;

  const primaryLeft  = Math.max(0, 100 - Math.round(snap.primary_used_pct));
  const secondaryLeft = Math.max(0, 100 - Math.round(snap.secondary_used_pct));

  return (
    <div
      className="glow-emerald relative overflow-hidden rounded-md border border-emerald-500/25 bg-card"
      style={{
        background: 'linear-gradient(135deg, hsl(142 71% 45% / 0.06) 0%, hsl(220 24% 8%) 60%)',
      }}
    >
      {/* Decorative top-left accent line */}
      <div
        className="absolute left-0 top-0 h-full w-0.5"
        style={{ background: 'linear-gradient(to bottom, hsl(142 71% 45%), transparent)' }}
      />

      <div className="px-5 py-4">
        {/* Header row */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded bg-emerald-500/15">
              <Zap className="size-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400">
              Best available now
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mono">
            <span>
              5h{' '}
              <span className="text-emerald-400 font-semibold">{primaryLeft}%</span>
            </span>
            <span className="opacity-30">·</span>
            <span>
              weekly{' '}
              <span className="text-emerald-400 font-semibold">{secondaryLeft}%</span>
            </span>
            <span className="opacity-30">·</span>
            <span>
              resets{' '}
              <span className="text-foreground/70">
                <CountdownTimer targetUnix={snap.primary_reset_at} />
              </span>
            </span>
          </div>
        </div>

        {/* Account identity */}
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {best.label}
          </h2>
          <span className="text-xs text-muted-foreground">{best.email}</span>
          <span
            className="ml-auto rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400"
          >
            {best.plan_type}
          </span>
        </div>

        {/* Usage bars */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-0">
          <UsageBar
            label="5-hour"
            usedPct={snap.primary_used_pct}
            resetAt={snap.primary_reset_at}
            limitReached={snap.limit_reached}
          />
          <UsageBar
            label="Weekly"
            usedPct={snap.secondary_used_pct}
            resetAt={snap.secondary_reset_at}
            limitReached={snap.limit_reached}
          />
        </div>
      </div>
    </div>
  );
}

export const BestAccountBanner = memo(BestAccountBannerBase);
