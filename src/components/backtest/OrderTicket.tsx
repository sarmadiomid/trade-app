'use client';

import { useMemo, useState } from 'react';
import { lotsForRisk, normalizeLots, pnl, roundPrice, type Side } from '@/lib/backtest';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { useBacktest } from './context';
import { money, num } from './format';
import { useBacktestStore, type TicketType } from './store';

type SizeMode = 'lots' | 'risk-pct' | 'risk-usd';
type LevelMode = 'price' | 'pips' | 'usd';

interface LevelInput {
  readonly on: boolean;
  readonly mode: LevelMode;
  readonly value: number;
}

const input =
  'h-8 w-full rounded-md border border-line bg-chart px-2 text-right tabular-nums text-fg outline-none focus:border-accent';

/**
 * The full New Order ticket (Alt + ,): market / limit / stop, sizing by lots or risk, SL/TP.
 * Mounted with a key per request, so each request starts from its own prefill.
 */
export function OrderTicket() {
  const c = useBacktest();
  const ticket = useBacktestStore((s) => s.ticket);
  const snap = useBacktestStore((s) => s.snap);
  const openTicket = useBacktestStore((s) => s.openTicket);
  const cfg = c.cfg;
  const precision = c.spec.pricePrecision;

  const [side, setSide] = useState<Side>(ticket?.side ?? 'buy');
  const [type, setType] = useState<TicketType>(ticket?.type ?? 'market');
  const [price, setPrice] = useState<number>(
    ticket?.price ?? (ticket?.side === 'sell' ? snap?.bid : snap?.ask) ?? 0,
  );
  const [sizeMode, setSizeMode] = useState<SizeMode>('lots');
  const [size, setSize] = useState<number>(snap?.quickVolume || cfg.lotMin);
  const [sl, setSl] = useState<LevelInput>({ on: false, mode: 'pips', value: 50 });
  const [tp, setTp] = useState<LevelInput>({ on: false, mode: 'pips', value: 100 });
  const [beOn, setBeOn] = useState(false);
  const [beR, setBeR] = useState(1);

  const calc = useMemo(() => {
    if (!snap) return null;
    const d = side === 'buy' ? 1 : -1;
    const entry = type === 'market' ? (side === 'buy' ? snap.ask : snap.bid) : price;
    const baseLots = sizeMode === 'lots' ? normalizeLots(cfg, size) : 0;
    const level = (l: LevelInput, sign: number, lotsForUsd: number): number | null => {
      if (!l.on || !(l.value > 0)) return null;
      if (l.mode === 'price') return roundPrice(cfg, l.value);
      if (l.mode === 'pips') return roundPrice(cfg, entry + sign * d * l.value * cfg.pipSize);
      if (!(lotsForUsd > 0)) return null;
      return roundPrice(cfg, entry + (sign * d * l.value) / (lotsForUsd * cfg.contractSize));
    };
    const slPrice = level(sl, -1, baseLots);
    let lots = baseLots;
    if (sizeMode !== 'lots') {
      const riskMoney = sizeMode === 'risk-pct' ? (snap.balance * size) / 100 : size;
      lots = slPrice === null ? 0 : lotsForRisk(cfg, riskMoney, Math.abs(entry - slPrice));
    }
    const tpPrice = level(tp, 1, lots);
    const risk = slPrice === null ? null : -pnl(cfg, side, entry, slPrice, lots);
    const reward = tpPrice === null ? null : pnl(cfg, side, entry, tpPrice, lots);
    return {
      entry,
      lots,
      slPrice,
      tpPrice,
      risk,
      reward,
      rr: risk && reward && risk > 0 ? reward / risk : null,
      pipValue: lots * cfg.contractSize * cfg.pipSize,
    };
  }, [snap, side, type, price, sizeMode, size, sl, tp, cfg]);

  if (!ticket || !snap || !calc) return null;
  const close = () => openTicket(null);
  const needsSl = sizeMode !== 'lots';
  const submit = () => {
    if (needsSl && calc.slPrice === null) {
      c.notice('error', 'Risk-based sizing needs a stop loss (price or pips)');
      return;
    }
    const err = c.trading.place({
      side,
      type,
      ...(type === 'market' ? {} : { price }),
      volume: calc.lots,
      sl: calc.slPrice,
      tp: calc.tpPrice,
      autoBE: beOn && calc.slPrice !== null ? { mode: 'rr', value: beR } : null,
    });
    if (!err) close();
  };
  const sideCls = side === 'buy' ? 'bg-accent text-white' : 'bg-down text-white';
  const label =
    type === 'market'
      ? `${side === 'buy' ? 'Buy' : 'Sell'} ${num(calc.lots)} ${snap.settings.symbol} @ MKT`
      : `Place ${side === 'buy' ? 'Buy' : 'Sell'} ${type === 'limit' ? 'Limit' : 'Stop'} ${num(calc.lots)} @ ${num(price, precision)}`;

  return (
    <aside
      aria-label="New order"
      data-testid="order-ticket"
      className="flex w-72 shrink-0 animate-fade flex-col overflow-y-auto border-l border-line bg-panel text-[13px]"
    >
      <div className="flex h-10 items-center justify-between border-b border-line pl-3 pr-1">
        <span className="font-semibold">New order · {snap.settings.symbol}</span>
        <button
          type="button"
          aria-label="Close order panel"
          onClick={close}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <div className="grid grid-cols-2 gap-1">
          {(['sell', 'buy'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`flex h-12 flex-col items-center justify-center rounded-md border border-line ${side === s ? (s === 'buy' ? 'bg-accent text-white' : 'bg-down text-white') : 'hover:bg-hover'}`}
            >
              <span className="text-[11px] font-semibold uppercase">{s}</span>
              <span className="tabular-nums">
                {(s === 'buy' ? snap.ask : snap.bid).toFixed(precision)}
              </span>
            </button>
          ))}
        </div>
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-md bg-chart p-0.5">
          {(['market', 'limit', 'stop'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={type === t}
              type="button"
              onClick={() => {
                setType(t);
                if (t !== 'market' && type === 'market')
                  setPrice(side === 'buy' ? snap.ask : snap.bid);
              }}
              className={`h-7 rounded capitalize ${type === t ? 'bg-panel font-semibold text-fg shadow' : 'text-muted hover:text-fg'}`}
            >
              {t}
            </button>
          ))}
        </div>
        {type !== 'market' ? (
          <label className="flex flex-col gap-1">
            <span className="text-muted">{type === 'limit' ? 'Limit' : 'Stop'} price</span>
            <input
              aria-label="Order price"
              type="number"
              step={cfg.tickSize}
              className={input}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </label>
        ) : null}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-muted">Quantity</span>
            <select
              aria-label="Sizing"
              value={sizeMode}
              onChange={(e) => setSizeMode(e.target.value as SizeMode)}
              className="h-7 rounded border border-line bg-panel px-1 text-[12px]"
            >
              <option value="lots">Lots</option>
              <option value="risk-pct">Risk %</option>
              <option value="risk-usd">Risk $</option>
            </select>
          </div>
          <input
            aria-label="Quantity"
            type="number"
            min={0}
            step={sizeMode === 'lots' ? cfg.lotStep : 0.1}
            className={input}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
          <span className="text-[11px] text-muted">
            {num(calc.lots)} lots · {num(calc.lots * cfg.contractSize, 0)} oz · pip value $
            {num(calc.pipValue)}
          </span>
        </div>
        <LevelEditor
          label="Stop loss"
          value={sl}
          onChange={setSl}
          color="#ff9800"
          allowUsd={sizeMode === 'lots'}
          result={calc.slPrice}
          precision={precision}
        />
        <LevelEditor
          label="Take profit"
          value={tp}
          onChange={setTp}
          color="#22ab94"
          allowUsd
          result={calc.tpPrice}
          precision={precision}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={beOn}
            disabled={!sl.on}
            onChange={(e) => setBeOn(e.target.checked)}
          />
          <span className="flex-1">Auto break even at</span>
          <input
            aria-label="Auto break even R"
            type="number"
            min={0.1}
            step={0.1}
            disabled={!beOn}
            className="h-7 w-16 rounded border border-line bg-chart px-1 text-right"
            value={beR}
            onChange={(e) => setBeR(Number(e.target.value))}
          />
          <span className="text-muted">R</span>
        </label>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 rounded-md bg-chart p-2 text-[12px]">
          <dt className="text-muted">Risk</dt>
          <dd className="text-right tabular-nums text-down">
            {calc.risk === null
              ? '—'
              : `${money(calc.risk)} (${((calc.risk / snap.balance) * 100).toFixed(2)}%)`}
          </dd>
          <dt className="text-muted">Reward</dt>
          <dd className="text-right tabular-nums text-up">
            {calc.reward === null
              ? '—'
              : `${money(calc.reward)} (${((calc.reward / snap.balance) * 100).toFixed(2)}%)`}
          </dd>
          <dt className="text-muted">R:R</dt>
          <dd className="text-right tabular-nums">
            {calc.rr === null ? '—' : `1 : ${calc.rr.toFixed(2)}`}
          </dd>
        </dl>
        <button
          type="button"
          onClick={submit}
          disabled={!(calc.lots > 0)}
          className={`h-10 rounded-md text-[13px] font-semibold disabled:opacity-40 ${sideCls}`}
          data-testid="ticket-submit"
        >
          {label}
        </button>
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
    </aside>
  );
}

function LevelEditor({
  label,
  value,
  onChange,
  color,
  allowUsd,
  result,
  precision,
}: {
  readonly label: string;
  readonly value: LevelInput;
  readonly onChange: (v: LevelInput) => void;
  readonly color: string;
  readonly allowUsd: boolean;
  readonly result: number | null;
  readonly precision: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.on}
          onChange={(e) => onChange({ ...value, on: e.target.checked })}
        />
        <span className="flex-1 font-medium" style={{ color }}>
          {label}
        </span>
        <select
          aria-label={`${label} unit`}
          value={value.mode === 'usd' && !allowUsd ? 'pips' : value.mode}
          onChange={(e) => onChange({ ...value, mode: e.target.value as LevelMode })}
          className="h-7 rounded border border-line bg-panel px-1 text-[12px]"
        >
          <option value="price">Price</option>
          <option value="pips">Pips</option>
          {allowUsd ? <option value="usd">$</option> : null}
        </select>
      </label>
      {value.on ? (
        <>
          <input
            aria-label={`${label} value`}
            type="number"
            min={0}
            className={input}
            value={value.value}
            onChange={(e) => onChange({ ...value, value: Number(e.target.value) })}
          />
          <span className="text-right text-[11px] text-muted">
            @ {result === null ? '—' : result.toFixed(precision)}
          </span>
        </>
      ) : null}
    </div>
  );
}
