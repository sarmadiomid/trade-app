'use client';

import { useState } from 'react';
import type { ScalperSettings } from '@/lib/backtest';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { useBacktest } from './context';
import { useBacktestStore } from './store';

/**
 * FX Replay's Quick Buy/Sell panel on the chart: SELL at Bid · quantity · BUY at Ask, plus the
 * Scalper Mode presets and the full order ticket.
 */
export function QuickTradePanel() {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  const openTicket = useBacktestStore((s) => s.openTicket);
  const [scalperOpen, setScalperOpen] = useState(false);
  if (!snap) return null;
  const precision = c.spec.pricePrecision;
  const disabled = snap.status !== 'active';
  return (
    <div className="absolute left-2 top-8 z-10 flex flex-col gap-1" data-testid="quick-panel">
      <div className="flex items-stretch overflow-hidden rounded-md border border-line bg-panel/95 text-[12px] shadow-md">
        <button
          type="button"
          disabled={disabled}
          onClick={() => c.trading.quick('sell')}
          className="flex w-[86px] flex-col items-start bg-down/15 px-2 py-1 text-down hover:bg-down/25 disabled:opacity-40"
          data-testid="quick-sell"
        >
          <span className="text-[10px] font-semibold uppercase">Sell</span>
          <span className="tabular-nums text-[13px] font-semibold">
            {snap.bid.toFixed(precision)}
          </span>
        </button>
        <div className="flex flex-col items-center justify-center border-x border-line px-1">
          <input
            aria-label="Quantity (lots)"
            data-testid="quick-qty"
            type="number"
            min={0}
            step={c.spec.lotStep}
            value={snap.quickVolume}
            onChange={(e) => c.setQuickVolume(Number(e.target.value))}
            className="h-6 w-16 rounded bg-transparent text-center tabular-nums text-fg outline-none focus:bg-hover"
          />
          <span className="text-[10px] text-muted">
            {snap.spread > 0 ? `spread ${(snap.spread / c.spec.pipSize).toFixed(1)}` : 'lots'}
          </span>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => c.trading.quick('buy')}
          className="flex w-[86px] flex-col items-end bg-accent/15 px-2 py-1 text-accent hover:bg-accent/25 disabled:opacity-40"
          data-testid="quick-buy"
        >
          <span className="text-[10px] font-semibold uppercase">Buy</span>
          <span className="tabular-nums text-[13px] font-semibold">
            {snap.ask.toFixed(precision)}
          </span>
        </button>
        <Tooltip label="Scalper Mode: preset SL, TP and auto break even for quick trades">
          <button
            type="button"
            aria-label="Scalper Mode"
            aria-pressed={snap.scalper.enabled}
            onClick={() => setScalperOpen((o) => !o)}
            className={`flex w-8 items-center justify-center border-l border-line hover:bg-hover ${snap.scalper.enabled ? 'text-accent' : 'text-muted'}`}
          >
            <Icon name="bolt" size={15} />
          </button>
        </Tooltip>
        <Tooltip label="New order" shortcut="Alt + ,">
          <button
            type="button"
            aria-label="New order"
            disabled={disabled}
            onClick={() => openTicket({ side: 'buy', type: 'market' })}
            className="flex w-8 items-center justify-center border-l border-line text-muted hover:bg-hover hover:text-fg disabled:opacity-40"
            data-testid="new-order"
          >
            <Icon name="plus" size={15} />
          </button>
        </Tooltip>
      </div>
      {scalperOpen ? (
        <ScalperMode
          value={snap.scalper}
          onClose={() => setScalperOpen(false)}
          onSave={(s) => {
            c.setScalper(s);
            setScalperOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ScalperMode({
  value,
  onSave,
  onClose,
}: {
  readonly value: ScalperSettings;
  readonly onSave: (s: ScalperSettings) => void;
  readonly onClose: () => void;
}) {
  const [s, set] = useState(value);
  const [slOn, setSlOn] = useState(value.sl !== null);
  const [tpOn, setTpOn] = useState(value.tp !== null);
  const [beOn, setBeOn] = useState(value.autoBE !== null);
  const [sl, setSl] = useState(value.sl ?? 50);
  const [tp, setTp] = useState(value.tp ?? 100);
  const [be, setBe] = useState(value.autoBE ?? { mode: 'rr' as const, value: 1 });
  const field = 'h-7 w-20 rounded border border-line bg-panel px-1.5 text-right tabular-nums';
  return (
    <div className="w-72 animate-pop rounded-lg border border-line bg-panel p-3 text-[12.5px] shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">Scalper Mode</span>
        <select
          aria-label="Distance unit"
          value={s.unit}
          onChange={(e) => set({ ...s, unit: e.target.value as ScalperSettings['unit'] })}
          className="h-7 rounded border border-line bg-panel px-1"
        >
          <option value="pips">Pips</option>
          <option value="ticks">Ticks</option>
          <option value="percent">%</option>
        </select>
      </div>
      <label className="flex h-8 items-center gap-2">
        <input type="checkbox" checked={slOn} onChange={(e) => setSlOn(e.target.checked)} />
        <span className="flex-1">Stop loss</span>
        <input
          aria-label="Stop loss distance"
          type="number"
          min={0}
          className={field}
          value={sl}
          disabled={!slOn}
          onChange={(e) => setSl(Number(e.target.value))}
        />
      </label>
      <label className="flex h-8 items-center gap-2">
        <input type="checkbox" checked={tpOn} onChange={(e) => setTpOn(e.target.checked)} />
        <span className="flex-1">Take profit</span>
        <input
          aria-label="Take profit distance"
          type="number"
          min={0}
          className={field}
          value={tp}
          disabled={!tpOn}
          onChange={(e) => setTp(Number(e.target.value))}
        />
      </label>
      <label className="flex h-8 items-center gap-2">
        <input
          type="checkbox"
          checked={beOn && slOn}
          disabled={!slOn}
          onChange={(e) => setBeOn(e.target.checked)}
        />
        <span className="flex-1">Auto break even at</span>
        <input
          aria-label="Auto break even distance"
          type="number"
          min={0}
          step={0.1}
          className="h-7 w-14 rounded border border-line bg-panel px-1 text-right"
          value={be.value}
          disabled={!beOn || !slOn}
          onChange={(e) => setBe({ ...be, value: Number(e.target.value) })}
        />
        <select
          aria-label="Auto break even unit"
          className="h-7 rounded border border-line bg-panel px-1"
          value={be.mode}
          disabled={!beOn || !slOn}
          onChange={(e) => setBe({ ...be, mode: e.target.value as 'rr' | 'pips' })}
        >
          <option value="rr">R:R</option>
          <option value="pips">pips</option>
        </select>
      </label>
      <p className="mt-1 text-[11px] text-muted">Distances only. Auto BE needs a stop loss.</p>
      <div className="mt-2 flex justify-end gap-2">
        <Button
          onClick={() => {
            onSave({ ...value, enabled: false });
          }}
        >
          Turn off
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() =>
            onSave({
              enabled: true,
              unit: s.unit,
              sl: slOn ? sl : null,
              tp: tpOn ? tp : null,
              autoBE: beOn && slOn ? be : null,
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  );
}
