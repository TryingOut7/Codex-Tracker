import { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    check()
      .then(async (update) => {
        if (!update?.available) return;
        await update.downloadAndInstall();
        setUpdateReady(true);
      })
      .catch(() => {
        // silently ignore — no network, dev mode, etc.
      });
  }, []);

  return (
    <>
      <Dashboard />
      {updateReady && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-md border border-primary/30 bg-card px-4 py-3 shadow-xl">
          <div>
            <p className="text-[12px] font-semibold text-foreground">Update ready</p>
            <p className="text-[10px] text-muted-foreground">Restart to apply the latest version.</p>
          </div>
          <button
            className="rounded border border-primary/40 bg-primary/15 px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/25"
            onClick={() => relaunch()}
          >
            Restart
          </button>
        </div>
      )}
    </>
  );
}
