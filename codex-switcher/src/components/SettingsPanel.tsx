import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { check as checkUpdate } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { ExternalLink, Trash2, X } from 'lucide-react';
import { api } from '../api';
import type { AccountWithUsage, Settings } from '../types';
import { cn } from '../lib/utils';

type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up_to_date' }
  | { kind: 'available'; version: string; downloading: boolean; progress: number }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

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
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: 'idle' });

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  const handleCheckUpdate = async () => {
    setUpdateStatus({ kind: 'checking' });
    try {
      const update = await checkUpdate();
      if (!update?.available) {
        setUpdateStatus({ kind: 'up_to_date' });
        return;
      }
      setUpdateStatus({ kind: 'available', version: update.version, downloading: false, progress: 0 });
      setUpdateStatus((s) => s.kind === 'available' ? { ...s, downloading: true } : s);
      await update.downloadAndInstall((event) => {
        if (event.event === 'Progress') {
          const { chunkLength, contentLength } = event.data as {
            chunkLength: number;
            contentLength?: number;
          };
          const pct = contentLength ? Math.round((chunkLength / contentLength) * 100) : 0;
          setUpdateStatus((s) => s.kind === 'available' ? { ...s, progress: pct } : s);
        }
      });
      setUpdateStatus({ kind: 'ready' });
    } catch (e) {
      setUpdateStatus({ kind: 'error', message: String(e) });
    }
  };

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

          {/* Alert threshold */}
          <section className="space-y-2.5">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Usage alert threshold
              </h4>
              <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                Show a bell icon when an account's 5-hour usage drops below this percentage. Set to 0 to disable.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={99}
                step={1}
                disabled={busy}
                value={settings.alert_threshold}
                onChange={async (e) => {
                  const v = Number(e.target.value);
                  setBusy(true);
                  try {
                    await api.updateSettings({ ...settings, alert_threshold: v });
                    await onChanged();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="h-1.5 w-full accent-primary disabled:opacity-50"
              />
              <span className="mono w-8 shrink-0 text-right text-[11px] font-semibold text-foreground">
                {settings.alert_threshold === 0 ? 'off' : `${settings.alert_threshold}%`}
              </span>
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

          {/* Updates */}
          <section className="space-y-2.5 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Updates
              </h4>
              {version && (
                <span className="mono text-[10px] text-muted-foreground/50">v{version}</span>
              )}
            </div>

            {updateStatus.kind === 'idle' && (
              <button
                onClick={handleCheckUpdate}
                className="inline-flex h-6 items-center gap-1.5 rounded border border-border bg-secondary px-2.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Check for Updates
              </button>
            )}

            {updateStatus.kind === 'checking' && (
              <p className="text-[10px] text-muted-foreground">Checking for updates…</p>
            )}

            {updateStatus.kind === 'up_to_date' && (
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-emerald-400">You're up to date.</p>
                <button
                  onClick={() => setUpdateStatus({ kind: 'idle' })}
                  className="text-[10px] text-muted-foreground/50 underline hover:text-muted-foreground"
                >
                  Check again
                </button>
              </div>
            )}

            {updateStatus.kind === 'available' && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-primary">
                  Update available — v{updateStatus.version}
                </p>
                {updateStatus.downloading && (
                  <div className="h-1 w-full overflow-hidden rounded bg-border">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${updateStatus.progress}%` }}
                    />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/60">
                  {updateStatus.downloading ? 'Downloading…' : 'Preparing download…'}
                </p>
              </div>
            )}

            {updateStatus.kind === 'ready' && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-emerald-400">Update downloaded. Restart to apply.</p>
                <button
                  onClick={() => relaunch()}
                  className="inline-flex h-6 items-center gap-1.5 rounded border border-primary/40 bg-primary/15 px-2.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/25"
                >
                  Restart Now
                </button>
              </div>
            )}

            {updateStatus.kind === 'error' && (
              <div className="space-y-1">
                <p className="text-[10px] text-red-400">Update check failed.</p>
                <button
                  onClick={() => setUpdateStatus({ kind: 'idle' })}
                  className="text-[10px] text-muted-foreground/50 underline hover:text-muted-foreground"
                >
                  Try again
                </button>
              </div>
            )}
          </section>

          {/* Support */}
          <section className="space-y-2 border-t border-border pt-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Support
            </h4>
            <div className="space-y-1.5">
              <SupportLink
                href="https://github.com/TryingOut7/Codex-Tracker/issues/new"
                label="Report a bug"
              />
              <SupportLink
                href="https://github.com/TryingOut7/Codex-Tracker/releases"
                label="View changelog"
              />
              <SupportLink
                href="https://github.com/TryingOut7/Codex-Tracker#readme"
                label="Documentation"
              />
            </div>
          </section>

          {/* Debug info */}
          <section className="space-y-2 border-t border-border pt-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Debugging
            </h4>
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

function SupportLink({ href, label }: { href: string; label: string }) {
  return (
    <button
      onClick={() => openUrl(href)}
      className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 transition-colors hover:text-foreground"
    >
      <ExternalLink className="size-3 shrink-0" />
      {label}
    </button>
  );
}
