import { useCallback, useEffect, useRef, useState } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { CheckCircle2, Loader2, LogIn, X } from 'lucide-react';
import { api } from '../api';
import type { LoginProgressEvent } from '../types';

type Step = 'idle' | 'waiting' | 'fetching' | 'done' | 'error';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefilledLabel?: string;
  existingAccountId?: string;
}

export function AddAccountModal({
  open,
  onClose,
  onSuccess,
  prefilledLabel,
  existingAccountId,
}: Props) {
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState(prefilledLabel ?? '');
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('idle');
      setError(null);
      setLabel(prefilledLabel ?? '');
    }
  }, [open, prefilledLabel]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => dialogRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'waiting' && step !== 'fetching') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose, step]);

  useEffect(() => {
    if (!open) return;
    let unlisten: UnlistenFn | undefined;
    listen<LoginProgressEvent>('login-progress', (e) => {
      if (e.payload.step === 'browser_opened') setStep('waiting');
      if (e.payload.step === 'callback_received') setStep('fetching');
      if (e.payload.step === 'complete') setStep('done');
    }).then((u) => (unlisten = u));
    return () => {
      unlisten?.();
    };
  }, [open]);

  const startLogin = useCallback(async () => {
    setStep('waiting');
    setError(null);
    try {
      await api.loginAccount(label.trim() || undefined, existingAccountId);
      setStep('done');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 800);
    } catch (e) {
      setError(String(e));
      setStep('error');
    }
  }, [existingAccountId, label, onClose, onSuccess]);

  if (!open) return null;

  const port1455 = error?.includes('1455');
  const duplicate = error?.toLowerCase().includes('duplicate');
  const busy = step === 'waiting' || step === 'fetching';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (!busy && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-account-title"
        tabIndex={-1}
        className="w-full max-w-sm rounded-md border border-border bg-card shadow-2xl outline-none"
        style={{ boxShadow: '0 0 0 1px hsl(217 91% 60% / 0.15), 0 25px 50px -12px hsl(222 28% 2% / 0.8)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 id="add-account-title" className="text-[13px] font-semibold tracking-tight">
            {existingAccountId ? 'Re-login account' : 'Add account'}
          </h3>
          <button
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-4 py-4">
          {step === 'idle' && (
            <>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {existingAccountId
                  ? 'Open the ChatGPT login page to refresh credentials for this account.'
                  : 'Sign in with your ChatGPT account. The browser will open automatically.'}
              </p>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Label <span className="normal-case">(optional)</span>
                </span>
                <input
                  className="w-full rounded border border-border bg-input px-3 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/60 transition-colors"
                  placeholder="Personal, Work, …"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>
              <button
                onClick={startLogin}
                className="inline-flex w-full items-center justify-center gap-2 rounded border border-primary/40 bg-primary/15 py-2 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/25"
              >
                <LogIn className="size-3.5" /> Login with ChatGPT
              </button>
            </>
          )}

          {(step === 'waiting' || step === 'fetching') && (
            <div className="flex flex-col items-center gap-3 py-5 text-center">
              <Loader2 className="size-6 animate-spin text-primary/70" />
              <div>
                <p className="text-[12px] font-semibold text-foreground">
                  {step === 'waiting' ? 'Browser opened' : 'Connecting account…'}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {step === 'waiting'
                    ? 'Complete the login in your browser. We\'ll detect the callback automatically.'
                    : 'Storing tokens in Keychain and fetching first usage snapshot.'}
                </p>
              </div>
              {step === 'waiting' && (
                <button
                  className="rounded border border-border bg-secondary px-3 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={onClose}
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-5 text-center">
              <CheckCircle2 className="size-6 text-emerald-400" />
              <p className="text-[12px] font-semibold text-emerald-400">Account added!</p>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-3">
              <div className="rounded border border-red-500/25 bg-red-500/8 p-3">
                <p className="text-[11px] font-semibold text-red-400">Login failed</p>
                <p className="mono mt-1 break-words text-[10px] text-red-400/70">{error}</p>
                {port1455 && (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Port 1455 is used by the OAuth callback. Close any running Codex CLI session and try again.
                  </p>
                )}
                {duplicate && (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    OpenAI detected a duplicate auth attempt. To add a second account, open a <strong>private/incognito window</strong> in your browser after the login page opens — or use a different browser profile that isn't already signed into ChatGPT.
                  </p>
                )}
              </div>
              <button
                onClick={startLogin}
                className="inline-flex w-full items-center justify-center gap-2 rounded border border-primary/40 bg-primary/15 py-2 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/25"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
