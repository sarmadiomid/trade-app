'use client';

import { useEffect, useState } from 'react';
import { FREQUENCIES, TICKER_VALUES } from '@/lib/backtest';
import { TIMEFRAMES, type TimeframeId } from '@/lib/core';
import { useUiStore } from '../../state/ui-store';
import { Icon } from '../../ui/Icon';
import { TimeframeScrubber } from '../../chart/mobile/TimeframeScrubber';
import { useBacktest } from '../context';
import { MobileMoreSheet } from './MobileMoreSheet';
import { MobileTradeSheet } from './MobileTradeSheet';
import { useBacktestStore } from '../store';

/** Phone session bar: symbol, timeframe drag, play, buy/sell, and More. */
export function MobileBacktestBar() {
  const snap = useBacktestStore((s) => s.snap);
  const deck = useBacktestStore((s) => s.replayDeck);
  const setDeck = useBacktestStore((s) => s.setReplayDeck);
  const actionsEnabled = useBacktestStore((s) => s.actionsEnabled);
  const [trade, setTrade] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => () => setDeck(false), [setDeck]);

  if (!snap) return null;
  if (deck) return <ReplayDeck onClose={() => setDeck(false)} />;
  const ended = snap.status !== 'active';
  const blocked = ended || !actionsEnabled;

  return (
    <div dir="ltr" className="relative w-full bg-chart">
      <div className="flex min-h-[4.5rem] w-full items-center gap-1 border-t border-line px-3 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))]">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
          <span className="min-w-0 truncate text-[15px] font-bold tracking-tight text-fg">
            {snap.settings.symbol}
          </span>
          <TimeframeScrubber />
        </div>
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            data-testid="mobile-play"
            aria-label="Open replay controls"
            disabled={blocked}
            onClick={() => setDeck(true)}
            className="flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-full border-2 border-line bg-panel text-fg shadow-[0_0_0_4px_rgba(255,255,255,0.03)] active:scale-95 disabled:opacity-40"
          >
            <Icon
              name={snap.playing ? 'pause' : 'fastForward'}
              size={20}
              strokeWidth={1.2}
              className={snap.playing ? 'fill-current' : 'ml-0.5 fill-current'}
            />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-end gap-1.5">
          <TradeButton disabled={blocked} onClick={() => setTrade(true)} />
          <span className="h-7 w-px shrink-0 bg-line" />
          <button
            type="button"
            data-testid="mobile-more"
            aria-label="More"
            onClick={() => setMore(true)}
            className="flex h-10 w-8 shrink-0 items-center justify-center text-fg"
          >
            <Icon name="more" size={20} strokeWidth={2.6} className="rotate-90" />
          </button>
        </div>
      </div>
      {trade && !blocked ? <MobileTradeSheet onClose={() => setTrade(false)} /> : null}
      {more ? <MobileMoreSheet onClose={() => setMore(false)} /> : null}
    </div>
  );
}

/** Symbol, interval and Buy/Sell cards that float over the chart while the replay deck is open. */
export function MobileReplayTop() {
  const snap = useBacktestStore((s) => s.snap);
  const deck = useBacktestStore((s) => s.replayDeck);
  const actionsEnabled = useBacktestStore((s) => s.actionsEnabled);
  const [trade, setTrade] = useState(false);
  if (!snap || !deck) return null;
  const blocked = snap.status !== 'active' || !actionsEnabled;
  return (
    <div dir="ltr" className="flex items-start gap-2 pr-16">
      <div className="pointer-events-auto flex h-14 min-w-0 items-center rounded-xl border border-line bg-panel/90 px-3 shadow-md backdrop-blur">
        <span className="truncate text-[15px] font-bold tracking-tight text-fg">
          {snap.settings.symbol}
        </span>
      </div>
      <div className="pointer-events-auto flex h-14 w-[4.75rem] shrink-0 items-center justify-center rounded-xl border border-line bg-panel/90 shadow-md backdrop-blur">
        <TimeframeScrubber />
      </div>
      <div className="flex-1" />
      <div className="pointer-events-auto shrink-0 rounded-lg bg-panel/90 shadow-md backdrop-blur">
        <TradeButton disabled={blocked} onClick={() => setTrade(true)} />
      </div>
      {trade && !blocked ? (
        <div className="pointer-events-auto">
          <MobileTradeSheet onClose={() => setTrade(false)} />
        </div>
      ) : null}
    </div>
  );
}

function TradeButton({
  onClick,
  disabled = false,
}: {
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid="mobile-trade"
      aria-label="Buy or sell"
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-[5.75rem] shrink-0 flex-col overflow-hidden rounded-lg border border-line disabled:opacity-40"
    >
      <span className="flex flex-1 items-center justify-center gap-0.5 text-[10px] font-bold leading-none tracking-wide text-[#6b9bff]">
        <Icon name="chevronDown" size={11} strokeWidth={2.2} className="rotate-180" />
        BUY
      </span>
      <span className="mx-2 h-px bg-line" />
      <span className="flex flex-1 items-center justify-center gap-0.5 text-[10px] font-bold leading-none tracking-wide text-[#f07167]">
        <Icon name="chevronDown" size={11} strokeWidth={2.2} />
        SELL
      </span>
    </button>
  );
}

/** Replay controls: bar step wheel, play dial with step and go-to, and speed wheel. */
function ReplayDeck({ onClose }: { readonly onClose: () => void }) {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  const openModal = useBacktestStore((s) => s.openModal);
  const actionsEnabled = useBacktestStore((s) => s.actionsEnabled);
  const allowRewind = useBacktestStore((s) => s.allowRewind);
  const timeframe = useUiStore((s) => s.timeframe);
  const [sync, setSync] = useState(false);

  const step = snap?.tickerValue;
  useEffect(() => {
    if (sync && step !== timeframe && TICKER_VALUES.includes(timeframe))
      c.setTickerValue(timeframe);
  }, [sync, timeframe, step, c]);

  if (!snap) return null;
  const ended = snap.status !== 'active';
  const blocked = ended || !actionsEnabled;
  const atStart = snap.cursor <= snap.start;
  const status = ended ? 'ENDED' : snap.playing ? 'PLAYING' : 'PAUSED';

  return (
    <div
      dir="ltr"
      data-testid="mobile-replay-deck"
      className="relative w-full bg-chart pb-[env(safe-area-inset-bottom)]"
    >
      <button
        type="button"
        role="switch"
        aria-checked={sync}
        aria-label="Sync bar step with chart interval"
        onClick={() => setSync((v) => !v)}
        className="absolute bottom-full left-8 mb-2 flex h-6 items-center gap-1.5 rounded-full border border-line bg-panel/95 pl-1 pr-2 text-[9px] font-bold tracking-wider text-fg shadow-md"
      >
        <span
          className={`relative h-3.5 w-6 rounded-full transition-colors ${
            sync ? 'bg-accent' : 'bg-line'
          }`}
        >
          <span
            className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-fg transition-[left] ${
              sync ? 'left-3' : 'left-0.5'
            }`}
          />
        </span>
        SYNC
      </button>

      <div className="flex h-[8.5rem] items-end justify-between px-8">
        <Wheel
          label="Bar step"
          values={TICKER_VALUES}
          value={snap.tickerValue}
          format={(tf) => TIMEFRAMES[tf as TimeframeId].label}
          onChange={(tf) => {
            setSync(false);
            c.setTickerValue(tf as TimeframeId);
          }}
        />

        <div className="relative mb-1 flex h-32 w-32 shrink-0 items-center justify-center self-center rounded-full border border-line/70 bg-[radial-gradient(circle,rgba(41,98,255,0.10)_0%,rgba(255,255,255,0.02)_55%,transparent_72%)] shadow-[0_0_0_10px_rgba(255,255,255,0.015),0_0_0_11px_rgba(255,255,255,0.05)]">
          <button
            type="button"
            aria-label="Step back"
            disabled={!allowRewind || atStart || snap.loading || !actionsEnabled}
            onClick={() => void c.requestRewind()}
            className="absolute left-0.5 flex h-10 w-7 items-center justify-center text-muted active:text-fg disabled:opacity-30"
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <button
            type="button"
            data-testid="mobile-play"
            aria-label={snap.playing ? 'Pause' : 'Play'}
            disabled={blocked}
            onClick={() => c.togglePlay()}
            className="flex h-[3.75rem] w-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-full border-2 border-accent bg-chart text-accent shadow-[0_0_14px_rgba(41,98,255,0.45)] active:scale-95 disabled:opacity-40"
          >
            <Icon
              name={snap.playing ? 'pause' : 'fastForward'}
              size={18}
              strokeWidth={1.2}
              className="fill-current"
            />
            <span className="text-[8px] font-bold tracking-wider text-fg">{status}</span>
          </button>
          <button
            type="button"
            aria-label="Step forward"
            disabled={blocked || snap.loading}
            onClick={() => void c.next()}
            className="absolute right-0.5 flex h-10 w-7 items-center justify-center text-muted active:text-fg disabled:opacity-30"
          >
            <Icon name="chevronRight" size={18} />
          </button>
          <button
            type="button"
            disabled={blocked || snap.loading}
            onClick={() => openModal({ type: 'go-to' })}
            className="absolute bottom-1.5 px-2 py-0.5 text-[9px] font-semibold tracking-[0.2em] text-muted active:text-fg disabled:opacity-30"
          >
            GO TO
          </button>
        </div>

        <Wheel
          label="Playback speed"
          values={FREQUENCIES}
          value={snap.frequency}
          format={(f) => `${f}x`}
          onChange={(f) => c.setFrequency(Number(f))}
        />
      </div>

      <button
        type="button"
        aria-label="Close replay controls"
        onClick={onClose}
        className="absolute bottom-[max(6px,env(safe-area-inset-bottom))] right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-panel/60 text-muted active:text-fg"
      >
        <Icon name="chevronDown" size={15} />
      </button>
    </div>
  );
}

function Wheel<T extends string | number>({
  label,
  values,
  value,
  format,
  onChange,
}: {
  readonly label: string;
  readonly values: readonly T[];
  readonly value: T;
  readonly format: (v: T) => string;
  readonly onChange: (v: T) => void;
}) {
  const i = Math.max(0, values.indexOf(value));
  const prev = i > 0 ? values[i - 1] : undefined;
  const next = i < values.length - 1 ? values[i + 1] : undefined;
  return (
    <div
      role="group"
      aria-label={label}
      className="flex h-full w-12 shrink-0 flex-col items-center justify-between rounded-t-xl bg-panel/50 pt-1 pb-1.5"
    >
      <button
        type="button"
        aria-label={`Previous ${label.toLowerCase()}`}
        disabled={prev === undefined}
        onClick={() => prev !== undefined && onChange(prev)}
        className="flex h-6 w-full items-center justify-center text-muted disabled:opacity-30"
      >
        <Icon name="chevronDown" size={13} className="rotate-180" />
      </button>
      <button
        type="button"
        tabIndex={-1}
        disabled={prev === undefined}
        onClick={() => prev !== undefined && onChange(prev)}
        className="h-5 text-[12px] font-medium text-muted"
      >
        {prev !== undefined ? format(prev) : ''}
      </button>
      <div className="flex w-full items-center justify-between" aria-current="true">
        <span className="h-0.5 w-1.5 rounded-full bg-accent" />
        <span className="text-[15px] font-bold text-accent">{format(value)}</span>
        <span className="h-0.5 w-1.5 rounded-full bg-accent" />
      </div>
      <button
        type="button"
        tabIndex={-1}
        disabled={next === undefined}
        onClick={() => next !== undefined && onChange(next)}
        className="h-5 text-[12px] font-medium text-muted"
      >
        {next !== undefined ? format(next) : ''}
      </button>
      <button
        type="button"
        aria-label={`Next ${label.toLowerCase()}`}
        disabled={next === undefined}
        onClick={() => next !== undefined && onChange(next)}
        className="flex h-6 w-full items-center justify-center text-muted disabled:opacity-30"
      >
        <Icon name="chevronDown" size={13} />
      </button>
    </div>
  );
}
