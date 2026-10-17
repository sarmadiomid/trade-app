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
import { formatClock, marketCursor, remainingMs, type BattleView } from '@/lib/battles';
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
import { ordinal, pctClass, signedPct } from '../format';
import { BattleSidebar } from './BattleSidebar';
import { Results } from './Results';
import { StandingsList } from './StandingsList';
import { useTicker } from './useBattle';

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
    await c.resync(actions, v.me.startT, marketCursor(v.clock, now()));
  }, [refetch, runtime, now]);

  // Every action goes to the server in order; a rejection resyncs with the server's record.
  useEffect(() => {
    onActionRef.current = (logged) => {
      queueRef.current = queueRef.current.then(() =>
        api(`/api/battles/${view.id}/actions`, {
          method: 'POST',
          body: { t: logged.t, action: logged.a },
        }).catch(async (e: unknown) => {
          const msg = e instanceof Error ? e.message : 'The action was not accepted';
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
          setController(
            runtime.attach(app, marketCursor(v.clock, now()), (a) => onActionRef.current(a)),
          );
        } else {
          runtime.detach();
          setController(null);
        }
      },
    }),
    [runtime, viewRef, now],
  );

  // The battle clock drives the replay: reveal every candle up to the server's cursor.
  useEffect(() => {
    if (!controller) return;
    const id = window.setInterval(() => {
      const v = viewRef.current;
      if (!v) return;
      const cursor = marketCursor(v.clock, now());
      if (cursor > controller.cursor) void controller.follow(cursor);
      else if (v.status === 'completed' && !stoppedRef.current && !controller.ended) {
        stoppedRef.current = true;
        controller.stop();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [controller, viewRef, now]);

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
      if (op === 'leave') await run('leave');
      else await run('control', { op });
    } catch (e) {
      useUiStore.getState().pushToast(e instanceof Error ? e.message : 'Failed', 'error');
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
        label: `${o.label} ${lots(vol)} @ ${o.price.toFixed(p)}`,
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
        label: 'New order at this price…',
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
      className="ml-1 flex items-center gap-1 border-l border-line pl-1.5"
      data-testid="battle-hud"
    >
      <span
        className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 font-mono text-[14px] font-bold tabular-nums ${
          view.status === 'paused'
            ? 'bg-[#f5c451]/15 text-[#f5c451]'
            : lowTime
              ? 'animate-pulse bg-down/15 text-down'
              : 'bg-hover text-fg'
        }`}
        title="Time left"
        data-testid="battle-timer"
      >
        <Icon name={view.status === 'paused' ? 'pause' : 'clock'} size={14} />
        {view.status === 'countdown'
          ? formatClock(view.settings.durationMin * 60_000)
          : formatClock(remaining)}
      </span>
      {myStanding ? (
        <span className="hidden items-center gap-1.5 px-1.5 text-[12.5px] md:inline-flex">
          <span className="font-semibold">
            {ordinal(myPlace)}
            <span className="font-normal text-muted">/{view.standings.length}</span>
          </span>
          <span className={`font-semibold tabular-nums ${pctClass(myStanding.returnPct)}`}>
            {signedPct(myStanding.returnPct)}
          </span>
        </span>
      ) : null}
      <button
        type="button"
        onMouseDown={() => setShowBoard(true)}
        onMouseUp={() => setShowBoard(false)}
        onMouseLeave={() => setShowBoard(false)}
        onClick={() => setSidebarOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:bg-hover hover:text-fg"
        title="Leaderboard (hold Tab)"
      >
        <Icon name="trophy" size={15} />
        <span className="hidden xl:inline">Leaderboard</span>
      </button>
      {!out ? (
        <button
          type="button"
          onClick={() => setConfirm('leave')}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:bg-hover hover:text-down"
          title="Leave battle"
        >
          <Icon name="exit" size={15} />
          <span className="hidden xl:inline">Leave</span>
        </button>
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
          toolbarStart={
            <Link
              href="/battle"
              className="mr-1 inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] text-muted hover:bg-hover hover:text-fg"
              aria-label="Back to Battles"
            >
              <Icon name="chevronLeft" size={16} />
              <span className="hidden max-w-40 truncate sm:inline">{view.settings.name}</span>
            </Link>
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
                  {view.status === 'countdown'
                    ? formatClock(view.settings.durationMin * 60_000)
                    : formatClock(remaining)}
                </span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Leaderboard"
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-panel/95 px-2 text-[12px] font-semibold"
                >
                  <Icon name="trophy" size={13} />
                  {myStanding ? (
                    <span className={pctClass(myStanding.returnPct)}>
                      {ordinal(myPlace)} · {signedPct(myStanding.returnPct, 1)}
                    </span>
                  ) : null}
                </button>
              </div>
              {countdown !== null ? <CountdownOverlay seconds={countdown} view={view} /> : null}
              {view.status === 'paused' ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-chart/55 backdrop-blur-[2px]">
                  <div className="rounded-2xl border border-line bg-panel px-8 py-6 text-center shadow-xl">
                    <Icon name="pause" size={28} />
                    <p className="mt-2 text-[16px] font-semibold">Battle paused by the host</p>
                    <p className="mt-1 text-[13px] text-muted">
                      The timer and the market are stopped.
                    </p>
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
                      ? 'You left this battle. You can keep watching.'
                      : `Disqualified: ${myStanding?.reason ?? 'a rule was broken'}. You can keep watching.`}
                  </div>
                </div>
              ) : null}
              {showBoard ? (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center bg-chart/40 pt-16">
                  <div className="w-[420px] max-w-[92%] rounded-2xl border border-line bg-panel/95 p-3 shadow-2xl">
                    <div className="flex items-center justify-between px-1 pb-2">
                      <span className="text-[14px] font-semibold">Leaderboard</span>
                      <span className="font-mono text-[13px] text-muted">
                        {formatClock(remaining)}
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
            <Icon name="trophy" size={15} /> Results
          </button>
        ) : null}
        {confirm ? (
          <Dialog
            title={
              confirm === 'leave'
                ? 'Leave the battle?'
                : confirm === 'restart'
                  ? 'Restart the battle?'
                  : 'End the battle now?'
            }
            onClose={() => setConfirm(null)}
            width={420}
            footer={
              <>
                <div className="flex-1" />
                <Button onClick={() => setConfirm(null)}>Cancel</Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    const op = confirm;
                    setConfirm(null);
                    void control(op);
                  }}
                >
                  {confirm === 'leave' ? 'Leave' : confirm === 'restart' ? 'Restart' : 'End battle'}
                </Button>
              </>
            }
          >
            <p className="p-5 text-[13px] leading-6">
              {confirm === 'leave'
                ? view.status === 'countdown' && view.mode !== 'ranked'
                  ? 'You will leave the battle before it starts.'
                  : 'You forfeit: your open trades are closed and you rank below every trader still in the battle.'
                : confirm === 'restart'
                  ? 'Every account is reset and the countdown starts again on the same market.'
                  : 'Trading stops now and the current standings become the final results.'}
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
        <p className="text-[13px] font-semibold uppercase tracking-[0.25em] text-accent">
          Battle starts in
        </p>
        <p
          key={seconds}
          className="animate-pop mt-2 text-[96px] font-black leading-none tabular-nums"
        >
          {seconds}
        </p>
        <p className="mt-4 text-[15px] font-semibold">{view.symbol}</p>
        <p className="mt-1 text-[13px] text-muted">
          {view.standings.length} traders · {view.settings.durationMin} min ·{' '}
          {view.settings.winCondition === 'profit-target'
            ? `first to +${view.settings.profitTargetPct}%`
            : 'highest return wins'}
        </p>
      </div>
    </div>
  );
}
