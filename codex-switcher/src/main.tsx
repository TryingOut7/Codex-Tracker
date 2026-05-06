/// <reference types="vite/client" />
import * as Sentry from '@sentry/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: import.meta.env.MODE,
  });
}

function CrashScreen() {
  return (
    <div className="grid h-screen place-items-center bg-background p-8 text-center">
      <div className="space-y-3">
        <p className="text-[13px] font-semibold text-foreground">Something went wrong</p>
        <p className="text-[11px] text-muted-foreground">
          Please restart Codex Switcher. If this keeps happening,{' '}
          <a
            href="https://github.com/TryingOut7/Codex-Tracker/issues"
            className="text-primary underline"
          >
            report the issue
          </a>
          .
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashScreen />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
