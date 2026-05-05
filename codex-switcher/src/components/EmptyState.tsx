import { useState, useEffect } from 'react';

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setCursorOn((v) => !v), 530);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mx-auto max-w-sm text-center">
      {/* Terminal window chrome */}
      <div className="rounded-md border border-border bg-card overflow-hidden shadow-xl">
        {/* Fake title bar */}
        <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-3 py-2">
          <div className="size-2.5 rounded-full bg-red-500/60" />
          <div className="size-2.5 rounded-full bg-amber-500/60" />
          <div className="size-2.5 rounded-full bg-emerald-500/60" />
          <span className="mono ml-2 text-[10px] text-muted-foreground/60">codex-switcher</span>
        </div>

        {/* Terminal body */}
        <div className="px-5 py-6 text-left font-mono">
          <p className="text-[11px] text-muted-foreground/60 mb-3">
            $ codex-switcher --list-accounts
          </p>
          <p className="text-[11px] text-muted-foreground/40 mb-4">
            ERROR: no accounts configured
          </p>
          <p className="text-[11px] text-muted-foreground/60">
            $ codex-switcher --add-account
            <span
              className="ml-0.5 inline-block w-[7px] h-[13px] bg-primary/70 align-middle"
              style={{ opacity: cursorOn ? 1 : 0, transition: 'opacity 0.05s' }}
            />
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-1.5">
        <h2 className="text-sm font-semibold text-foreground">No accounts yet</h2>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Add a ChatGPT account to start tracking Codex usage and find the best account to use right now.
        </p>
      </div>

      <button
        className="mt-5 inline-flex items-center gap-2 rounded border border-primary/40 bg-primary/15 px-4 py-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/25"
        onClick={onAdd}
      >
        + Add first account
      </button>
    </div>
  );
}
