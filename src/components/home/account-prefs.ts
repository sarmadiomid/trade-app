'use client';

import { useSyncExternalStore } from 'react';

const prefListeners = new Set<() => void>();

export function subscribeAccountPrefs(onStoreChange: () => void) {
  prefListeners.add(onStoreChange);
  return () => {
    prefListeners.delete(onStoreChange);
  };
}

export function readAccountPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeAccountPref(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    prefListeners.forEach((listener) => listener());
    return true;
  } catch {
    return false;
  }
}

export const accountAvatarKey = (id: string) => `chartix-avatar:${id}`;

export function useAccountAvatar(userId: string): string | null {
  return useSyncExternalStore(
    subscribeAccountPrefs,
    () => readAccountPref(accountAvatarKey(userId)),
    () => null,
  );
}
