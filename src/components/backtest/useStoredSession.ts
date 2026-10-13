'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserBacktestServices, type BacktestServices } from '@/lib/app';
import { accountConfig, type AccountConfig, type BacktestSession } from '@/lib/backtest';
import type { InstrumentSpec } from '@/lib/core';

export type StoredSession =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | {
      readonly status: 'ready';
      readonly session: BacktestSession;
      readonly cfg: AccountConfig;
      readonly spec: InstrumentSpec;
      readonly services: BacktestServices;
    };

/** Loads a session from the repository (journal and analytics pages). */
export function useStoredSession(id: string): {
  state: StoredSession;
  /** Applies a change and saves it. */
  update: (fn: (s: BacktestSession) => void) => Promise<void>;
} {
  const [state, setState] = useState<StoredSession>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    const services = browserBacktestServices();
    void services.repo.load(id).then((session) => {
      if (cancelled) return;
      if (!session) return setState({ status: 'missing' });
      const spec = services.spec(session.settings.symbol);
      setState({
        status: 'ready',
        session,
        spec,
        cfg: accountConfig(session.settings, spec),
        services,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  const update = useCallback(
    async (fn: (s: BacktestSession) => void) => {
      if (state.status !== 'ready') return;
      // Re-read so changes made in the session tab meanwhile are not overwritten.
      const fresh = (await state.services.repo.load(id)) ?? state.session;
      fn(fresh);
      await state.services.repo.save(fresh);
      setState({ ...state, session: fresh });
    },
    [state, id],
  );
  return { state, update };
}
