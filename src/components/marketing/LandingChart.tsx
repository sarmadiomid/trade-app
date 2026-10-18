'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChartApp,
  createPlaybackDependencies,
  type ChartAppOptions,
} from '@/lib/app';
import { MockMarketProvider, instrumentSpec } from '@/lib/data';
import type { TimeframeId } from '@/lib/core';
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

function lastClose(app: ChartApp): number | null {
  const d = app.engine.seriesData;
  return d.length > 0 ? d.close[d.length - 1]! : null;
}

function DemoTicket({ app, symbol }: { app: ChartApp | null; symbol: string }) {
  const [mid, setMid] = useState<number | null>(null);
  useEffect(() => {
    if (!app) return;
    const read = () => setMid(lastClose(app));
    read();
    const offReplay = app.replay.events.on('replay:changed', read);
    const offData = app.engine.events.on('data:changed', read);
    return () => {
      offReplay();
      offData();
    };
  }, [app]);

  const spread = instrumentSpec(symbol)?.defaultSpread ?? 0;
  const bid = mid !== null ? mid - spread / 2 : null;
  const ask = mid !== null ? mid + spread / 2 : null;

  return (
    <aside
      className="hidden w-[214px] shrink-0 flex-col border-s border-line bg-panel text-[12px] text-fg lg:flex"
      dir="rtl"
    >
      <div className="border-b border-line px-3 py-2.5">
        <div className="text-[11px] text-muted">حساب تمرینی</div>
        <div className="mt-0.5 text-[15px] font-semibold tabular-nums">۱۰٬۰۰۰ دلار</div>
      </div>
      <div className="flex border-b border-line">
        <div className="flex flex-1 flex-col items-start bg-down/15 px-3 py-2 text-down">
          <span className="text-[11px] font-semibold">فروش</span>
          <span className="font-mono text-[13px] font-semibold tabular-nums" dir="ltr">
            {bid === null ? '—' : formatPx(symbol, bid)}
          </span>
        </div>
        <div className="flex flex-1 flex-col items-end bg-accent/15 px-3 py-2 text-accent">
          <span className="text-[11px] font-semibold">خرید</span>
          <span className="font-mono text-[13px] font-semibold tabular-nums" dir="ltr">
            {ask === null ? '—' : formatPx(symbol, ask)}
          </span>
        </div>
      </div>
      <p className="flex-1 px-3 py-3 text-[11.5px] leading-6 text-muted">
        بازپخش روشن است. ابزار ترسیم را از نوار کناری بردارید، زوم کنید، یا پخش را نگه دارید.
        معامله روی حساب بعد از ورود ثبت می‌شود.
      </p>
    </aside>
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
        instance.replay.setSpeed(1);
        instance.replay.play();
        if (!cancelled) setApp(instance);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      appRef.current = null;
      disconnect();
      instance.destroy();
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
          <DemoTicket app={app} symbol={init.symbol} />
        </div>
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
