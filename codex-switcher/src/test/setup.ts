import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock @tauri-apps/api/core so tests don't need a real Tauri runtime
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));
