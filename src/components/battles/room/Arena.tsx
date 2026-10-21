'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  BattleRuntime,
  browserBacktestServices,
  type BacktestController,
  type ChartApp,
} from '@/lib/app';
import type { LoggedAction } from '@/lib/backtest';
import { faNum } from '@/lib/locale/jalali';
import { formatClock, remainingMs, type BattleView } from '@/lib/battles';
import { setDisplayUtc } from '@/lib/core';
import { BacktestModals } from '../../backtest/BacktestModals';
import { BacktestContext } from '../../backtest/context';
import { lots } from '../../backtest/format';
import { OrderTicket } from '../../backtest/OrderTicket';
import { QuickTradePanel } from '../../backtest/QuickTradePanel';
import { useBacktestStore } from '../../backtest/store';
import { TradingPanel } from '../../backtest/TradingPanel';
import type { MenuEntry } from '../../drawing/ContextMenu';
import { ApiError, api } from '../../platform/api';
import { useUiStore } from '../../state/ui-store';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { Tooltip } from '../../ui/Tooltip';
import { battleTitle, clockFa, faMessage, faReason, minutes, pctClass, signedPct, traders } from '../format';
import { BattleSidebar } from './BattleSidebar';
import { BattleSkipperBar } from './BattleSkipperBar';
import { Results } from './Results';
import { StandingsList } from './StandingsList';
import { useTicker } from './useBattle';

/** How often the trader's replay position is reported to the server while it moves. */
const CURSOR_REPORT_MS = 1000;

const ORDER_FA: Readonly<Record<string, string>> = {
  'Buy Limit': 'خرید لیمیت',
  'Buy Stop': 'خرید استاپ',
  'Sell Limit': 'فروش لیمیت',
  'Sell Stop': 'فروش استاپ',
};

const ChartWorkspace = dynamic(() => import('../../chart/ChartWorkspace'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-chart" />,
});

interface ArenaProps {
  readonly view: BattleView;
  readonly viewRef: RefObject<BattleView | null>;
  readonly meId: string;
  readonly now: () => number;
  readonly refetch: () => Promise<BattleView | null>;
  readonly run: (path: string, body?: unknown) => Promise<BattleView>;
}

/**
 * The battle while it runs: the trader's chart (only candles up to the battle cursor), FX
 * Replay's trading panels, the battle HUD and sidebar. Remounted when the host restarts.
 */
export function Arena(props: ArenaProps) {
  const me = props.view.me!;
  return <ArenaSeat key={`${me.startT}:${props.view.countdownEndsAt}`} {...props} />;
}

function ArenaSeat({ view, viewRef, meId, now, refetch, run }: ArenaProps) {
  const me = view.me!;
  const [runtime] = useState(
    () =>
      new BattleRuntime(
        {
          battleId: view.id,
          settings: view.settings,
          symbol: view.symbol!,
          marketStart: view.clock.marketStart,
          startT: me.startT,
          startBid: me.startBid,
          actions: me.actions as LoggedAction[],
        },
        browserBacktestServices(),
      ),
  );
  const [controller, setController] = useState<BacktestController | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [confirm, setConfirm] = useState<null | 'leave' | 'restart' | 'end'>(null);
  const [resultsClosed, setResultsClosed] = useState(false);
  const ticket = useBacktestStore((s) => s.ticket);
  const stoppedRef = useRef(false);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const reportedRef = useRef(view.cursor);
  const onActionRef = useRef<(a: LoggedAction) => void>(() => {});
  useTicker(250);

  useEffect(() => {
    setDisplayUtc(true);
    return () => setDisplayUtc(false);
  }, []);

  /** Rebuilds the account from the server's record of the actions. */
  const resync = useCallback(async () => {
    const v = await refetch();
    const c = runtime.controller;
    if (!v?.me || !c) return;
    const actions = v.me.actions.map((x) => ({ t: x.t, a: x.a })) as LoggedAction[];
    await c.resync(actions, v.me.startT, Math.max(v.cursor, c.cursor));
  }, [refetch, runtime]);

  /** Sends the replay position to the server (queued behind the actions, in order). */
  const reportCursor = useCallback(() => {
    const c = runtime.controller;
    if (!c || c.cursor <= reportedRef.current) return queueRef.current;
    const t = c.cursor;
    reportedRef.current = t;
    queueRef.current = queueRef.current.then(() =>
      api(`/api/battles/${view.id}/cursor`, { method: 'POST', body: { t } }).catch(() => {}),
    );
    return queueRef.current;
  }, [runtime, view.id]);

  // Every action goes to the server in order; a rejection resyncs with the server's record.
  useEffect(() => {
    onActionRef.current = (logged) => {
      reportedRef.current = Math.max(reportedRef.current, logged.t);
      queueRef.current = queueRef.current.then(() =>
        api(`/api/battles/${view.id}/actions`, {
          method: 'POST',
          body: { t: logged.t, action: logged.a },
        }).catch(async (e: unknown) => {
          const msg = faMessage(e instanceof Error ? e.message : 'The action was not accepted');
          useUiStore.getState().pushToast(msg, 'error');
          if (e instanceof ApiError && (e.status === 409 || e.status === 422)) await resync();
        }),
      );
    };
  }, [view.id, resync]);

  const callbacks = useMemo(
    () => ({
      wrapDeps: runtime.wrapDeps.bind(runtime),
      appOptions: runtime.appOptions(),
      onApp: (app: ChartApp | null) => {
        if (app) {
          const v = viewRef.current!;
          setController(runtime.attach(app, v.cursor, (a) => onActionRef.current(a)));
        } else {
          runtime.detach();
          setController(null);
        }
      },
    }),
    [runtime, viewRef],
  );

  // The trader steps the replay; the server hears where they are, and the replay stops while
  // the battle is not running.
  useEffect(() => {
    if (!controller) return;
    const id = window.setInterval(() => {
      const v = viewRef.current;
      if (!v) return;
      if (v.status !== 'live' || v.me?.status === 'left') controller.pause();
      if (v.status === 'completed' && !stoppedRef.current && !controller.ended) {
        stoppedRef.current = true;
        controller.stop();
      }
    }, 200);
    const report = window.setInterval(() => {
      const v = viewRef.current;
      if (v?.status === 'live' && v.me?.status !== 'left') void reportCursor();
    }, CURSOR_REPORT_MS);
    return () => {
      window.clearInterval(id);
      window.clearInterval(report);
      void reportCursor();
    };
  }, [controller, viewRef, reportCursor]);

  // Snapshot / notice bridge (as in a backtest session, without leaving for analytics).
  useEffect(() => {
    const c = controller;
    if (!c) return;
    const store = useBacktestStore.getState();
    const toast = useUiStore.getState().pushToast;
    store.setSnap(c.snapshot());
    const offs = [
      c.events.on('snapshot', (s) => useBacktestStore.getState().setSnap(s)),
      c.events.on('notice', (n) => {
        // The battle's own end is announced by the results screen.
        if (!/session end/i.test(n.text)) toast(n.text, n.level);
      }),
      c.events.on('command', (cmd) => {
        const s = useBacktestStore.getState();
        if (cmd.type === 'order-ticket')
          s.openTicket({ side: 'buy', type: cmd.orderType ?? 'market' });
        if (cmd.type === 'shortcuts') s.openModal({ type: 'shortcuts' });
      }),
    ];
    return () => {
      offs.forEach((off) => off());
      const s = useBacktestStore.getState();
      s.setSnap(null);
      s.openTicket(null);
      s.openModal(null);
      s.setPanelHidden(false);
    };
  }, [controller]);

  // Hold Tab: the leaderboard over the chart.
  useEffect(() => {
    const typing = () => {
      const el = document.activeElement;
      return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        !!el?.closest('[role="dialog"]')
      );
    };
    const down = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || typing()) return;
      e.preventDefault();
      e.stopPropagation();
      setShowBoard(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Tab') setShowBoard(false);
    };
    const blur = () => setShowBoard(false);
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const control = async (op: 'pause' | 'resume' | 'restart' | 'end' | 'leave') => {
    try {
      if (op === 'leave') {
        await reportCursor();
        await run('leave');
      } else await run('control', { op });
    } catch (e) {
      useUiStore.getState().pushToast(
        faMessage(e instanceof Error ? e.message : 'Failed'),
        'error',
      );
    }
  };

  const t = now();
  const live = view.status === 'live';
  const myStanding = view.standings.find((s) => s.userId === meId);
  const myPlace = view.standings.findIndex((s) => s.userId === meId) + 1;
  const out = me.status === 'disqualified' || me.status === 'left';
  const canTrade = live && !out;
  const remaining = remainingMs(view.clock, t);
  const countdown =
    view.status === 'countdown' && view.countdownEndsAt !== null
      ? Math.max(0, Math.ceil((view.countdownEndsAt - t) / 1000))
      : null;
  const lowTime = live && remaining < 30_000;

  // Hotkeys only trade while the battle is live and the trader is still in it.
  useEffect(() => {
    if (!controller) return;
    const sync = () => {
      controller.setInputBlocked(!canTrade || useBacktestStore.getState().modal !== null);
    };
    sync();
    return useBacktestStore.subscribe(sync);
  }, [controller, canTrade]);

  const chartMenuItems = ({ price }: { time: number; price: number }): MenuEntry[] => {
    const c = controller;
    if (!c || c.ended || !canTrade) return [];
    const vol = c.session.quickVolume > 0 ? c.session.quickVolume : c.cfg.lotMin;
    const p = c.spec.pricePrecision;
    return [
      ...c.trading.rightClickOrders(price).map<MenuEntry>((o) => ({
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
      })),
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
  };

  const hud = (
    <div
      className="ms-1 flex shrink-0 items-center gap-1.5 border-l border-line pl-2"
      data-testid="battle-hud"
    >
      <span
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-mono text-[13.5px] font-bold tabular-nums ring-1 ring-inset transition-colors ${
          view.status === 'paused'
            ? 'bg-[#f5c451]/15 text-[#f5c451] ring-[#f5c451]/35'
            : lowTime
              ? 'animate-pulse bg-down/15 text-down ring-down/40'
              : 'bg-chart/75 text-fg ring-line/80'
        }`}
        title="زمان باقی‌مانده"
        data-testid="battle-timer"
      >
        <Icon name={view.status === 'paused' ? 'pause' : 'clock'} size={14} />
        {clockFa(
          view.status === 'countdown'
            ? formatClock(view.settings.durationMin * 60_000)
            : formatClock(remaining),
        )}
      </span>

      {myStanding ? (
        <div className="hidden h-8 items-center gap-2 rounded-lg bg-chart/65 px-2.5 text-[12.5px] ring-1 ring-inset ring-line/80 md:inline-flex">
          <span className="flex items-center gap-1 font-bold text-fg">
            {myPlace === 1 ? <Icon name="crown" size={13} className="text-amber-400" /> : null}
            <span>
              {faNum(myPlace)}
              <span className="font-normal text-muted">/{faNum(view.standings.length)}</span>
            </span>
          </span>
          <span className="h-3.5 w-px bg-line/80" />
          <span className={`font-mono font-bold tabular-nums ${pctClass(myStanding.returnPct)}`}>
            {signedPct(myStanding.returnPct)}
          </span>
        </div>
      ) : null}

      <Tooltip label="جدول رده‌بندی" shortcut="Tab">
        <button
          type="button"
          onMouseDown={() => setShowBoard(true)}
          onMouseUp={() => setShowBoard(false)}
          onMouseLeave={() => setShowBoard(false)}
          onClick={() => setSidebarOpen((o) => !o)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors ${
            sidebarOpen || showBoard
              ? 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/30'
              : 'text-muted hover:bg-hover hover:text-fg'
          }`}
        >
          <Icon name="trophy" size={15} />
          <span className="hidden xl:inline">جدول</span>
        </button>
      </Tooltip>

      {!out ? (
        <Tooltip label="ترک نبرد">
          <button
            type="button"
            onClick={() => setConfirm('leave')}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium text-muted transition-colors hover:bg-down/15 hover:text-down"
          >
            <Icon name="exit" size={15} />
            <span className="hidden 2xl:inline">خروج</span>
          </button>
        </Tooltip>
      ) : null}
    </div>
  );

  const finished = view.status === 'completed';

  return (
    <BacktestContext.Provider value={controller}>
      <div className="relative h-full">
        <ChartWorkspace
          wrapDeps={callbacks.wrapDeps}
          onApp={callbacks.onApp}
          appOptions={callbacks.appOptions}
          hideReplay
          locale="fa"
          toolbarStart={
            <div className="flex shrink-0 items-center gap-1">
              <Tooltip label="بازگشت به نبردها">
                <Link
                  href="/battle"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg"
                  aria-label="بازگشت به نبردها"
                >
                  <Icon name="chevronLeft" size={17} />
                </Link>
              </Tooltip>
              <div className="hidden h-8 items-center gap-1.5 rounded-lg bg-chart/60 px-2.5 text-[12.5px] ring-1 ring-inset ring-line/75 sm:inline-flex">
                <Icon name="swords" size={14} className="shrink-0 text-accent" />
                <span className="max-w-36 truncate font-semibold text-fg">
                  {battleTitle(view.settings.name)}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    view.mode === 'ranked'
                      ? 'bg-amber-400/15 text-amber-400'
                      : 'bg-accent/15 text-accent'
                  }`}
                >
                  {view.mode === 'ranked' ? 'رتبه‌ای' : 'آزاد'}
                </span>
              </div>
            </div>
          }
          toolbarEnd={hud}
          overlay={
            <>
              {controller && canTrade ? <QuickTradePanel /> : null}
              <div
                className="absolute left-2 top-[84px] z-10 flex items-center gap-1 md:hidden"
                data-testid="battle-hud-mobile"
              >
                <span
                  className={`inline-flex h-8 items-center gap-1 rounded-md border border-line bg-panel/95 px-2 font-mono text-[13px] font-bold tabular-nums ${
                    lowTime ? 'text-down' : view.status === 'paused' ? 'text-[#f5c451]' : 'text-fg'
                  }`}
                >
                  <Icon name={view.status === 'paused' ? 'pause' : 'clock'} size={13} />
                  {clockFa(
                    view.status === 'countdown'
                      ? formatClock(view.settings.durationMin * 60_000)
                      : formatClock(remaining),
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="جدول"
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-panel/95 px-2 text-[12px] font-semibold"
                >
                  <Icon name="trophy" size={13} />
                  {myStanding ? (
                    <span className={pctClass(myStanding.returnPct)}>
                      {faNum(myPlace)} · {signedPct(myStanding.returnPct, 1)}
                    </span>
                  ) : null}
                </button>
              </div>
              {countdown !== null ? <CountdownOverlay seconds={countdown} view={view} /> : null}
              {view.status === 'paused' ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-chart/55 backdrop-blur-[2px]">
                  <div className="rounded-2xl border border-line bg-panel px-8 py-6 text-center shadow-xl">
                    <Icon name="pause" size={28} />
                    <p className="mt-2 text-[16px] font-semibold">میزبان نبرد را متوقف کرده</p>
                    <p className="mt-1 text-[13px] text-muted">زمان و بازار ایستاده‌اند.</p>
                  </div>
                </div>
              ) : null}
              {out && !finished ? (
                <div className="absolute inset-x-0 top-0 z-20 flex justify-center p-3">
                  <div
                    className="rounded-lg border border-down/50 bg-down/15 px-4 py-2 text-[13px] text-down shadow-md"
                    data-testid="out-banner"
                  >
                    {me.status === 'left'
                      ? 'از نبرد خارج شدی. می‌توانی تماشا کنی.'
                      : `حذف شدی: ${faReason(myStanding?.reason ?? 'a rule was broken')}. می‌توانی تماشا کنی.`}
                  </div>
                </div>
              ) : null}
              {showBoard ? (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center bg-chart/40 pt-16">
                  <div className="w-[420px] max-w-[92%] rounded-2xl border border-line bg-panel/95 p-3 shadow-2xl">
                    <div className="flex items-center justify-between px-1 pb-2">
                      <span className="text-[14px] font-semibold">جدول</span>
                      <span className="font-mono text-[13px] text-muted" dir="ltr">
                        {clockFa(formatClock(remaining))}
                      </span>
                    </div>
                    <StandingsList
                      standings={view.standings}
                      meId={meId}
                      showElo={view.mode === 'ranked'}
                    />
                  </div>
                </div>
              ) : null}
            </>
          }
          sidePanel={
            controller && ticket && canTrade ? (
              <OrderTicket key={`${ticket.side}:${ticket.type}:${ticket.price ?? ''}`} />
            ) : (
              <BattleSidebar
                view={view}
                meId={meId}
                refetch={() => void refetch()}
                onControl={(op) =>
                  op === 'restart' || op === 'end' ? setConfirm(op) : void control(op)
                }
                onClose={() => setSidebarOpen(false)}
                className={
                  sidebarOpen
                    ? 'fixed inset-y-0 right-0 z-40 flex shadow-2xl lg:static lg:shadow-none'
                    : 'hidden lg:flex'
                }
              />
            )
          }
          footer={
            controller ? (
              <>
                <BattleSkipperBar start={me.startT} end={runtime.end} enabled={canTrade} />
                <TradingPanel />
                <BacktestModals />
              </>
            ) : null
          }
          chartMenuItems={chartMenuItems}
        />
        {finished && !resultsClosed ? (
          <div className="absolute inset-0 z-50 overflow-y-auto bg-chart/85 backdrop-blur-sm">
            <Results view={view} meId={meId} onClose={() => setResultsClosed(true)} />
          </div>
        ) : null}
        {finished && resultsClosed ? (
          <button
            type="button"
            onClick={() => setResultsClosed(false)}
            className="absolute bottom-20 right-4 z-40 inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-fg shadow-lg"
          >
            <Icon name="trophy" size={15} /> نتیجه
          </button>
        ) : null}
        {confirm ? (
          <Dialog
            title={
              confirm === 'leave'
                ? 'نبرد را ترک می‌کنی؟'
                : confirm === 'restart'
                  ? 'نبرد از نو شروع شود؟'
                  : 'نبرد همین حالا تمام شود؟'
            }
            onClose={() => setConfirm(null)}
            width={420}
            footer={
              <>
                <div className="flex-1" />
                <Button onClick={() => setConfirm(null)}>لغو</Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    const op = confirm;
                    setConfirm(null);
                    void control(op);
                  }}
                >
                  {confirm === 'leave' ? 'خروج' : confirm === 'restart' ? 'شروع دوباره' : 'پایان نبرد'}
                </Button>
              </>
            }
          >
            <p className="p-5 text-[13px] leading-6">
              {confirm === 'leave'
                ? view.status === 'countdown' && view.mode !== 'ranked'
                  ? 'قبل از شروع از نبرد خارج می‌شوی.'
                  : 'انصراف می‌دهی: معاملات بازت بسته می‌شود و از همه کسانی که هنوز در نبردند پایین‌تر می‌ایستی.'
                : confirm === 'restart'
                  ? 'حساب همه صفر می‌شود و شمارش، روی همین بازار، از نو شروع می‌شود.'
                  : 'معامله همین حالا می‌ایستد و رتبه‌بندی فعلی، نتیجه نهایی می‌شود.'}
            </p>
          </Dialog>
        ) : null}
      </div>
    </BacktestContext.Provider>
  );
}

function CountdownOverlay({
  seconds,
  view,
}: {
  readonly seconds: number;
  readonly view: BattleView;
}) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-chart/70 backdrop-blur-sm"
      data-testid="countdown"
    >
      <div className="text-center">
        <p className="text-[13px] font-semibold text-accent">شروع نبرد</p>
        <p
          key={seconds}
          className="animate-pop mt-2 text-[96px] font-black leading-none tabular-nums"
        >
          {faNum(seconds)}
        </p>
        <p className="mt-4 text-[15px] font-semibold">
          <bdi dir="ltr">{view.symbol}</bdi>
        </p>
        <p className="mt-1 text-[13px] text-muted">
          {traders(view.standings.length)} · {minutes(view.settings.durationMin)} ·{' '}
          {view.settings.winCondition === 'profit-target'
            ? `اولین رسیدن به +${faNum(view.settings.profitTargetPct ?? 0)}٪`
            : 'بیشترین بازده برنده است'}
        </p>
      </div>
    </div>
  );
}
