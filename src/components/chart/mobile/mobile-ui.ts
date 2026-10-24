import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

interface DesktopMode {
  /** Narrow screens keep the full desktop toolbar. */
  readonly forced: boolean;
  setForced(forced: boolean): void;
}

export const useDesktopMode = create<DesktopMode>((set) => ({
  forced: false,
  setForced: (forced) => {
    try {
      sessionStorage.setItem('chart-desktop-mode', forced ? '1' : '0');
    } catch {
      /* private mode */
    }
    set({ forced });
  },
}));

const QUERY = '(max-width: 1023px)';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  const unsub = useDesktopMode.subscribe(onChange);
  return () => {
    mq.removeEventListener('change', onChange);
    unsub();
  };
}

function compactNow(): boolean {
  return window.matchMedia(QUERY).matches && !useDesktopMode.getState().forced;
}

/** True on a phone or tablet unless the user switched to desktop mode. */
export function useCompactChart(): boolean {
  return useSyncExternalStore(subscribe, compactNow, () => false);
}

/** Restores a desktop-mode choice made earlier in this tab. */
export function restoreDesktopMode(): void {
  try {
    if (sessionStorage.getItem('chart-desktop-mode') === '1')
      useDesktopMode.setState({ forced: true });
  } catch {
    /* private mode */
  }
}
