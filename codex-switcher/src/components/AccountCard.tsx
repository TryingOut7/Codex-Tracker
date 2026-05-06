import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { MoreVertical, RefreshCw, Trash2, Pencil, LogIn, AlertTriangle, Bell, Clock } from 'lucide-react';
import type { AccountWithUsage } from '../types';
import { cn, initials } from '../lib/utils';
import { lastRefreshedLabel } from '../lib/time';
import { getThresholdStatus } from '../lib/threshold';
import { UsageBar } from './UsageBar';
import { Sparkline } from './Sparkline';

interface Props {
  account: AccountWithUsage;
  alertThreshold: number;
  onRefresh: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRelogin: (id: string, label: string) => Promise<void>;
  onRename: (id: string, label: string) => Promise<void>;
}

function planBadgeClass(plan: string): string {
  const p = plan.toLowerCase();
  if (p.includes('pro')) return 'border-violet-500/40 bg-violet-500/15 text-violet-400';
  if (p.includes('plus')) return 'border-primary/40 bg-primary/15 text-primary';
  if (p.includes('team') || p.includes('enterprise')) return 'border-amber-500/40 bg-amber-500/15 text-amber-400';
  return 'border-border bg-secondary text-muted-foreground';
}

function accentClass(snap: AccountWithUsage['latest_snapshot'], expired: boolean): string {
  if (expired) return 'accent-bad';
  if (!snap) return 'accent-muted';
  if (snap.limit_reached || snap.primary_used_pct >= 85) return 'accent-bad';
  if (snap.primary_used_pct >= 60) return 'accent-warn';
  return 'accent-good';
}

function AccountCardBase({
  account,
  alertThreshold,
  onRefresh,
  onDelete,
  onRelogin,
  onRename,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState(account.label);
  const [busy, setBusy] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const expired = account.session_status === 'expired';
  const snap = account.latest_snapshot;

  const STALE_MS = 5 * 60 * 1000;
  const [isStale, setIsStale] = useState(
    () => account.last_refreshed_at != null && Date.now() - account.last_refreshed_at > STALE_MS,
  );
  useEffect(() => {
    const check = () => {
      setIsStale(account.last_refreshed_at != null && Date.now() - account.last_refreshed_at > STALE_MS);
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [account.last_refreshed_at]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleRefresh = useCallback(async () => {
    setBusy(true);
    setCardError(null);
    try {
      await onRefresh(account.id);
    } catch (e) {
      setCardError(String(e));
    } finally {
      setBusy(false);
    }
  }, [account.id, onRefresh]);

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete ${account.email || account.label}? Tokens will be removed from Keychain.`)) return;
    setBusy(true);
    try { await onDelete(account.id); }
    finally { setBusy(false); }
  }, [account.email, account.id, account.label, onDelete]);

  const handleRelogin = useCallback(async () => {
    setBusy(true);
    try { await onRelogin(account.id, account.label); }
    finally { setBusy(false); }
  }, [account.id, account.label, onRelogin]);

  const submitRename = useCallback(async () => {
    const next = draftLabel.trim() || account.label;
    setRenaming(false);
    if (next === account.label) return;
    setBusy(true);
    try { await onRename(account.id, next); }
    finally { setBusy(false); }
  }, [account.id, account.label, draftLabel, onRename]);

  return (
    <div
      className={cn(
        'relative rounded-md border bg-card transition-all duration-150',
        'border-l-[3px]',
        'shadow-[0_2px_8px_hsl(222_28%_4%/0.5)]',
        'hover:shadow-[0_4px_16px_hsl(222_28%_4%/0.7)] hover:-translate-y-px',
        accentClass(snap, expired),
        expired ? 'border-red-500/30' : 'border-border',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Initials avatar */}
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded text-[11px] font-bold mono',
              expired
                ? 'bg-red-500/15 text-red-400'
                : 'bg-primary/10 text-primary',
            )}
          >
            {initials(account.label, account.email)}
          </div>

          <div className="min-w-0">
            {renaming ? (
              <input
                autoFocus
                className="w-full rounded border border-border bg-input px-2 py-0.5 text-sm font-semibold text-foreground outline-none focus:border-primary"
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename();
                  if (e.key === 'Escape') { setDraftLabel(account.label); setRenaming(false); }
                }}
              />
            ) : (
              <p className="truncate text-sm font-semibold text-foreground leading-tight">
                {account.label}
              </p>
            )}
            <p className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
              {account.email || 'fetching email…'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {getThresholdStatus(account, alertThreshold) === 'under' && (
            <span title={`Usage below ${alertThreshold}%`} className="flex items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
              <Bell className="size-2.5" />
            </span>
          )}
          <span className={cn('mono rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest', planBadgeClass(account.plan_type))}>
            {account.plan_type}
          </span>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={`Open menu for ${account.label}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="size-3.5" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-border bg-popover p-1 text-xs shadow-xl"
              >
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-foreground/80 hover:bg-accent hover:text-foreground transition-colors"
                  onClick={() => { setMenuOpen(false); setRenaming(true); }}
                >
                  <Pencil className="size-3" /> Rename
                </button>
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-foreground/80 hover:bg-accent hover:text-foreground transition-colors"
                  onClick={() => { setMenuOpen(false); handleRefresh(); }}
                >
                  <RefreshCw className="size-3" /> Refresh
                </button>
                <div className="my-1 border-t border-border" />
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-red-500 hover:bg-red-500/10 transition-colors"
                  onClick={() => { setMenuOpen(false); handleDelete(); }}
                >
                  <Trash2 className="size-3" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expired banner */}
      {expired && (
        <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded border border-red-500/30 bg-red-500/8 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] text-red-400">
            <AlertTriangle className="size-3 shrink-0" />
            Session expired
          </div>
          <button
            className="inline-flex items-center gap-1 rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
            disabled={busy}
            onClick={handleRelogin}
          >
            <LogIn className="size-2.5" /> Re-login
          </button>
        </div>
      )}

      {/* Per-card refresh error */}
      {cardError && (
        <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded border border-amber-500/30 bg-amber-500/8 px-3 py-2">
          <p className="truncate text-[11px] text-amber-400" title={cardError}>
            Refresh failed
          </p>
          <button
            className="shrink-0 text-[10px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            onClick={handleRefresh}
            disabled={busy}
          >
            Retry
          </button>
        </div>
      )}

      {/* Usage bars */}
      <div className="space-y-3 px-4 pb-3">
        {snap ? (
          <>
            <UsageBar
              label="5-hour window"
              usedPct={snap.primary_used_pct}
              resetAt={snap.primary_reset_at}
              limitReached={snap.limit_reached}
              windowType="short"
            />
            <UsageBar
              label="Weekly window"
              usedPct={snap.secondary_used_pct}
              resetAt={snap.secondary_reset_at}
              limitReached={snap.limit_reached}
              windowType="weekly"
            />
          </>
        ) : (
          <div className="space-y-2 py-1">
            <div className="h-[6px] animate-pulse rounded-sm bg-secondary" />
            <div className="h-[6px] animate-pulse rounded-sm bg-secondary" />
            <p className="text-[10px] text-muted-foreground mono">Fetching usage…</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <button
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-medium transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40',
          )}
          disabled={busy || expired}
          onClick={handleRefresh}
        >
          <RefreshCw className={cn('size-3', busy && 'animate-spin')} />
          Refresh
        </button>
        <Sparkline accountId={account.id} />
        <span className="flex items-center gap-1 mono text-[10px] text-muted-foreground" aria-live="polite">
          {isStale && !expired && (
            <span title="Data may be stale (>5 min old)"><Clock className="size-2.5 text-amber-400" /></span>
          )}
          {lastRefreshedLabel(account.last_refreshed_at)}
        </span>
      </div>
    </div>
  );
}

export const AccountCard = memo(AccountCardBase);
