'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { ChartApp } from '@/lib/app';
import { RemoteStorage, RemoteStorageError } from '@/lib/storage';
import { bindFavoritesStorage } from '../state/favorites-store';
import { useUiStore } from '../state/ui-store';
import { PlanSync } from '../billing/PlanUpgradeModal';
import { AccountMenu } from './AccountMenu';

const ChartWorkspace = dynamic(() => import('../chart/ChartWorkspace'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-chart" />,
});

const ENDPOINT = '/api/chart-records';
const LOGIN_URL = '/login?next=/chart';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly storage: RemoteStorage }
  | { readonly status: 'error' };

/**
 * The signed-in user's chart. Every chart record (drawings, templates, themes, settings,
 * favorites) lives in the user's database record; it is loaded before the chart mounts so
 * nothing ever starts from defaults and overwrites saved work.
 */
export function UserChart({ phone }: { phone: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const appRef = useRef<ChartApp | null>(null);

  useEffect(() => {
    let cancelled = false;
    let failures = 0;
    RemoteStorage.load(ENDPOINT, {
      onError: (e) => {
        if (e.status === 401) return window.location.replace(LOGIN_URL);
        if (failures++ % 5 === 0)
          useUiStore.getState().pushToast('Could not save your changes to the server', 'error');
      },
    })
      .then(async (storage) => {
        if (cancelled) return;
        await bindFavoritesStorage(storage);
        if (!cancelled) setState({ status: 'ready', storage });
      })
      .catch((e: unknown) => {
        if (e instanceof RemoteStorageError && e.status === 401)
          return window.location.replace(LOGIN_URL);
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
      void bindFavoritesStorage(null);
    };
  }, [attempt]);

  useEffect(() => {
    const flush = () => appRef.current?.flush();
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-chart">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-chart text-fg">
        <p className="text-sm text-muted">Could not load your chart from the server.</p>
        <button
          type="button"
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((a) => a + 1);
          }}
          className="h-8 rounded-md bg-accent px-4 text-[13px] font-medium text-accent-fg hover:brightness-110"
        >
          Retry
        </button>
      </div>
    );
  }
  const { storage } = state;
  return (
    <>
      <PlanSync />
      <ChartWorkspace
        wrapDeps={(deps) => ({ ...deps, storage })}
        onApp={(app) => {
          appRef.current = app;
        }}
        toolbarEnd={<AccountMenu phone={phone} storage={storage} />}
      />
    </>
  );
}
