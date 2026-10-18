'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BacktestRuntime, browserBacktestServices, type BacktestController } from '@/lib/app';
import { setDisplayUtc } from '@/lib/core';
import type { MenuEntry } from '../drawing/ContextMenu';
import { useUiStore } from '../state/ui-store';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { BacktestModals } from './BacktestModals';
import { BacktestContext } from './context';
import { lots } from './format';

const ORDER_FA: Readonly<Record<string, string>> = {
  'Buy Limit': 'خرید لیمیت',
  'Buy Stop': 'خرید استاپ',
  'Sell Limit': 'فروش لیمیت',
  'Sell Stop': 'فروش استاپ',
};
import { OrderTicket } from './OrderTicket';
import { PriceSkipperBar } from './PriceSkipperBar';
import { PropRulesPanel } from './PropRulesPanel';
import { QuickTradePanel } from './QuickTradePanel';
import { useBacktestStore } from './store';
import { TradingPanel } from './TradingPanel';

const ChartWorkspace = dynamic(() => import('../chart/ChartWorkspace'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-chart" />,
});

type Load =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly runtime: BacktestRuntime };

/** Connects the controller's events to the UI stores. */
function useBridge(c: BacktestController | null): void {
  const router = useRouter();
  useEffect(() => {
    if (!c) return;
    const store = useBacktestStore.getState();
    const toast = useUiStore.getState().pushToast;
    store.setSnap(c.snapshot());
    const offs = [
      c.events.on('snapshot', (s) => useBacktestStore.getState().setSnap(s)),
      c.events.on('notice', (n) => toast(n.text, n.level)),
      c.events.on('ended', () => {
        const id = c.session.id;
        void c.save().finally(() => router.push(`/backtest/${id}/analytics`));
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
    };
  }, [c, router]);
}

/** One opened backtest session: the chart with FX Replay's trading and replay UI. */
export default function BacktestSessionView({ id }: { readonly id: string }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [controller, setController] = useState<BacktestController | null>(null);
  const ticket = useBacktestStore((s) => s.ticket);

  useEffect(() => {
    setDisplayUtc(true);
    let cancelled = false;
    const services = browserBacktestServices();
    void services.repo.load(id).then((session) => {
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

  const chartMenuItems = ({ time, price }: { time: number; price: number }): MenuEntry[] => {
    const c = controller;
    if (!c || c.ended) return [];
    const vol = c.session.quickVolume > 0 ? c.session.quickVolume : c.cfg.lotMin;
    const p = c.spec.pricePrecision;
    const orders: MenuEntry[] = c.trading.rightClickOrders(price).map((o) => ({
      label: `${ORDER_FA[o.label] ?? o.label} ${lots(vol)} @ ${o.price.toFixed(p)}`,
      run: () => {
        c.trading.place({
          side: o.side,
          type: o.kind,
          price: o.price,
          volume: vol,
          sl: null,
          tp: null,
        });
      },
    }));
    const entries: MenuEntry[] = [
      ...orders,
      {
        label: 'سفارش تازه روی این قیمت…',
        icon: 'plus',
        run: () => {
          const o = c.trading.rightClickOrders(price)[0];
          if (o)
            useBacktestStore.getState().openTicket({ side: o.side, type: o.kind, price: o.price });
        },
      },
    ];
    if (time < c.cursor)
      entries.push({
        label: 'بازپخش تا این نقطه',
        icon: 'replay',
        run: () =>
          void c.replayToBar(time).then((check) => {
            if (!check.ok)
              useBacktestStore.getState().openModal({
                type: 'confirm-rewind',
                time: Math.min(c.cursor, time),
                check,
              });
          }),
      });
    return entries;
  };

  return (
    <BacktestContext.Provider value={controller}>
      <ChartWorkspace
        wrapDeps={callbacks.wrapDeps}
        onApp={callbacks.onApp}
        appOptions={callbacks.appOptions}
        hideReplay
        toolbarStart={
          <Link
            href="/backtest"
            className="mr-1 inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] text-muted hover:bg-hover hover:text-fg"
            aria-label="بازگشت به جلسه‌ها"
          >
            <Icon name="chevronLeft" size={16} />
            <span className="hidden sm:inline">جلسه‌ها</span>
          </Link>
        }
        toolbarEnd={controller ? <SessionMenu /> : null}
        overlay={
          controller ? (
            <>
              <QuickTradePanel />
              <PropRulesPanel />
            </>
          ) : null
        }
        sidePanel={controller && ticket ? <OrderTicket key={ticketKey(ticket)} /> : null}
        footer={
          controller ? (
            <div dir="rtl" className="flex shrink-0 flex-col">
              <PriceSkipperBar />
              <TradingPanel />
              <BacktestModals />
            </div>
          ) : null
        }
        chartMenuItems={chartMenuItems}
      />
    </BacktestContext.Provider>
  );
}

const ticketKey = (t: { side: string; type: string; price?: number }) =>
  `${t.side}:${t.type}:${t.price ?? ''}`;

function SessionMenu() {
  const snap = useBacktestStore((s) => s.snap);
  const openModal = useBacktestStore((s) => s.openModal);
  if (!snap) return null;
  return (
    <div className="ml-1 flex items-center gap-0.5 border-l border-line pl-1.5">
      <span
        className="hidden max-w-40 truncate px-1 text-[13px] font-semibold lg:inline"
        title={snap.settings.name}
      >
        {snap.settings.name}
      </span>
      {snap.settings.type === 'prop' ? (
        <span className="hidden rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent md:inline">
          پراپ
        </span>
      ) : null}
      <Link
        href={`/backtest/${snap.id}/journal`}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] hover:bg-hover"
        title="دفتر معاملات"
      >
        <Icon name="journal" size={16} />
        <span className="hidden xl:inline">دفتر</span>
      </Link>
      <Link
        href={`/backtest/${snap.id}/analytics`}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] hover:bg-hover"
        title="عملکرد"
        data-testid="open-analytics"
      >
        <Icon name="chart" size={16} />
        <span className="hidden xl:inline">عملکرد</span>
      </Link>
      <IconButton
        icon="info"
        label="تنظیمات جلسه"
        onClick={() => openModal({ type: 'settings' })}
      />
      <IconButton
        icon="keyboard"
        label="میانبرهای بک‌تست"
        shortcut="Ctrl + Alt + H"
        onClick={() => openModal({ type: 'shortcuts' })}
      />
    </div>
  );
}
