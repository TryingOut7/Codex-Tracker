import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { Trash2, X } from 'lucide-react';
import { api } from '../api';
import type { AccountWithUsage, Settings } from '../types';
import { cn } from '../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings | null;
  accounts: AccountWithUsage[];
  onChanged: () => Promise<void>;
}

const POLL_OPTIONS = [5, 10, 15, 30, 60];

export function SettingsPanel({
  open,
  onClose,
  settings,
  accounts,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  if (!open || !settings) return null;

  const setInterval = async (minutes: number) => {
    setBusy(true);
    try {
      await api.updateSettings({ ...settings, poll_interval_minutes: minutes });
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this account? Tokens will be removed from Keychain.')) return;
    setBusy(true);
    try {
      await api.deleteAccount(id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xs flex-col border-l border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-[13px] font-semibold tracking-tight">Settings</h3>
          <button
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X className="size-3.5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-auto p-4">
          {/* Poll interval */}
          <section className="space-y-2.5">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Refresh interval
              </h4>
              <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                How often the app polls usage in the background.
              </p>
            </div>
            <div className="inline-flex overflow-hidden rounded border border-border">
              {POLL_OPTIONS.map((m) => {
                const active = settings.poll_interval_minutes === m;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={busy}
                    onClick={() => setInterval(m)}
                    className={cn(
                      'mono px-3 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-50',
                      active
                        ? 'bg-primary/20 text-primary border-x border-primary/30 first:border-l-0 last:border-r-0'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {m}m
                  </button>
                );
              })}
            </div>
          </section>

          {/* Accounts list */}
          <section className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Accounts
            </h4>
            {accounts.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">No accounts yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {accounts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-secondary/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-foreground">
                        {a.label}
                      </p>
                      <p className="mono truncate text-[10px] text-muted-foreground">
                        {a.email || a.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'mono rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest',
                          a.session_status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400',
                        )}
                      >
                        {a.session_status}
                      </span>
                      <button
                        className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                        disabled={busy}
                        onClick={() => remove(a.id)}
                        aria-label="Delete account"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Debug info */}
          <section className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Debugging
              </h4>
              {version && (
                <span className="mono text-[10px] text-muted-foreground/50">v{version}</span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              Open <strong className="text-muted-foreground">Web Inspector</strong> from the menubar tray or press{' '}
              <kbd className="mono rounded border border-border bg-secondary px-1 py-0.5 text-[9px]">⌘⌥I</kbd>.
            </p>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              Tokens are stored in macOS Keychain. The first save will prompt you to allow access.
            </p>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              Polling intervals shorter than 5m are not supported to avoid rate limiting.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
