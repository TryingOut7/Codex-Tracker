import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from '../Dashboard';

const windowApi = vi.hoisted(() => ({
  setFocus: vi.fn(() => Promise.resolve()),
  startDragging: vi.fn(() => Promise.resolve()),
  toggleMaximize: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => windowApi,
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => ({
    accounts: [],
    settings: { poll_interval_minutes: 15, alert_threshold: 0 },
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastRefreshed: null,
    refreshAll: vi.fn(),
    reload: vi.fn(),
  }),
}));

vi.mock('../../hooks/usePollBackoff', () => ({
  usePollBackoff: () => null,
}));

vi.mock('../AddAccountModal', () => ({
  AddAccountModal: () => null,
}));

vi.mock('../SettingsPanel', () => ({
  SettingsPanel: () => null,
}));

vi.mock('../WelcomeModal', () => ({
  WelcomeModal: () => null,
  useFirstRun: () => false,
  markWelcomeSeen: vi.fn(),
}));

describe('Dashboard title-bar dragging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts a window drag when dragging nested title text', async () => {
    render(<Dashboard />);

    fireEvent.mouseDown(screen.getByText('Codex Switcher'), {
      button: 0,
      buttons: 1,
      detail: 1,
    });

    await waitFor(() => {
      expect(windowApi.setFocus).toHaveBeenCalledOnce();
      expect(windowApi.startDragging).toHaveBeenCalledOnce();
    });
  });
});
