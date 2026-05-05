import { useCallback, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Makes the host element a window drag region.
 *
 * Approach: native `mousedown` listener bound via a ref. This bypasses
 * React's synthetic-event pipeline (which on macOS / wry leaves React's
 * "is mouse pressed" state stuck after a window drag because the OS drag
 * loop swallows the matching mouseup), while still calling
 * `preventDefault()` so WebKit's text-selection layer doesn't claim the
 * mouse before our IPC dispatch reaches `NSWindow.performWindowDrag`.
 *
 * Children matching `INTERACTIVE_SELECTOR` (or `[data-no-drag]`) are
 * skipped so buttons inside the drag region still click.
 */
const INTERACTIVE_SELECTOR =
  'button,input,textarea,select,a,label,[role="button"],[data-no-drag]';

export function useDraggable<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);

  const onMouseDown = useCallback((event: MouseEvent) => {
    // `e.buttons === 1` means *currently* held primary; `e.button === 0`
    // is the pressed button index. Both must be true for a real drag.
    if (event.button !== 0) return;
    if (event.detail >= 2) return; // double-click is handled separately

    const target = event.target as HTMLElement | null;
    if (!target) return;

    const host = ref.current;
    if (!host || !host.contains(target)) return;

    if (target.closest(INTERACTIVE_SELECTOR)) return;

    // preventDefault stops WebKit from starting a text-selection drag,
    // which would otherwise consume the mouseDown before our IPC call
    // reaches NSWindow.performWindowDrag.
    event.preventDefault();

    // Fire-and-forget. NSWindow needs the current mouseDown event to
    // still be in NSApp.currentEvent at IPC dispatch time, so we must
    // not `await` here.
    getCurrentWindow()
      .startDragging()
      .catch((err) => console.warn('startDragging() failed:', err));
  }, []);

  const onDoubleClick = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const host = ref.current;
    if (!host || !target || !host.contains(target)) return;
    if (target.closest(INTERACTIVE_SELECTOR)) return;

    event.preventDefault();
    getCurrentWindow()
      .toggleMaximize()
      .catch((err) => console.warn('toggleMaximize() failed:', err));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('dblclick', onDoubleClick);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('dblclick', onDoubleClick);
    };
  }, [onMouseDown, onDoubleClick]);

  return ref;
}
