'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChartApp, createPlaybackDependencies, type ChartAppOptions } from '@/lib/app';
import { MockMarketProvider } from '@/lib/data';
import type { TimeframeId } from '@/lib/core';
import { DemoBroker, type DemoAccount, type DemoView } from './demo-account';
import { ChartControls } from '../chart/ChartControls';
import { Legend } from '../chart/Legend';
import { ContextMenu } from '../drawing/ContextMenu';
import { DrawingToolbar } from '../drawing/DrawingToolbar';
import { FloatingToolbar } from '../drawing/FloatingToolbar';
import { TextEditorOverlay } from '../drawing/TextEditorOverlay';
import { DialogHost } from '../dialogs/DialogHost';
import { LoadingOverlay } from '../overlays/LoadingOverlay';
import { ReplayBar } from '../replay/ReplayBar';
import { AppContext } from '../state/app-context';
import { connectBridge } from '../state/bridge';
import { TopToolbar } from '../toolbar/TopToolbar';

const SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'NAS100'] as const;
const TIMEFRAMES: readonly TimeframeId[] = ['15m', '1h', '4h'];

function pickDemo(): { symbol: string; timeframe: TimeframeId } {
  const n = Math.floor(Math.random() * SYMBOLS.length);
  return {
    symbol: SYMBOLS[n]!,
    timeframe: TIMEFRAMES[n % TIMEFRAMES.length]!,
  };
}

function formatPx(symbol: string, n: number): string {
  const d = symbol === 'XAUUSD' ? 2 : symbol === 'NAS100' ? 1 : 5;
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function useDemo(account: DemoAccount): DemoView {
  return useSyncExternalStore(
    (onChange) => account.subscribe(onChange),
    () => account.snapshot,
    () => account.snapshot,
  );
}

function money(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function signedMoney(v: number): string {
  const n = Math.abs(v) < 0.005 ? 0 : v;
  const body = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}$${body}`;
}

function QuoteButtons({
  view,
  symbol,
  onBuy,
  onSell,
  testId,
}: {
  view: DemoView | null;
  symbol: string;
  onBuy: () => void;
  onSell: () => void;
  testId: string;
}) {
  const disabled = !view?.ready;
  const quote = (n: number | null | undefined) =>
    n === null || n === undefined ? '—' : formatPx(symbol, n);
  return (
    <div className="flex" dir="ltr">
      <button
        type="button"
        disabled={disabled}
        onClick={onSell}
        data-testid={`${testId}-sell`}
        className="flex flex-1 cursor-pointer flex-col items-start bg-down/15 px-3 py-2 text-down hover:bg-down/25 disabled:cursor-default disabled:opacity-40"
      >
        <span className="text-[11px] font-semibold">فروش</span>
        <span className="font-mono text-[13px] font-semibold tabular-nums">{quote(view?.bid)}</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onBuy}
        data-testid={`${testId}-buy`}
        className="flex flex-1 cursor-pointer flex-col items-end bg-accent/15 px-3 py-2 text-accent hover:bg-accent/25 disabled:cursor-default disabled:opacity-40"
      >
        <span className="text-[11px] font-semibold">خرید</span>
        <span className="font-mono text-[13px] font-semibold tabular-nums">{quote(view?.ask)}</span>
      </button>
    </div>
  );
}

function LotField({
  view,
  onChange,
  compact = false,
}: {
  view: DemoView;
  onChange: (volume: number) => void;
  compact?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 ${compact ? '' : 'justify-between px-3 py-2'}`}>
      {compact ? null : <span className="text-[11px] text-muted">حجم (لات)</span>}
      <input
        aria-label="حجم (لات)"
        dir="ltr"
        type="number"
        min={0}
        step={view.lotStep}
        value={view.volume}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 w-16 rounded border border-line bg-chart px-2 text-center font-mono tabular-nums text-fg outline-none focus:border-accent"
      />
    </label>
  );
}

function DemoTicket({ account, symbol }: { account: DemoAccount | null; symbol: string }) {
  if (!account) return <TicketShell view={null} symbol={symbol} />;
  return <LiveTicket account={account} symbol={symbol} />;
}

function LiveTicket({ account, symbol }: { account: DemoAccount; symbol: string }) {
  const view = useDemo(account);
  return (
    <TicketShell
      view={view}
      symbol={symbol}
      onBuy={() => account.market('buy')}
      onSell={() => account.market('sell')}
      onVolume={(v) => account.setVolume(v)}
      onClose={(id) => account.close(id)}
    />
  );
}

function TicketShell({
  view,
  symbol,
  onBuy,
  onSell,
  onVolume,
  onClose,
}: {
  view: DemoView | null;
  symbol: string;
  onBuy?: () => void;
  onSell?: () => void;
  onVolume?: (volume: number) => void;
  onClose?: (id: string) => void;
}) {
  const floating = view?.floating ?? 0;
  return (
    <aside
      className="hidden w-[214px] shrink-0 flex-col border-s border-line bg-panel text-[12px] text-fg lg:flex"
      dir="rtl"
    >
      <div className="border-b border-line px-3 py-2.5">
        <div className="text-[11px] text-muted">حساب تمرینی</div>
        <div className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums" dir="ltr">
          {view ? money(view.equity) : '$10,000.00'}
        </div>
        {view && view.positions.length > 0 ? (
          <div className={`text-[11px] ${floating >= 0 ? 'text-up' : 'text-down'}`}>
            <span className="font-mono tabular-nums" dir="ltr">
              {signedMoney(floating)}
            </span>{' '}
            باز
          </div>
        ) : null}
      </div>
      <div className="border-b border-line">
        <QuoteButtons
          view={view}
          symbol={symbol}
          testId="demo"
          onBuy={() => onBuy?.()}
          onSell={() => onSell?.()}
        />
      </div>
      {view && onVolume ? (
        <div className="border-b border-line">
          <LotField view={view} onChange={onVolume} />
        </div>
      ) : null}
      {view?.error ? (
        <p className="px-3 pb-2 text-[11px] leading-5 text-down">{view.error}</p>
      ) : null}
      {view && view.positions.length > 0 ? (
        <ul className="min-h-0 flex-1 overflow-y-auto border-t border-line">
          {view.positions.map((p) => (
            <li key={p.id} className="flex items-center gap-2 border-b border-line px-3 py-2">
              <span className={p.side === 'buy' ? 'text-accent' : 'text-down'}>
                {p.side === 'buy' ? 'خرید' : 'فروش'}
              </span>
              <span className="font-mono tabular-nums text-muted" dir="ltr">
                {p.volume}
              </span>
              <span
                className={`flex-1 text-end font-mono tabular-nums ${p.pnl >= 0 ? 'text-up' : 'text-down'}`}
                dir="ltr"
              >
                {signedMoney(p.pnl)}
              </span>
              <button
                type="button"
                aria-label="بستن پوزیشن"
                onClick={() => onClose?.(p.id)}
                className="cursor-pointer text-muted hover:text-fg"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex-1 px-3 py-3 text-[11.5px] leading-6 text-muted">
          خرید یا فروش، پوزیشن را روی همین نمودار باز می‌کند. برای بستن، × روی خط قیمت را بزنید.
        </p>
      )}
    </aside>
  );
}

/** Buy / sell for viewports where the side ticket is hidden. */
function DemoQuick({ account, symbol }: { account: DemoAccount; symbol: string }) {
  const view = useDemo(account);
  return (
    <div className="border-t border-line bg-panel px-2 py-1.5 lg:hidden">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 overflow-hidden rounded-md border border-line">
          <QuoteButtons
            view={view}
            symbol={symbol}
            testId="demo-quick"
            onBuy={() => account.market('buy')}
            onSell={() => account.market('sell')}
          />
        </div>
        <LotField view={view} compact onChange={(v) => account.setVolume(v)} />
      </div>
      {view.error ? (
        <p className="px-1 pt-1 text-[11px] leading-5 text-down">{view.error}</p>
      ) : null}
    </div>
  );
}

function ChartShell({
  symbol,
  timeframe,
  appRef,
}: {
  symbol: string;
  timeframe: TimeframeId;
  appRef: { current: ChartApp | null };
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [app, setApp] = useState<ChartApp | null>(null);
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [init] = useState<{
    symbol: string;
    timeframe: TimeframeId;
    appOptions: ChartAppOptions;
  }>(() => ({
    symbol,
    timeframe,
    appOptions: {
      persistDrawings: false,
      symbol,
      timeframe,
      initialBars: 160,
    },
  }));

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const instance = new ChartApp(
      el,
      createPlaybackDependencies(new MockMarketProvider()),
      init.appOptions,
    );
    const disconnect = connectBridge(instance);
    appRef.current = instance;
    let broker: DemoBroker | null = null;
    let cancelled = false;
    void instance
      .start()
      .then(async () => {
        if (cancelled) return;
        instance.replay.startSelecting();
        const n = instance.engine.sourceData.length;
        const at = Math.max(48, Math.min(n - 24, Math.floor(n * 0.68)));
        await instance.replay.selectBar(at);
        if (cancelled) return;
        broker = new DemoBroker(instance, init.symbol);
        instance.replay.setSpeed(1);
        instance.replay.play();
        if (cancelled) return;
        setAccount(broker.account);
        setApp(instance);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      broker?.destroy();
      appRef.current = null;
      disconnect();
      instance.destroy();
      setAccount(null);
      setApp(null);
    };
  }, [init, appRef]);

  return (
    <AppContext.Provider value={app}>
      <div dir="ltr" className="flex h-full min-h-0 w-full flex-col bg-chart text-fg">
        {app ? (
          <TopToolbar symbolLocked hideReplay={false} />
        ) : (
          <div className="h-10 shrink-0 border-b border-line bg-panel" />
        )}
        <div className="flex min-h-0 flex-1">
          {app ? (
            <DrawingToolbar />
          ) : (
            <div className="w-12 shrink-0 border-r border-line bg-panel" />
          )}
          <main className="relative min-w-0 flex-1" aria-label="نمودار تمرینی">
            <div ref={chartRef} className="absolute inset-0" />
            {app ? (
              <>
                <Legend />
                <ChartControls />
                <FloatingToolbar />
                <TextEditorOverlay />
              </>
            ) : null}
            <LoadingOverlay />
          </main>
          <DemoTicket account={account} symbol={init.symbol} />
        </div>
        {account ? <DemoQuick account={account} symbol={init.symbol} /> : null}
        {app ? <ReplayBar /> : <div className="h-11 shrink-0 border-t border-line bg-panel" />}
        {app ? (
          <>
            <DialogHost />
            <ContextMenu />
          </>
        ) : null}
      </div>
    </AppContext.Provider>
  );
}

/** Isolated, in-view chart of a historical replay — the same engine as the product. */
export function LandingChart() {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<ChartApp | null>(null);
  const autoPaused = useRef(false);
  const [visible, setVisible] = useState(false);
  const [demo] = useState(pickDemo);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) setVisible(true);
        const app = appRef.current;
        if (!app) return;
        if (entry.isIntersecting) {
          if (autoPaused.current && app.replay.state === 'paused') app.replay.play();
          autoPaused.current = false;
        } else if (app.replay.state === 'playing') {
          app.replay.pause();
          autoPaused.current = true;
        }
      },
      { rootMargin: '160px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={hostRef}
      className="relative h-[520px] overflow-hidden rounded-[22px] bg-[#131722] sm:h-[560px] lg:h-[620px]"
    >
      {visible ? (
        <ChartShell symbol={demo.symbol} timeframe={demo.timeframe} appRef={appRef} />
      ) : (
        <div className="flex h-full items-center justify-center text-[13px] text-[#787b86]">
          در حال آماده کردن نمودار…
        </div>
      )}
    </div>
  );
}
