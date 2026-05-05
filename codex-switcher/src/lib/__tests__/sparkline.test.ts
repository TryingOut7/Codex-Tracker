import { describe, it, expect } from 'vitest';
import { snapshotsToPoints, buildPolyline } from '../sparkline';
import { makeSnapshot } from '../../test/factories';

describe('snapshotsToPoints', () => {
  it('returns empty array for empty input', () => {
    expect(snapshotsToPoints([])).toEqual([]);
  });

  it('maps snapshots to {x, y} points sorted oldest-first', () => {
    const snaps = [
      makeSnapshot({ fetched_at: 200, primary_used_pct: 60 }),
      makeSnapshot({ fetched_at: 100, primary_used_pct: 30 }),
    ];
    const pts = snapshotsToPoints(snaps);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ x: 100, y: 30 });
    expect(pts[1]).toEqual({ x: 200, y: 60 });
  });

  it('clamps y to 0–100', () => {
    const pts = snapshotsToPoints([
      makeSnapshot({ primary_used_pct: -5 }),
      makeSnapshot({ primary_used_pct: 110 }),
    ]);
    expect(pts[0].y).toBe(0);
    expect(pts[1].y).toBe(100);
  });
});

describe('buildPolyline', () => {
  it('returns empty string for no points', () => {
    expect(buildPolyline([], 100, 32)).toBe('');
  });

  it('maps a single point to canvas center-y', () => {
    const result = buildPolyline([{ x: 0, y: 50 }], 100, 32);
    // x should be 0 (only one point, maps to left edge), y at 50% of height = 16
    expect(result).toBe('0,16');
  });

  it('maps 0% usage to bottom of canvas and 100% to top', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 100 },
    ];
    const result = buildPolyline(points, 100, 32);
    const pairs = result.split(' ');
    const [, y0] = pairs[0].split(',').map(Number);
    const [, y1] = pairs[1].split(',').map(Number);
    expect(y0).toBe(32); // 0% → bottom
    expect(y1).toBe(0);  // 100% → top
  });
});
