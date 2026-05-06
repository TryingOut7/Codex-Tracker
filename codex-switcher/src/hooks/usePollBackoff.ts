import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

type BackoffReason = 'rate_limited' | 'network' | 'backoff' | 'cleared';

interface BackoffEvent {
  ticks_remaining: number;
  reason: BackoffReason;
  retry_in_secs: number;
}

interface BackoffState {
  active: boolean;
  reason: 'rate_limited' | 'network' | null;
  retryAtMs: number | null;
}

function formatRetry(ms: number): string {
  const s = Math.ceil((ms - Date.now()) / 1000);
  if (s <= 0) return 'retrying…';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `~${m}m` : `~${m}m ${rem}s`;
}

/** Listens for poll-backoff events and returns a human-readable backoff label. */
export function usePollBackoff(): string | null {
  const [state, setState] = useState<BackoffState>({ active: false, reason: null, retryAtMs: null });
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen<BackoffEvent>('poll-backoff', ({ payload }) => {
      if (payload.ticks_remaining === 0 || payload.reason === 'cleared') {
        setState({ active: false, reason: null, retryAtMs: null });
        return;
      }
      const reason = payload.reason === 'rate_limited' ? 'rate_limited'
        : payload.reason === 'network' ? 'network'
        : null;
      setState({
        active: true,
        reason,
        retryAtMs: Date.now() + payload.retry_in_secs * 1000,
      });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    if (!state.active || !state.retryAtMs) {
      setLabel(null);
      return;
    }
    const tick = () => {
      const prefix = state.reason === 'rate_limited' ? 'Rate limited' : 'Network error';
      setLabel(`${prefix} · retrying in ${formatRetry(state.retryAtMs!)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state]);

  return label;
}
