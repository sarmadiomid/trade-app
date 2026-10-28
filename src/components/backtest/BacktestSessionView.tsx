'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  BacktestRuntime,
  browserBacktestServices,
  isPlanLimitMessage,
  openPlanPrompt,
  type BacktestController,
} from '@/lib/app';
import { ensureCustomCatalog } from '@/lib/data';
import { setDisplayUtc } from '@/lib/core';
import { useUiStore } from '../state/ui-store';
import { statsHref } from '../home/stats-href';
import { BacktestContext } from './context';
import { usePracticeClock } from './practice-time';
import { SessionChart } from './SessionChart';
import { useBacktestStore } from './store';

type Load =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly runtime: BacktestRuntime };

/** Connects the controller's events to the UI stores. */
function useBridge(c: BacktestController | null): void {
  useEffect(() => {
    if (!c) return;
    const store = useBacktestStore.getState();
    const toast = useUiStore.getState().pushToast;
    store.setSnap(c.snapshot());
    const offs = [
      c.events.on('snapshot', (s) => useBacktestStore.getState().setSnap(s)),
      c.events.on('notice', (n) => {
        if (n.level === 'error' && isPlanLimitMessage(n.text)) openPlanPrompt(n.text);
        else toast(n.text, n.level);
      }),
      c.events.on('ended', () => {
        const id = c.session.id;
        void c.save().finally(() => {
          window.location.assign(statsHref(id));
        });
      }),
      c.events.on('command', (cmd) => {
        const s = useBacktestStore.getState();
        if (cmd.type === 'order-ticket')
          s.openTicket({ side: 'buy', type: cmd.orderType ?? 'market' });
        if (cmd.type === 'prop-rules') s.toggleProp();
        if (cmd.type === 'shortcuts') s.openModal({ type: 'shortcuts' });
        if (cmd.type === 'confirm-rewind')
          s.openModal({ type: 'confirm-rewind', time: cmd.time, check: cmd.check });
      }),
      // Hotkeys are off while a dialog is open.
      useBacktestStore.subscribe((s) => {
        c.inputBlocked = s.modal !== null;
      }),
    ];
    const flush = () => c.flush();
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      offs.forEach((off) => off());
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      const s = useBacktestStore.getState();
      s.setSnap(null);
      s.openTicket(null);
      s.openModal(null);
      s.toggleProp(false);
      s.setPanelHidden(false);
      s.setActionsEnabled(true);
      s.setAllowRewind(true);
      s.setSessionLinks(true);
    };
  }, [c]);
}

/** One opened backtest session: the chart with FX Replay's trading and replay UI. */
export default function BacktestSessionView({ id }: { readonly id: string }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [controller, setController] = useState<BacktestController | null>(null);

  useEffect(() => {
    setDisplayUtc(true);
    const ui = useBacktestStore.getState();
    ui.setActionsEnabled(true);
    ui.setAllowRewind(true);
    ui.setSessionLinks(true);
    let cancelled = false;
    const services = browserBacktestServices();
    void ensureCustomCatalog().then(() => services.repo.load(id)).then((session) => {
      if (cancelled) return;
      setLoad(
        session
          ? { status: 'ready', runtime: new BacktestRuntime(session, services) }
          : { status: 'missing' },
      );
    });
    return () => {
      cancelled = true;
      setDisplayUtc(false);
    };
  }, [id]);

  useBridge(controller);
  usePracticeClock(load.status === 'ready' ? id : null);

  const runtime = load.status === 'ready' ? load.runtime : null;
  const callbacks = useMemo(
    () =>
      runtime
        ? {
            wrapDeps: runtime.wrapDeps.bind(runtime),
            onApp: (app: Parameters<BacktestRuntime['attach']>[0] | null) => {
              if (app) setController(runtime.attach(app));
              else {
                runtime.detach();
                setController(null);
              }
            },
            appOptions: runtime.appOptions(),
          }
        : null,
    [runtime],
  );

  if (load.status === 'loading') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-chart">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }
  if (load.status === 'missing' || !callbacks) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-chart text-fg">
        <p className="text-muted">این جلسه وجود ندارد. شاید حذف شده باشد.</p>
        <Link href="/backtest" className="text-accent hover:underline">
          بازگشت به جلسه‌ها
        </Link>
      </div>
    );
  }

  return (
    <BacktestContext.Provider value={controller}>
      <SessionChart
        wrapDeps={callbacks.wrapDeps}
        onApp={callbacks.onApp}
        appOptions={callbacks.appOptions}
        controller={controller}
      />
    </BacktestContext.Provider>
  );
}
