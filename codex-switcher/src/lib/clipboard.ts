import type { AccountWithUsage } from '../types';

export function buildCopyText(account: AccountWithUsage): string {
  return account.email?.trim() || account.label;
}
