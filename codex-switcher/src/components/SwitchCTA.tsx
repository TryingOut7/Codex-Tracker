import { memo } from 'react';
import { ArrowRight, Zap } from 'lucide-react';
import type { AccountWithUsage } from '../types';
import { getSwitchSuggestion } from '../lib/switch';

function SwitchCTABase({ accounts }: { accounts: AccountWithUsage[] }) {
  const suggestion = getSwitchSuggestion(accounts);
  if (!suggestion) return null;

  const { current, next } = suggestion;
  const usedPct = Math.round(current.latest_snapshot!.primary_used_pct);

  return (
    <div className="flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/8 px-4 py-2.5">
      <Zap className="size-3.5 shrink-0 text-amber-400" />
      <p className="flex-1 text-[11px] text-amber-300/90">
        <span className="font-semibold text-amber-300">{current.label}</span>
        {' '}is {usedPct}% used — consider switching
        {next ? (
          <>
            {' '}to{' '}
            <span className="font-semibold text-amber-300">{next.label}</span>
            {' '}({Math.round(next.latest_snapshot!.primary_used_pct)}% used)
          </>
        ) : (
          ' to a less-used account'
        )}
        .
      </p>
      {next && (
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-amber-400/70">
          {current.label} <ArrowRight className="size-2.5" /> {next.label}
        </span>
      )}
    </div>
  );
}

export const SwitchCTA = memo(SwitchCTABase);
