import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Capture the event listener so tests can fire synthetic events
let capturedListener: ((event: { payload: unknown }) => void) | null = null;
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((_event: string, cb: (e: { payload: unknown }) => void) => {
    capturedListener = cb;
    return Promise.resolve(() => { capturedListener = null; });
  }),
}));

import { usePollBackoff } from '../usePollBackoff';

function emit(payload: unknown) {
  act(() => { capturedListener?.({ payload }); });
}

describe('usePollBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    capturedListener = null;
  });

  afterEach(() => { vi.useRealTimers(); });

  it('returns null when no backoff event has arrived', () => {
    const { result } = renderHook(() => usePollBackoff());
    expect(result.current).toBeNull();
  });

  it('returns a rate-limit label after a rate_limited event', () => {
    const { result } = renderHook(() => usePollBackoff());

    emit({ ticks_remaining: 3, reason: 'rate_limited', retry_in_secs: 900 });

    expect(result.current).toMatch(/Rate limited/);
    expect(result.current).toMatch(/retrying in/);
  });

  it('returns a network-error label after a network event', () => {
    const { result } = renderHook(() => usePollBackoff());

    emit({ ticks_remaining: 1, reason: 'network', retry_in_secs: 300 });

    expect(result.current).toMatch(/Network error/);
  });

  it('clears the label when ticks_remaining drops to 0', () => {
    const { result } = renderHook(() => usePollBackoff());

    emit({ ticks_remaining: 2, reason: 'rate_limited', retry_in_secs: 600 });
    expect(result.current).not.toBeNull();

    emit({ ticks_remaining: 0, reason: 'backoff', retry_in_secs: 0 });
    expect(result.current).toBeNull();
  });

  it('clears the label on a "cleared" reason regardless of ticks_remaining', () => {
    const { result } = renderHook(() => usePollBackoff());

    emit({ ticks_remaining: 1, reason: 'rate_limited', retry_in_secs: 300 });
    expect(result.current).not.toBeNull();

    emit({ ticks_remaining: 1, reason: 'cleared', retry_in_secs: 0 });
    expect(result.current).toBeNull();
  });

  it('shows "retrying…" when the retry window has already elapsed', () => {
    const { result } = renderHook(() => usePollBackoff());

    // retry_in_secs = 0 means the window has passed
    emit({ ticks_remaining: 1, reason: 'rate_limited', retry_in_secs: 0 });

    expect(result.current).toMatch(/retrying…/);
  });
});
