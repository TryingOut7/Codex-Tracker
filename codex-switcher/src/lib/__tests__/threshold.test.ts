import { describe, it, expect } from 'vitest';
import { getThresholdStatus } from '../threshold';
import { makeAccount, makeSnapshot } from '../../test/factories';

describe('getThresholdStatus', () => {
  it('returns null when account has no snapshot', () => {
    const acc = makeAccount({ latest_snapshot: null });
    expect(getThresholdStatus(acc, 20)).toBeNull();
  });

  it('returns null when threshold is 0 (disabled)', () => {
    const acc = makeAccount({ latest_snapshot: makeSnapshot({ primary_used_pct: 95 }) });
    expect(getThresholdStatus(acc, 0)).toBeNull();
  });

  it('returns "under" when usage is below threshold', () => {
    const acc = makeAccount({ latest_snapshot: makeSnapshot({ primary_used_pct: 15 }) });
    expect(getThresholdStatus(acc, 20)).toBe('under');
  });

  it('returns "under" when usage equals threshold exactly', () => {
    const acc = makeAccount({ latest_snapshot: makeSnapshot({ primary_used_pct: 20 }) });
    expect(getThresholdStatus(acc, 20)).toBe('under');
  });

  it('returns null when usage is above threshold', () => {
    const acc = makeAccount({ latest_snapshot: makeSnapshot({ primary_used_pct: 55 }) });
    expect(getThresholdStatus(acc, 20)).toBeNull();
  });

  it('returns null when limit is already reached (card is already red)', () => {
    const acc = makeAccount({ latest_snapshot: makeSnapshot({ primary_used_pct: 10, limit_reached: true }) });
    expect(getThresholdStatus(acc, 20)).toBeNull();
  });

  it('returns null for expired accounts', () => {
    const acc = makeAccount({ session_status: 'expired', latest_snapshot: makeSnapshot({ primary_used_pct: 10 }) });
    expect(getThresholdStatus(acc, 20)).toBeNull();
  });
});
