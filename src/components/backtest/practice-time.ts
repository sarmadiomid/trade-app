'use client';

import { useEffect } from 'react';
import { sanitizePracticeImport, type PracticeLog } from '@/lib/backtest/session/practice';

const KEY = 'chartix-practice-ms';
const SYNCED = 'chartix-practice-ms-synced';

export type PracticeStore = Readonly<Record<string, PracticeLog>>;

let uploading: Promise<void> | null = null;

function redirectToLogin(): void {
  const login = new URL('/login', window.location.origin);
  login.searchParams.set('next', window.location.pathname);
  window.location.replace(login.href);
}

/** Sends the minutes this browser already counted, once, then forgets the local copy. */
function uploadLocalOnce(): Promise<void> {
  if (typeof localStorage === 'undefined' || localStorage.getItem(SYNCED)) return Promise.resolve();
  uploading ??= (async () => {
    let raw: unknown = {};
    try {
      const text = localStorage.getItem(KEY);
      raw = text ? JSON.parse(text) : {};
    } catch {
      raw = {};
    }
    const res = await fetch('/api/backtest/practice', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ import: raw }),
    });
    if (res.status === 401) {
      redirectToLogin();
      return;
    }
    if (!res.ok) throw new Error('practice import failed');
    localStorage.setItem(SYNCED, '1');
    localStorage.removeItem(KEY);
  })().catch((e: unknown) => {
    uploading = null;
    throw e;
  });
  return uploading;
}

/** Account-wide visible time. Empty when the request fails. */
export async function loadPracticeTime(): Promise<PracticeStore> {
  try {
    await uploadLocalOnce();
    const res = await fetch('/api/backtest/practice', { credentials: 'same-origin', cache: 'no-store' });
    if (res.status === 401) {
      redirectToLogin();
      return {};
    }
    if (!res.ok) return {};
    const data = (await res.json()) as { practice?: unknown };
    return sanitizePracticeImport(data.practice);
  } catch {
    return {};
  }
}

export async function addPracticeTime(sessionId: string, ms: number): Promise<void> {
  await uploadLocalOnce();
  const res = await fetch('/api/backtest/practice', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, ms }),
  });
  if (res.status === 401) {
    redirectToLogin();
    return;
  }
  if (!res.ok) throw new Error('practice save failed');
}

/** Drops a not-yet-uploaded row so a deleted session is not copied to the account later. */
export function dropPracticeTime(sessionId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return;
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || !(sessionId in parsed)) return;
    const store = { ...(parsed as Record<string, unknown>) };
    delete store[sessionId];
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // The session row is already gone on the server.
  }
}

/** Counts visible time on the replay page and writes it to the account every few seconds. */
export function usePracticeClock(sessionId: string | null): void {
  useEffect(() => {
    if (!sessionId) return;
    let acc = 0;
    let last = document.visibilityState === 'visible' ? performance.now() : 0;
    let sending = false;
    const sample = () => {
      const now = performance.now();
      if (last > 0) {
        const dt = now - last;
        if (dt > 0 && dt < 60_000) acc += dt;
      }
      last = document.visibilityState === 'visible' ? now : 0;
    };
    const flush = (force: boolean) => {
      sample();
      if (sending || (acc < 1000 && !(force && acc > 0))) return;
      const ms = Math.min(60_000, Math.round(acc));
      acc = Math.max(0, acc - ms);
      sending = true;
      void addPracticeTime(sessionId, ms)
        .catch(() => {
          acc += ms;
        })
        .finally(() => {
          sending = false;
        });
    };
    const id = window.setInterval(() => flush(false), 5000);
    const onHide = () => flush(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      flush(true);
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [sessionId]);
}
