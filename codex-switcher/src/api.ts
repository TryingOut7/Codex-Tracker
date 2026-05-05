import { invoke } from '@tauri-apps/api/core';
import type { AccountWithUsage, UsageSnapshot, Settings } from './types';

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
  getSettings: () => invoke<Settings>('get_settings'),
  updateSettings: (settings: Settings) =>
    invoke<void>('update_settings', { settings }),
  /** Safari Web Inspector — requires `tauri` `devtools` feature + window `devtools: true`. */
  openWebInspector: () => invoke<void>('open_web_inspector'),
};
