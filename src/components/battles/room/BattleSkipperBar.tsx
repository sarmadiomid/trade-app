'use client';

import { chordLabel } from '@/lib/app';
import { TIMEFRAMES } from '@/lib/core';
import { FREQUENCIES, TICKER_VALUES } from '@/lib/backtest';
import { useBacktest } from '../../backtest/context';
import { utcDateTime } from '../../backtest/format';
import { useBacktestStore } from '../../backtest/store';
import { Divider } from '../../ui/Divider';
import { IconButton } from '../../ui/IconButton';
import { Tooltip } from '../../ui/Tooltip';

const selectCls =
  'h-8 rounded-md border border-line bg-panel px-1.5 text-[13px] text-fg hover:bg-hover';

/** The battle's Price Skipper: play / pause, next candle, ticker value and frequency (no rewind). */
export function BattleSkipperBar({
  start,
  end,
  enabled,
}: {
  readonly start: number;
  readonly end: number;
  readonly enabled: boolean;
}) {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  if (!snap) return null;
  const done = snap.status !== 'active' || snap.cursor >= end;
  const blocked = !enabled || done;
  const progress = Math.max(0, Math.min(1, (snap.cursor - start) / Math.max(1, end - start)));
  const candlesLeft = Math.max(0, Math.round((end - snap.cursor) / 60_000));
  return (
    <div
      role="region"
      aria-label="Price Skipper"
      className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-t border-line bg-panel px-2 text-[13px]"
      data-testid="battle-skipper"
    >
      <IconButton
        icon={snap.playing ? 'pause' : 'play'}
        label={snap.playing ? 'Pause' : 'Play'}
        shortcut={chordLabel('Alt+1')}
        tooltipSide="top"
        disabled={blocked}
        onClick={() => c.togglePlay()}
        data-testid="bt-play"
      />
      <IconButton
        icon="stepForward"
        label="Next candle"
        shortcut={chordLabel('Ctrl+Space')}
        tooltipSide="top"
        disabled={blocked || snap.loading}
        onClick={() => void c.next()}
        data-testid="bt-next"
      />
      <Divider />
      <Tooltip
        label="Ticker value: candle size of each step"
        shortcut="Alt + 4 / Alt + 5"
        side="top"
      >
        <label className="flex items-center gap-1 pl-1 text-muted">
          <span className="hidden md:inline">Ticker</span>
          <select
            aria-label="Ticker value"
            data-testid="bt-ticker"
            className={selectCls}
            value={snap.tickerValue}
            onChange={(e) => c.setTickerValue(e.target.value as (typeof TICKER_VALUES)[number])}
          >
            {TICKER_VALUES.map((tf) => (
              <option key={tf} value={tf}>
                {TIMEFRAMES[tf].label}
              </option>
            ))}
          </select>
        </label>
      </Tooltip>
      <Tooltip
        label="Frequency: candles per second while playing"
        shortcut="Alt + 2 / Alt + 3"
        side="top"
      >
        <label className="flex items-center gap-1 pl-1 text-muted">
          <span className="hidden md:inline">Frequency</span>
          <select
            aria-label="Frequency"
            data-testid="bt-frequency"
            className={selectCls}
            value={snap.frequency}
            onChange={(e) => c.setFrequency(Number(e.target.value))}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}/s
              </option>
            ))}
          </select>
        </label>
      </Tooltip>
      <Divider />
      <span className="whitespace-nowrap px-1 tabular-nums text-fg" data-testid="bt-cursor">
        {utcDateTime(snap.cursor)} UTC
      </span>
      <span
        className="whitespace-nowrap rounded bg-[#f7a60026] px-1.5 py-0.5 text-[12px] font-medium text-[#f7a600]"
        title="1-minute candles left in the battle's market"
      >
        {candlesLeft} {candlesLeft === 1 ? 'candle' : 'candles'} left
      </span>
      <div
        className="mx-2 hidden h-1.5 w-28 overflow-hidden rounded-full bg-line sm:block"
        aria-label={`Progress ${(progress * 100).toFixed(0)}%`}
      >
        <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
      </div>
      {snap.loading ? <span className="text-muted">Loading…</span> : null}
      {snap.cursor >= end ? (
        <span className="text-muted">End of the battle&apos;s market</span>
      ) : null}
    </div>
  );
}
