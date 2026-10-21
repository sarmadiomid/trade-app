'use client';

import { useEffect } from 'react';
import { tehranDayKey } from '../home/overview';

const KEY = 'chartix-practice-ms';

export interface PracticeLog {
  readonly totalMs: number;
  readonly days: Readonly<Record<string, number>>;
}

export type PracticeStore = Readonly<Record<string, PracticeLog>>;

function empty(): PracticeLog {
  return { totalMs: 0, days: {} };
}

function isLog(v: unknown): v is PracticeLog {
  if (!v || typeof v !== 'object') return false;
  const o = v as { totalMs?: unknown; days?: unknown };
  if (typeof o.totalMs !== 'number' || !o.days || typeof o.days !== 'object') return false;
  return true;
}

/** Wall-clock time the replay page has been open, per session. Absent on the server. */
export function readPracticeStore(): PracticeStore {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, PracticeLog> = {};
    for (const [id, row] of Object.entries(parsed)) {
      if (!isLog(row)) continue;
      const days: Record<string, number> = {};
      for (const [day, ms] of Object.entries(row.days)) {
        if (typeof ms === 'number' && ms > 0) days[day] = ms;
      }
      out[id] = { totalMs: row.totalMs, days };
    }
    return out;
  } catch {
    return {};
  }
}

export function addPracticeTime(sessionId: string, ms: number, now = Date.now()): void {
  if (!(ms > 0) || typeof localStorage === 'undefined') return;
  const store: Record<string, PracticeLog> = { ...readPracticeStore() };
  const prev = store[sessionId] ?? empty();
  const day = tehranDayKey(now);
  store[sessionId] = {
    totalMs: prev.totalMs + ms,
    days: { ...prev.days, [day]: (prev.days[day] ?? 0) + ms },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // A full or blocked store just stops the chart from growing.
  }
}

export function dropPracticeTime(sessionId: string): void {
  if (typeof localStorage === 'undefined') return;
  const store: Record<string, PracticeLog> = { ...readPracticeStore() };
  if (!store[sessionId]) return;
  delete store[sessionId];
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Ignore quota errors; the session row is already gone.
  }
}

/** Counts visible time on the replay page and writes it every few seconds. */
export function usePracticeClock(sessionId: string | null): void {
  useEffect(() => {
    if (!sessionId) return;
    let acc = 0;
    let last = document.visibilityState === 'visible' ? performance.now() : 0;
    const sample = (force: boolean) => {
      const now = performance.now();
      // Count up to this instant first, including the moment the tab hides.
      if (last > 0) {
        const dt = now - last;
        if (dt > 0 && dt < 60_000) acc += dt;
      }
      last = document.visibilityState === 'visible' ? now : 0;
      if (acc >= 1000 || (force && acc > 0)) {
        addPracticeTime(sessionId, acc);
        acc = 0;
      }
    };
    const id = window.setInterval(() => sample(false), 5000);
    const onHide = () => sample(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      sample(true);
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [sessionId]);
}
