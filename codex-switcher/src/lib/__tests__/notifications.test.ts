import { describe, it, expect } from 'vitest';
import { detectResets } from '../notifications';
import { makeAccount, makeSnapshot } from '../../test/factories';

describe('detectResets', () => {
  it('returns empty when no previous state', () => {
    const curr = [makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 10 }) })];
    expect(detectResets([], curr)).toEqual([]);
  });

  it('returns empty when account was already low', () => {
    const prev = [makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 20 }) })];
    const curr = [makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 10 }) })];
    expect(detectResets(prev, curr)).toEqual([]);
  });

  it('detects reset when usage drops significantly (was >=50, now <50)', () => {
    const prev = [makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 72 }) })];
    const curr = [makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 8 }) })];
    expect(detectResets(prev, curr)).toHaveLength(1);
    expect(detectResets(prev, curr)[0].id).toBe('a1');
  });

  it('detects reset at the 50% boundary (was 50, now 49)', () => {
    const prev = [makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 50 }) })];
    const curr = [makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 49 }) })];
    expect(detectResets(prev, curr)).toHaveLength(1);
  });

  it('does not fire when usage stays high', () => {
    const prev = [makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 85 }) })];
    const curr = [makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 88 }) })];
    expect(detectResets(prev, curr)).toEqual([]);
  });

  it('does not fire for accounts not present in previous', () => {
    const prev: typeof curr = [];
    const curr = [makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 5 }) })];
    expect(detectResets(prev, curr)).toEqual([]);
  });

  it('ignores accounts with no snapshot', () => {
    const prev = [makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 80 }) })];
    const curr = [makeAccount({ id: 'a1', latest_snapshot: null })];
    expect(detectResets(prev, curr)).toEqual([]);
  });

  it('detects resets on multiple accounts at once', () => {
    const prev = [
      makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 75 }) }),
      makeAccount({ id: 'a2', latest_snapshot: makeSnapshot({ primary_used_pct: 60 }) }),
    ];
    const curr = [
      makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 5 }) }),
      makeAccount({ id: 'a2', latest_snapshot: makeSnapshot({ primary_used_pct: 3 }) }),
    ];
    expect(detectResets(prev, curr)).toHaveLength(2);
  });
});
