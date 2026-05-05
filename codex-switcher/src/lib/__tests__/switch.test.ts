import { describe, it, expect } from 'vitest';
import { getSwitchSuggestion } from '../switch';
import { makeAccount, makeSnapshot } from '../../test/factories';

describe('getSwitchSuggestion', () => {
  it('returns null when no accounts', () => {
    expect(getSwitchSuggestion([])).toBeNull();
  });

  it('returns null when best account is below 80%', () => {
    const accs = [makeAccount({ latest_snapshot: makeSnapshot({ primary_used_pct: 70 }) })];
    expect(getSwitchSuggestion(accs)).toBeNull();
  });

  it('returns null when best is at exactly 80%', () => {
    const accs = [makeAccount({ latest_snapshot: makeSnapshot({ primary_used_pct: 80 }) })];
    expect(getSwitchSuggestion(accs)).toBeNull();
  });

  it('returns suggestion when best account is above 80%', () => {
    const best = makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 85 }) });
    const result = getSwitchSuggestion([best]);
    expect(result).not.toBeNull();
    expect(result!.current.id).toBe('a1');
    expect(result!.next).toBeNull();
  });

  it('includes next best account when another is available', () => {
    const busy = makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 85 }) });
    const free = makeAccount({ id: 'a2', latest_snapshot: makeSnapshot({ primary_used_pct: 30 }) });
    const result = getSwitchSuggestion([busy, free]);
    expect(result!.next?.id).toBe('a2');
  });

  it('excludes limit_reached accounts from "next"', () => {
    const busy = makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 90 }) });
    const full = makeAccount({ id: 'a2', latest_snapshot: makeSnapshot({ primary_used_pct: 10, limit_reached: true }) });
    const result = getSwitchSuggestion([busy, full]);
    expect(result!.next).toBeNull();
  });

  it('excludes expired accounts from "next"', () => {
    const busy = makeAccount({ id: 'a1', latest_snapshot: makeSnapshot({ primary_used_pct: 90 }) });
    const expired = makeAccount({ id: 'a2', session_status: 'expired', latest_snapshot: makeSnapshot({ primary_used_pct: 10 }) });
    const result = getSwitchSuggestion([busy, expired]);
    expect(result!.next).toBeNull();
  });

  it('returns null when all accounts have no snapshots', () => {
    const acc = makeAccount({ latest_snapshot: null });
    expect(getSwitchSuggestion([acc])).toBeNull();
  });
});
