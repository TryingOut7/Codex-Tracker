import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api } from '../api';
import type {
  AccountExpiredEvent,
  AccountWithUsage,
  Settings,
} from '../types';

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountWithUsage[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [accs, s] = await Promise.all([
        api.getAccounts(),
        api.getSettings(),
      ]);
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
    const unlistenUsage = listen<AccountWithUsage[]>('usage-updated', (e) =>
      setAccounts(e.payload),
    );
    const unlistenExpired = listen<AccountExpiredEvent>(
      'account-expired',
      (e) =>
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === e.payload.id ? { ...a, session_status: 'expired' } : a,
          ),
        ),
    );
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
    refreshAll,
    reload,
    setAccounts,
    setSettings,
  };
}
