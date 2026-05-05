import { invoke } from '@tauri-apps/api/core';
import type { AccountWithUsage, UsageSnapshot, Settings } from './types';

const THRESHOLD_KEY = 'codex_alert_threshold';

function loadThreshold(): number {
  return Number(localStorage.getItem(THRESHOLD_KEY) ?? 0);
}

function saveThreshold(v: number) {
  localStorage.setItem(THRESHOLD_KEY, String(v));
}

export const api = {
  loginAccount: (label?: string, existingAccountId?: string) =>
    invoke<AccountWithUsage>('login_account', {
      label: label ?? null,
      existingAccountId: existingAccountId ?? null,
    }),

  getAccounts: () => invoke<AccountWithUsage[]>('get_accounts'),
  deleteAccount: (id: string) => invoke<void>('delete_account', { id }),
  updateAccountLabel: (id: string, label: string) =>
    invoke<void>('update_account_label', { id, label }),
  refreshUsage: (id: string) => invoke<UsageSnapshot>('refresh_usage', { id }),
  refreshAllUsage: () => invoke<UsageSnapshot[]>('refresh_all_usage'),
  getBestAccount: () => invoke<AccountWithUsage | null>('get_best_account'),
  getUsageHistory: (id: string, days: number) =>
    invoke<UsageSnapshot[]>('get_usage_history', { id, days }),
  getSettings: async (): Promise<Settings> => {
    const s = await invoke<Settings>('get_settings');
    return { ...s, alert_threshold: loadThreshold() };
  },
  updateSettings: async (settings: Settings): Promise<void> => {
    saveThreshold(settings.alert_threshold);
    const { alert_threshold: _, ...rest } = settings;
    return invoke<void>('update_settings', { settings: rest });
  },
  updateSortOrder: (orders: { id: string; sort_order: number }[]) =>
    invoke<void>('update_sort_order', { orders }),
  /** Safari Web Inspector — requires `tauri` `devtools` feature + window `devtools: true`. */
  openWebInspector: () => invoke<void>('open_web_inspector'),
};
