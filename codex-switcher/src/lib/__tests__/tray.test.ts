import { describe, it, expect } from 'vitest';
import { getTrayStatus, buildTrayTooltip } from '../tray';
import { makeAccount, makeSnapshot } from '../../test/factories';

describe('getTrayStatus', () => {
  it('returns "none" when no accounts', () => {
    expect(getTrayStatus([])).toBe('none');
  });

  it('returns "none" when all accounts are expired', () => {
    const accounts = [makeAccount({ session_status: 'expired' })];
    expect(getTrayStatus(accounts)).toBe('none');
  });

  it('returns "none" when all accounts have no snapshot', () => {
    const accounts = [makeAccount({ latest_snapshot: null })];
    expect(getTrayStatus(accounts)).toBe('none');
  });

  it('returns "good" when best account is below 60%', () => {
    const accounts = [makeAccount({ latest_snapshot: makeSnapshot({ primary_used_pct: 40 }) })];
    expect(getTrayStatus(accounts)).toBe('good');
  });

  it('returns "warn" when best account is 60–84%', () => {
    const accounts = [makeAccount({ latest_snapshot: makeSnapshot({ primary_used_pct: 70 }) })];
    expect(getTrayStatus(accounts)).toBe('warn');
  });

  it('returns "bad" when best account is ≥85%', () => {
    const accounts = [makeAccount({ latest_snapshot: makeSnapshot({ primary_used_pct: 90 }) })];
    expect(getTrayStatus(accounts)).toBe('bad');
  });

  it('returns "bad" when limit_reached on all active accounts', () => {
    const accounts = [
      makeAccount({ latest_snapshot: makeSnapshot({ limit_reached: true }) }),
    ];
    expect(getTrayStatus(accounts)).toBe('bad');
  });

  it('picks the best (lowest usage) account across multiple', () => {
    const accounts = [
      makeAccount({ id: 'a', latest_snapshot: makeSnapshot({ primary_used_pct: 90 }) }),
      makeAccount({ id: 'b', latest_snapshot: makeSnapshot({ primary_used_pct: 30 }) }),
    ];
    expect(getTrayStatus(accounts)).toBe('good');
  });
});

describe('buildTrayTooltip', () => {
  it('returns fallback message when no best account', () => {
    expect(buildTrayTooltip(null)).toBe('Codex Switcher — no accounts available');
  });

  it('includes account label and usage percentage', () => {
    const account = makeAccount({
      label: 'Work',
      latest_snapshot: makeSnapshot({ primary_used_pct: 42 }),
    });
    const tooltip = buildTrayTooltip(account);
    expect(tooltip).toContain('Work');
    expect(tooltip).toContain('42%');
  });
});
