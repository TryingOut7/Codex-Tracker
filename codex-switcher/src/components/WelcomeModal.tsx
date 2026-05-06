import { useEffect, useRef } from 'react';
import { Terminal, RefreshCw, Bell } from 'lucide-react';

const STORAGE_KEY = 'welcome_v1_seen';

export function useFirstRun() {
  return !localStorage.getItem(STORAGE_KEY);
}

export function markWelcomeSeen() {
  localStorage.setItem(STORAGE_KEY, '1');
}

interface Props {
  open: boolean;
  onGetStarted: () => void;
}

export function WelcomeModal({ open, onGetStarted }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => btnRef.current?.focus());
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div
        className="w-full max-w-sm rounded-md border border-border bg-card shadow-2xl"
        style={{ boxShadow: '0 0 0 1px hsl(217 91% 60% / 0.15), 0 25px 50px -12px hsl(222 28% 2% / 0.8)' }}
      >
        {/* Header */}
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Terminal className="size-4 text-primary/80" />
            <span className="text-[14px] font-semibold tracking-tight text-foreground">
              Welcome to Codex Switcher
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
            Track Codex usage across multiple ChatGPT accounts and always know which one has capacity right now.
          </p>
        </div>

        {/* Feature list */}
        <div className="space-y-3 px-5 py-4">
          <Feature
            icon={<RefreshCw className="size-3.5 text-primary/70" />}
            title="Live usage tracking"
            description="Polls your accounts in the background and shows 5-hour rolling usage in real time."
          />
          <Feature
            icon={<Terminal className="size-3.5 text-primary/70" />}
            title="One-click switch"
            description="Copies the right claude codex switch command for the account with the most capacity."
          />
          <Feature
            icon={<Bell className="size-3.5 text-primary/70" />}
            title="Low-usage alerts"
            description="Get a visual alert when any account drops below your configured usage threshold."
          />
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4">
          <button
            ref={btnRef}
            onClick={onGetStarted}
            className="inline-flex w-full items-center justify-center gap-2 rounded border border-primary/40 bg-primary/15 py-2 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/25"
          >
            Get started — add your first account
          </button>
          <p className="mt-2.5 text-center text-[10px] text-muted-foreground/50">
            Your tokens are stored only in macOS Keychain. Nothing leaves your machine.
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border border-border bg-secondary">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
