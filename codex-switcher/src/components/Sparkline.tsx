import { useEffect, useState } from 'react';
import { api } from '../api';
import type { UsageSnapshot } from '../types';
import { snapshotsToPoints, buildPolyline } from '../lib/sparkline';

const W = 120;
const H = 28;

interface Props {
  accountId: string;
}

export function Sparkline({ accountId }: Props) {
  const [snapshots, setSnapshots] = useState<UsageSnapshot[]>([]);

  useEffect(() => {
    api.getUsageHistory(accountId, 1).then(setSnapshots).catch(() => {});
  }, [accountId]);

  const points = snapshotsToPoints(snapshots);
  const polyline = buildPolyline(points, W, H);

  if (points.length < 2) return null;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="overflow-visible"
      aria-label="24h usage history"
    >
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground/40"
      />
    </svg>
  );
}
