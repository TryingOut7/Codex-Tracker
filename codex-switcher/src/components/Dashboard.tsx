import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Settings as SettingsIcon, Terminal, HelpCircle } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useDraggable } from '../hooks/useDraggable';
import { useCardSort } from '../hooks/useCardSort';
import { useNextRefresh } from '../hooks/useNextRefresh';
import { usePollBackoff } from '../hooks/usePollBackoff';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { api } from '../api';
import { AccountCard } from './AccountCard';
import { BestAccountBanner } from './BestAccountBanner';
import { SwitchCTA } from './SwitchCTA';
import { EmptyState } from './EmptyState';
import { AddAccountModal } from './AddAccountModal';
import { SettingsPanel } from './SettingsPanel';
import { WelcomeModal, useFirstRun, markWelcomeSeen } from './WelcomeModal';
import { cn } from '../lib/utils';

export function Dashboard() {
  const dragRef = useDraggable<HTMLElement>();
  const {
    accounts,
    settings,
    isLoading,
    isRefreshing,
    error,
    lastRefreshed,
    refreshAll,
    reload,
  } = useAccounts();

  const { sortedAccounts, onDragStart, onDragOver, onDrop, onDragEnd } = useCardSort(accounts);
  const nextRefreshLabel = useNextRefresh(lastRefreshed, settings?.poll_interval_minutes ?? null);
  const backoffLabel = usePollBackoff();

  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWelcome, setShowWelcome] = useState(useFirstRun);
  const [reloginFor, setReloginFor] = useState<{
    id: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.altKey && e.code === 'KeyI') {
        e.preventDefault();
        void api.openWebInspector();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleRefresh = useCallback(async (id: string) => {
    await api.refreshUsage(id);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteAccount(id);
      await reload();
    },
    [reload],
  );

  const handleRename = useCallback(
    async (id: string, label: string) => {
      await api.updateAccountLabel(id, label);
      await reload();
    },
    [reload],
  );

  const handleRelogin = useCallback(async (id: string, label: string) => {
    setReloginFor({ id, label });
  }, []);

  const subtitle = useMemo(() => {
    const base = `${accounts.length} account${accounts.length === 1 ? '' : 's'}`;
    if (!settings) return base;
    const poll = `poll ${settings.poll_interval_minutes}m`;
    const countdown = nextRefreshLabel ? `next ${nextRefreshLabel}` : null;
    return [base, poll, countdown].filter(Boolean).join(' · ');
  }, [accounts.length, settings, nextRefreshLabel]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* macOS title bar */}
      <header
        ref={dragRef}
        className="relative z-20 flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/80 pl-[88px] pr-3 backdrop-blur-sm"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Terminal className="size-3.5 shrink-0 text-primary/70" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-[12px] font-semibold tracking-tight text-foreground">
              Codex Switcher
            </span>
            <span className="mono truncate text-[10px] text-muted-foreground">
              {subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            className={cn(
              'inline-flex h-6 items-center gap-1.5 rounded border border-border bg-secondary px-2.5 text-[10px] font-medium text-muted-foreground transition-colors',
              'hover:border-border hover:bg-accent hover:text-foreground disabled:opacity-40',
            )}
            onClick={refreshAll}
            disabled={isRefreshing || accounts.length === 0}
            aria-label="Refresh all accounts"
            title="Refresh all accounts"
          >
            <RefreshCw className={cn('size-3', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
          <button
            className="inline-flex size-6 items-center justify-center rounded border border-border bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => openUrl('https://github.com/TryingOut7/Codex-Tracker#readme')}
            aria-label="Help and documentation"
            title="Help"
          >
            <HelpCircle className="size-3" />
          </button>
          <button
            className="inline-flex size-6 items-center justify-center rounded border border-border bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => setShowSettings(true)}
            aria-label="Open settings"
            title="Settings"
          >
            <SettingsIcon className="size-3" />
          </button>
          <button
            className="inline-flex h-6 items-center gap-1.5 rounded border border-primary/40 bg-primary/15 px-2.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/25"
            onClick={() => setShowAdd(true)}
            title="Add a new ChatGPT account"
          >
            <Plus className="size-3" /> Add
          </button>
        </div>
      </header>

      {/* Rate-limit / network backoff banner */}
      {backoffLabel && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/8 px-4 py-1.5 text-[10px] font-medium text-amber-400">
          {backoffLabel}
        </div>
      )}

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-5 py-5">
          {error && (
            <div className="mb-4 rounded border border-red-500/25 bg-red-500/8 px-3 py-2 text-[11px] text-red-400">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="grid min-h-[60vh] place-items-center">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="size-5 animate-spin text-muted-foreground/40" />
                <span className="mono text-[11px] text-muted-foreground">Loading…</span>
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="grid min-h-[60vh] place-items-center">
              <EmptyState onAdd={() => setShowAdd(true)} />
            </div>
          ) : (
            <main className="space-y-4 pb-6">
              <BestAccountBanner accounts={accounts} />
              <SwitchCTA accounts={accounts} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {sortedAccounts.map((a) => (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={(e) => onDragStart(a.id, e)}
                    onDragOver={(e) => onDragOver(a.id, e)}
                    onDrop={onDrop}
                    onDragEnd={onDragEnd}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <AccountCard
                      account={a}
                      alertThreshold={settings?.alert_threshold ?? 0}
                      onRefresh={handleRefresh}
                      onDelete={handleDelete}
                      onRelogin={handleRelogin}
                      onRename={handleRename}
                    />
                  </div>
                ))}
              </div>
            </main>
          )}
        </div>
      </div>

      <WelcomeModal
        open={showWelcome}
        onGetStarted={() => {
          markWelcomeSeen();
          setShowWelcome(false);
          setShowAdd(true);
        }}
      />
      <AddAccountModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={reload}
      />
      <AddAccountModal
        open={!!reloginFor}
        onClose={() => setReloginFor(null)}
        onSuccess={reload}
        prefilledLabel={reloginFor?.label}
        existingAccountId={reloginFor?.id}
      />
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        accounts={accounts}
        onChanged={reload}
      />
    </div>
  );
}
