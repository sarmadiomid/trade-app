'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BattleView } from '@/lib/battles';
import { ApiError, api } from '../../platform/api';

const POLL_MS = 1000;

/**
 * The battle as the server sees it, polled about once a second, plus the server's clock
 * (`now()` corrects the local clock with the offset measured on every poll).
 */
export function useBattle(id: string) {
  const [view, setView] = useState<BattleView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const offset = useRef(0);
  const viewRef = useRef<BattleView | null>(null);

  const apply = useCallback((v: BattleView, sentAt: number) => {
    const rtt = Date.now() - sentAt;
    // The server built the view about half a round trip ago.
    offset.current = v.serverNow - (sentAt + rtt / 2);
    viewRef.current = v;
    setView(v);
    setError(null);
  }, []);

  const refetch = useCallback(async (): Promise<BattleView | null> => {
    const sentAt = Date.now();
    try {
      const v = await api<BattleView>(`/api/battles/${id}`);
      apply(v, sentAt);
      return v;
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError('Something went wrong', 0));
      return null;
    }
  }, [id, apply]);

  /** Runs a mutation returning the new view (join, leave, controls). */
  const run = useCallback(
    async (path: string, body: unknown = {}): Promise<BattleView> => {
      const sentAt = Date.now();
      const v = await api<BattleView>(`/api/battles/${id}/${path}`, { method: 'POST', body });
      apply(v, sentAt);
      return v;
    },
    [id, apply],
  );

  useEffect(() => {
    let stopped = false;
    let timer: number | null = null;
    let settledPolls = 0;
    const tick = async () => {
      const v = await refetch();
      if (stopped) return;
      // Completed battles get a few more polls until Elo / XP are recorded, then stop.
      const done = v && (v.status === 'completed' || v.status === 'cancelled');
      if (done) settledPolls += 1;
      const recorded = !v?.results || v.results.some((r) => r.xp > 0);
      if (!done || (!recorded && settledPolls < 10))
        timer = window.setTimeout(() => void tick(), done ? 1500 : POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [refetch]);

  const now = useCallback(() => Date.now() + offset.current, []);
  return { view, viewRef, error, refetch, run, now };
}

/** Re-renders every `ms` (timers). */
export function useTicker(ms = 250): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return t;
}
