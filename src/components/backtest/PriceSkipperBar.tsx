'use client';

import { chordLabel } from '@/lib/app';
import { TIMEFRAMES } from '@/lib/core';
import { FREQUENCIES, TICKER_VALUES } from '@/lib/backtest';
import { Divider } from '../ui/Divider';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { Icon } from '../ui/Icon';
import { useBacktest } from './context';
import { utcDateTime } from './format';
import { useBacktestStore } from './store';

const selectCls =
  'h-8 rounded-md border border-line bg-panel px-1.5 text-[13px] text-fg hover:bg-hover';

/** FX Replay's Price Skipper: rewind, play/pause, next candle, ticker value and frequency. */
export function PriceSkipperBar() {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  const openModal = useBacktestStore((s) => s.openModal);
  const toggleProp = useBacktestStore((s) => s.toggleProp);
  const panelHidden = useBacktestStore((s) => s.panelHidden);
  const setPanelHidden = useBacktestStore((s) => s.setPanelHidden);
  if (!snap) return null;
  const ended = snap.status !== 'active';
  const atStart = snap.cursor <= snap.start;
  return (
    <div
      role="region"
      aria-label="Price Skipper"
      className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-t border-line bg-panel px-2 text-[13px]"
    >
      <IconButton
        icon="stepBack"
        label="Rewind one candle"
        shortcut={chordLabel('Alt+Z')}
        tooltipSide="top"
        disabled={atStart || snap.loading}
        onClick={() => void c.requestRewind()}
      />
      <IconButton
        icon={snap.playing ? 'pause' : 'play'}
        label={snap.playing ? 'Pause' : 'Play'}
        shortcut={chordLabel('Alt+1')}
        tooltipSide="top"
        disabled={ended}
        onClick={() => c.togglePlay()}
        data-testid="bt-play"
      />
      <IconButton
        icon="stepForward"
        label="Next candle"
        shortcut={chordLabel('Ctrl+Space')}
        tooltipSide="top"
        disabled={ended || snap.loading}
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
      <IconButton
        icon="calendar"
        label="Go to date & time"
        tooltipSide="top"
        disabled={ended || snap.loading}
        onClick={() => openModal({ type: 'go-to' })}
      />
      <Divider />
      <span className="whitespace-nowrap px-1 tabular-nums text-fg" data-testid="bt-cursor">
        {utcDateTime(snap.cursor)} UTC
      </span>
      <span
        className="whitespace-nowrap rounded bg-[#f7a60026] px-1.5 py-0.5 text-[12px] font-medium text-[#f7a600]"
        title="Days left in the session's date range"
      >
        {snap.daysLeft} {snap.daysLeft === 1 ? 'day' : 'days'} left
      </span>
      <div
        className="mx-2 hidden h-1.5 w-28 overflow-hidden rounded-full bg-line sm:block"
        aria-label={`Progress ${(snap.progress * 100).toFixed(0)}%`}
      >
        <div className="h-full bg-accent" style={{ width: `${snap.progress * 100}%` }} />
      </div>
      {snap.loading ? <span className="text-muted">Loading…</span> : null}
      {ended ? (
        <span className={snap.status === 'ended' ? 'text-muted' : 'text-down'}>
          {snap.status === 'ended' ? 'Session completed' : `Stopped · ${snap.failReason ?? ''}`}
        </span>
      ) : null}
      <div className="flex-1" />
      {panelHidden ? (
        <button
          type="button"
          aria-label="Show trading panel"
          data-testid="show-trading-panel"
          onClick={() => setPanelHidden(false)}
          className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md border border-line px-2 text-[13px] hover:bg-hover"
        >
          <Icon name="eye" size={14} />
          Panel
        </button>
      ) : null}
      {snap.prop ? (
        <button
          type="button"
          onClick={() => toggleProp()}
          className="h-8 whitespace-nowrap rounded-md border border-line px-2 text-[13px] hover:bg-hover"
          title="Prop Firm Rules (Tab)"
        >
          Prop Firm Rules
        </button>
      ) : null}
    </div>
  );
}
