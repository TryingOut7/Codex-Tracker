import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api } from '../api';
import { detectResets } from '../lib/notifications';
import type {
  AccountExpiredEvent,
  AccountWithUsage,
  Settings,
} from '../types';

function notify(title: string, body: string) {
  if (!('Notification' in window)) return;
  const send = () => new Notification(title, { body, silent: false });
  if (Notification.permission === 'granted') {
    send();
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((p) => { if (p === 'granted') send(); });
  }
}

function fireResetNotifications(resets: AccountWithUsage[]) {
  for (const a of resets) {
    notify('Usage reset', `${a.label} (${a.email || a.id}) 5-hour window has reset.`);
  }
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountWithUsage[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const prevAccountsRef = useRef<AccountWithUsage[]>([]);

  const reload = useCallback(async () => {
    try {
      const [accs, s] = await Promise.all([
        api.getAccounts(),
        api.getSettings(),
      ]);
      prevAccountsRef.current = accs;
      setAccounts(accs);
      setSettings(s);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const unlistenUsage = listen<AccountWithUsage[]>('usage-updated', (e) => {
      const next = e.payload;
      fireResetNotifications(detectResets(prevAccountsRef.current, next));
      prevAccountsRef.current = next;
      setAccounts(next);
      setLastRefreshed(Date.now());
    });
    const unlistenExpired = listen<AccountExpiredEvent>('account-expired', (e) => {
      notify(
        'Session expired',
        `${e.payload.email || e.payload.id} needs to re-login.`,
      );
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === e.payload.id ? { ...a, session_status: 'expired' } : a,
        ),
      );
    });
    return () => {
      unlistenUsage.then((f) => f());
      unlistenExpired.then((f) => f());
    };
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await api.refreshAllUsage();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return {
    accounts,
    settings,
    isLoading,
    isRefreshing,
    error,
    lastRefreshed,
    refreshAll,
    reload,
    setAccounts,
    setSettings,
  };
}
