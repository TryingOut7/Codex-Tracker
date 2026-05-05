import { memo } from 'react';
import { CountdownTimer } from './CountdownTimer';
import { formatResetDay, formatResetTime } from '../lib/time';

interface Props {
  label: string;
  usedPct: number;
  resetAt: number;
  limitReached: boolean;
  windowType: 'short' | 'weekly';
}

const TOTAL_SEGMENTS = 20;

function segmentColor(segIndex: number, usedSegments: number, limitReached: boolean): string {
  if (segIndex >= usedSegments) return 'hsl(var(--secondary))';
  if (limitReached) return 'hsl(0 72% 51%)';
  const pct = (segIndex + 1) / TOTAL_SEGMENTS * 100;
  if (pct > 85) return 'hsl(0 72% 51%)';
  if (pct > 60) return 'hsl(38 92% 50%)';
  return 'hsl(142 71% 45%)';
}

function UsageBarBase({ label, usedPct, resetAt, limitReached, windowType }: Props) {
  const used = Math.min(100, Math.max(0, Math.round(usedPct)));
  const remaining = Math.max(0, 100 - used);
  const usedSegments = Math.round((used / 100) * TOTAL_SEGMENTS);

  const remainingColor = limitReached || remaining <= 15
    ? 'hsl(0 72% 51%)'
    : remaining <= 40
      ? 'hsl(38 92% 50%)'
      : 'hsl(142 71% 45%)';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
          {label}
        </span>
        <span
          className="mono text-[17px] font-bold leading-none tabular-nums"
          style={{ color: remainingColor }}
        >
          {remaining}%
        </span>
      </div>

      {/* Segmented gauge */}
      <div
        className="gauge-track"
        role="progressbar"
        aria-label={`${label}: ${remaining}% remaining`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={remaining}
      >
        {Array.from({ length: TOTAL_SEGMENTS }, (_, i) => (
          <div
            key={i}
            className="gauge-segment"
            style={{
              backgroundColor: segmentColor(i, usedSegments, limitReached),
              opacity: limitReached && i < usedSegments ? undefined : undefined,
              animation: limitReached && i >= usedSegments - 2 && i < usedSegments
                ? 'pulse 1.5s ease-in-out infinite'
                : undefined,
            }}
          />
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground mono">
        {limitReached ? (
          windowType === 'weekly' ? (
            <>LIMIT REACHED · resets {formatResetDay(resetAt)}</>
          ) : (
            <>LIMIT REACHED · resets <CountdownTimer targetUnix={resetAt} /> · at {formatResetTime(resetAt)}</>
          )
        ) : windowType === 'weekly' ? (
          <>resets {formatResetDay(resetAt)}</>
        ) : (
          <>resets <CountdownTimer targetUnix={resetAt} /> · at {formatResetTime(resetAt)}</>
        )}
      </p>
    </div>
  );
}

export const UsageBar = memo(UsageBarBase);
