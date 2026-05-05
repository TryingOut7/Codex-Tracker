import { useEffect, useState } from 'react';

function formatRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s <= 0) return 'refreshing…';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}

/** Returns a human-readable string like "4m 32s" counting down to the next poll. */
export function useNextRefresh(
  lastRefreshed: number | null,
  intervalMinutes: number | null,
): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!lastRefreshed || !intervalMinutes) {
      setLabel(null);
      return;
    }
    const nextAt = lastRefreshed + intervalMinutes * 60_000;
    const tick = () => setLabel(formatRemaining(nextAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastRefreshed, intervalMinutes]);

  return label;
}
