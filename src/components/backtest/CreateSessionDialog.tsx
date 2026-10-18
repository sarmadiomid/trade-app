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
import { faNum } from '@/lib/locale/jalali';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ASSET_FA, fromDateInput, toDateInput, utcDate } from './format';
import { JalaliDateField } from './JalaliField';

const field =
  'h-9 w-full rounded-md border border-line bg-chart px-2.5 text-[13px] text-fg outline-none focus:border-accent';
const numField = `${field} text-left`;

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
  const [name, setName] = useState(initial ? `${initial.name} (کپی)` : 'بک‌تست XAUUSD');
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
    if (!settings) return setError('تاریخ شروع و پایان معتبر نیست');
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
      title={initial ? 'کپی جلسه' : 'جلسه جدید'}
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
          <Button onClick={onClose}>انصراف</Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void submit()}
            data-testid="create-session-submit"
          >
            {busy ? 'در حال ساخت…' : 'ساخت جلسه'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5 text-[13px]">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="نوع جلسه">
          {(
            [
              ['backtesting', 'جلسه بک‌تست', 'بازار را بازپخش کنید و استراتژی را بسنجید'],
              ['prop', 'جلسه پراپ', 'هدف سود و سقف ضرر را هم اعمال کنید'],
            ] as const
          ).map(([id, title, sub]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={type === id}
              onClick={() => setType(id)}
              className={`rounded-lg border p-3 text-start ${type === id ? 'border-accent bg-accent/10' : 'border-line hover:bg-hover'}`}
            >
              <div className="font-semibold">{title}</div>
              <div className="text-[12px] text-muted">{sub}</div>
            </button>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-muted">نام جلسه</span>
          <input
            aria-label="نام جلسه"
            className={field}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-muted">نماد</span>
            <select
              aria-label="نماد"
              className={field}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              {instruments.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol} · {ASSET_FA[i.symbol] ?? i.description}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-muted">موجودی شروع (دلار)</span>
            <input
              aria-label="موجودی حساب"
              type="number"
              dir="ltr"
              min={1}
              step={1000}
              className={numField}
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted">تاریخ شروع</span>
            <JalaliDateField
              ariaLabel="تاریخ شروع"
              value={start}
              min={toDateInput(range.start)}
              max={toDateInput(range.end - DAY_MS)}
              onChange={setStart}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted">تاریخ پایان (همان روز هم شامل است)</span>
            <JalaliDateField
              ariaLabel="تاریخ پایان"
              value={end}
              min={start}
              max={toDateInput(range.end - DAY_MS)}
              onChange={setEnd}
            />
          </label>
        </div>
        <p className="-mt-2 text-[12px] leading-6 text-muted">
          {days > 0 ? `${faNum(days)} روز` : ''}
          {' · '}
          داده از {utcDate(range.start)} تا {utcDate(range.end - DAY_MS)} موجود است. تاریخ شمسی
          است و ساعت جلسه، ساعت جهانی (UTC) می‌ماند.
        </p>
        <fieldset className="grid grid-cols-2 gap-3 rounded-lg border border-line p-3">
          <legend className="px-1 text-[12px] text-muted">اسپرد و کارمزد</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={spreadOn}
              onChange={(e) => setSpreadOn(e.target.checked)}
            />
            <span className="flex-1">اسپرد</span>
            <input
              aria-label="اسپرد"
              type="number"
              dir="ltr"
              min={0}
              step={spec.tickSize}
              disabled={!spreadOn}
              className="h-8 w-24 rounded-md border border-line bg-chart px-2 text-left"
              value={spread}
              onChange={(e) => setSpread(Number(e.target.value))}
            />
          </label>
          <span className="self-center text-[12px] text-muted">
            {faNum(spread / spec.pipSize, 1)} پیپ (واحد قیمت)
          </span>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={commOn} onChange={(e) => setCommOn(e.target.checked)} />
            <span className="flex-1">کارمزد</span>
            <input
              aria-label="کارمزد هر لات"
              type="number"
              dir="ltr"
              min={0}
              step={0.5}
              disabled={!commOn}
              className="h-8 w-24 rounded-md border border-line bg-chart px-2 text-left"
              value={comm}
              onChange={(e) => setComm(Number(e.target.value))}
            />
          </label>
          <span className="self-center text-[12px] text-muted">
            دلار برای هر لات، هم هنگام ورود و هم هنگام خروج
          </span>
        </fieldset>
        {type === 'prop' ? (
          <fieldset className="grid grid-cols-3 gap-3 rounded-lg border border-line p-3">
            <legend className="px-1 text-[12px] text-muted">قوانین پراپ (درصد موجودی)</legend>
            {(
              [
                ['profitTargetPct', 'هدف سود'],
                ['maxDailyLossPct', 'سقف ضرر روزانه'],
                ['maxTotalLossPct', 'سقف ضرر کل'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="block space-y-1">
                <span className="text-[12px] text-muted">{label}</span>
                <input
                  aria-label={label}
                  type="number"
                  dir="ltr"
                  min={0.1}
                  max={99}
                  step={0.5}
                  className={numField}
                  value={rules[k]}
                  onChange={(e) => setRules({ ...rules, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-muted">برچسب استراتژی (اختیاری)</span>
            <input className={field} value={tag} onChange={(e) => setTag(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-muted">توضیح (اختیاری)</span>
            <input
              className={field}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <p className="text-[12px] leading-6 text-muted">
          <bdi dir="ltr">{spec.symbol}</bdi>
          {': '}
          هر لات {faNum(spec.contractSize, 0)} واحد، اندازه پیپ {faNum(spec.pipSize)}، حجم از{' '}
          {faNum(spec.lotMin)} تا {faNum(spec.lotMax)} لات.
        </p>
      </div>
    </Dialog>
  );
}
