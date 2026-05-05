import type { UsageSnapshot } from '../types';

export interface SparkPoint {
  x: number;
  y: number;
}

export function snapshotsToPoints(snapshots: UsageSnapshot[]): SparkPoint[] {
  return [...snapshots]
    .sort((a, b) => a.fetched_at - b.fetched_at)
    .map((s) => ({
      x: s.fetched_at,
      y: Math.min(100, Math.max(0, s.primary_used_pct)),
    }));
}

export function buildPolyline(points: SparkPoint[], width: number, height: number): string {
  if (points.length === 0) return '';

  const minX = points[0].x;
  const maxX = points[points.length - 1].x;
  const xRange = maxX - minX || 1;

  return points
    .map((p) => {
      const px = points.length === 1 ? 0 : ((p.x - minX) / xRange) * width;
      const py = height - (p.y / 100) * height;
      return `${Math.round(px)},${Math.round(py)}`;
    })
    .join(' ');
}
