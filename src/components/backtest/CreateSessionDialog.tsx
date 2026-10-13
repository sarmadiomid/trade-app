'use client';

import { useMemo, useState } from 'react';
import type { BacktestServices } from '@/lib/app';
import { DAY_MS } from '@/lib/core';
import {
  DEFAULT_PROP_RULES,
  validateSettings,
  type SessionSettings,
  type SessionType,
} from '@/lib/backtest';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { fromDateInput, toDateInput } from './format';

const field =
  'h-9 w-full rounded-md border border-line bg-chart px-2.5 text-[13px] text-fg outline-none focus:border-accent';

interface Props {
  readonly services: BacktestServices;
  readonly onClose: () => void;
  readonly onCreated: (id: string) => void;
  /** Prefill (duplicate a session). */
  readonly initial?: SessionSettings | undefined;
}

/** "Create session": type → name → asset → balance → dates → costs / prop rules. */
export function CreateSessionDialog({ services, onClose, onCreated, initial }: Props) {
  const instruments = services.instruments();
  const [type, setType] = useState<SessionType>(initial?.type ?? 'backtesting');
  const [name, setName] = useState(initial ? `${initial.name} (copy)` : 'XAUUSD backtest');
  const [symbol, setSymbol] = useState(initial?.symbol ?? instruments[0]?.symbol ?? 'XAUUSD');
  const spec = services.spec(symbol);
  const range = services.dataRange(symbol);
  const [balance, setBalance] = useState(initial?.startingBalance ?? 100_000);
  const [start, setStart] = useState(toDateInput(initial?.startDate ?? Date.UTC(2024, 0, 1)));
  const [end, setEnd] = useState(toDateInput(initial?.endDate ?? Date.UTC(2024, 0, 31)));
  const [spreadOn, setSpreadOn] = useState(initial?.spreadEnabled ?? false);
  const [spread, setSpread] = useState(initial?.spread ?? spec.defaultSpread);
  const [commOn, setCommOn] = useState(initial?.commissionEnabled ?? false);
  const [comm, setComm] = useState(
    initial?.commissionPerLot ?? (spec.defaultCommissionPerLot || 3.5),
  );
  const [rules, setRules] = useState(initial?.propRules ?? DEFAULT_PROP_RULES);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [tag, setTag] = useState(initial?.strategyTag ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const settings = useMemo((): SessionSettings | null => {
    const s = fromDateInput(start);
    const e = fromDateInput(end);
    if (s === null || e === null) return null;
    return {
      name: name.trim(),
      description,
      strategyTag: tag.trim(),
      type,
      symbol,
      startingBalance: balance,
      startDate: s,
      endDate: e,
      spreadEnabled: spreadOn,
      spread,
      commissionEnabled: commOn,
      commissionPerLot: comm,
      propRules: type === 'prop' ? rules : null,
    };
  }, [
    name,
    description,
    tag,
    type,
    symbol,
    balance,
    start,
    end,
    spreadOn,
    spread,
    commOn,
    comm,
    rules,
  ]);

  const days = settings ? Math.round((settings.endDate - settings.startDate) / DAY_MS) + 1 : 0;
  const submit = async () => {
    if (!settings) return setError('Enter a valid start and end date');
    const invalid = validateSettings(settings, range);
    if (invalid) return setError(invalid);
    setBusy(true);
    const res = await services.create(settings);
    setBusy(false);
    if ('error' in res) return setError(res.error);
    onCreated(res.session.id);
  };

  return (
    <Dialog
      title={initial ? 'Duplicate session' : 'Create session'}
      onClose={onClose}
      width={560}
      footer={
        <>
          {error ? (
            <p className="flex-1 text-[12.5px] text-down" role="alert">
              {error}
            </p>
          ) : (
            <div className="flex-1" />
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void submit()}
            data-testid="create-session-submit"
          >
            {busy ? 'Creating…' : 'Create session'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5 text-[13px]">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Session type">
          {(
            [
              ['backtesting', 'Backtesting session', 'Replay the market and test a strategy'],
              ['prop', 'Prop Firm Session', 'Add profit target and loss limits'],
            ] as const
          ).map(([id, title, sub]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={type === id}
              onClick={() => setType(id)}
              className={`rounded-lg border p-3 text-left ${type === id ? 'border-accent bg-accent/10' : 'border-line hover:bg-hover'}`}
            >
              <div className="font-semibold">{title}</div>
              <div className="text-[12px] text-muted">{sub}</div>
            </button>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-muted">Session name</span>
          <input
            aria-label="Session name"
            className={field}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-muted">Asset</span>
            <select
              aria-label="Asset"
              className={field}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              {instruments.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol} · {i.description}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-muted">Account balance (USD)</span>
            <input
              aria-label="Account balance"
              type="number"
              min={1}
              step={1000}
              className={field}
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted">Start date (UTC)</span>
            <input
              aria-label="Start date"
              type="date"
              className={field}
              value={start}
              min={toDateInput(range.start)}
              max={toDateInput(range.end - DAY_MS)}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted">End date (UTC, inclusive)</span>
            <input
              aria-label="End date"
              type="date"
              className={field}
              value={end}
              min={start}
              max={toDateInput(range.end - DAY_MS)}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <p className="-mt-2 text-[12px] text-muted">
          {days > 0 ? `${days} days` : ''} · data available {toDateInput(range.start)} →{' '}
          {toDateInput(range.end - DAY_MS)}
        </p>
        <fieldset className="grid grid-cols-2 gap-3 rounded-lg border border-line p-3">
          <legend className="px-1 text-[12px] text-muted">Spreads & commissions</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={spreadOn}
              onChange={(e) => setSpreadOn(e.target.checked)}
            />
            <span className="flex-1">Spread</span>
            <input
              aria-label="Spread"
              type="number"
              min={0}
              step={spec.tickSize}
              disabled={!spreadOn}
              className="h-8 w-24 rounded-md border border-line bg-chart px-2 text-right"
              value={spread}
              onChange={(e) => setSpread(Number(e.target.value))}
            />
          </label>
          <span className="self-center text-[12px] text-muted">
            {(spread / spec.pipSize).toFixed(1)} pips (price units)
          </span>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={commOn} onChange={(e) => setCommOn(e.target.checked)} />
            <span className="flex-1">Commission</span>
            <input
              aria-label="Commission per lot"
              type="number"
              min={0}
              step={0.5}
              disabled={!commOn}
              className="h-8 w-24 rounded-md border border-line bg-chart px-2 text-right"
              value={comm}
              onChange={(e) => setComm(Number(e.target.value))}
            />
          </label>
          <span className="self-center text-[12px] text-muted">
            USD per lot, charged on entry and on exit
          </span>
        </fieldset>
        {type === 'prop' ? (
          <fieldset className="grid grid-cols-3 gap-3 rounded-lg border border-line p-3">
            <legend className="px-1 text-[12px] text-muted">Prop firm rules (% of balance)</legend>
            {(
              [
                ['profitTargetPct', 'Profit target'],
                ['maxDailyLossPct', 'Max daily loss'],
                ['maxTotalLossPct', 'Max total loss'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="block space-y-1">
                <span className="text-[12px] text-muted">{label}</span>
                <input
                  aria-label={label}
                  type="number"
                  min={0.1}
                  max={99}
                  step={0.5}
                  className={field}
                  value={rules[k]}
                  onChange={(e) => setRules({ ...rules, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-muted">Strategy tag (optional)</span>
            <input className={field} value={tag} onChange={(e) => setTag(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-muted">Description (optional)</span>
            <input
              className={field}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <p className="text-[12px] text-muted">
          {spec.symbol}: contract {spec.contractSize} oz per lot, pip {spec.pipSize}, lots{' '}
          {spec.lotMin}–{spec.lotMax}.
        </p>
      </div>
    </Dialog>
  );
}
