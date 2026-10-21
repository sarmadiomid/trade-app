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
import { Icon } from '../ui/Icon';
import { ASSET_FA, fromDateInput, toDateInput, utcDate } from './format';
import { JalaliDateField } from './JalaliField';

const field =
  'h-11 w-full rounded-lg border border-line bg-chart px-3 text-[13px] text-fg outline-none placeholder:text-muted focus:border-accent';
const numField = `${field} text-left`;

const BALANCE_PRESETS = [
  { value: 10_000, label: '۱۰ هزار' },
  { value: 50_000, label: '۵۰ هزار' },
  { value: 100_000, label: '۱۰۰ هزار' },
  { value: 250_000, label: '۲۵۰ هزار' },
] as const;

type Section = 'basics' | 'more';

interface Props {
  readonly services: BacktestServices;
  readonly onClose: () => void;
  readonly onCreated: (id: string) => void;
  /** Prefill (duplicate a session). */
  readonly initial?: SessionSettings | undefined;
  /** Session kind when nothing is being duplicated. */
  readonly defaultType?: SessionType;
}

/** "Create session": type → name → asset → balance → dates → costs / prop rules. */
export function CreateSessionDialog({
  services,
  onClose,
  onCreated,
  initial,
  defaultType = 'backtesting',
}: Props) {
  const instruments = services.instruments();
  const [type, setType] = useState<SessionType>(initial?.type ?? defaultType);
  const [name, setName] = useState(initial ? `${initial.name} (کپی)` : '');
  const [section, setSection] = useState<Section>('basics');
  const [tried, setTried] = useState(false);
  const [symbol, setSymbol] = useState(initial?.symbol ?? instruments[0]?.symbol ?? 'XAUUSD');
  const spec = services.spec(symbol);
  const range = services.dataRange(symbol);
  const [balance, setBalance] = useState(initial?.startingBalance ?? 100_000);
  const [customBalance, setCustomBalance] = useState(
    () =>
      initial !== undefined && !BALANCE_PRESETS.some((p) => p.value === initial.startingBalance),
  );
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
  const nameMissing = tried && !name.trim();
  const submit = async () => {
    setTried(true);
    if (!settings) {
      setSection('basics');
      return setError('تاریخ شروع و پایان معتبر نیست');
    }
    const invalid = validateSettings(settings, range);
    if (invalid) {
      setSection(
        invalid.includes('اسپرد') || invalid.includes('کارمزد') || invalid.includes('پراپ')
          ? 'more'
          : 'basics',
      );
      setError(name.trim() ? invalid : null);
      return;
    }
    setBusy(true);
    const res = await services.create(settings);
    setBusy(false);
    if ('error' in res) return setError(res.error);
    onCreated(res.session.id);
  };

  const heading = initial ? 'کپی جلسه' : 'ساخت جلسه';
  return (
    <Dialog
      title={heading}
      onClose={onClose}
      width={860}
      initialFocus="input[aria-label='نام جلسه']"
      header={
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
          <h2 className="text-[16px] font-semibold">{heading}</h2>
          <div className="flex rounded-lg bg-chart p-1" role="tablist" aria-label="نوع جلسه">
            {(
              [
                ['backtesting', 'بک‌تست'],
                ['prop', 'پراپ'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={type === id}
                onClick={() => setType(id)}
                className={`h-7 rounded-md px-3 text-[13px] font-medium transition ${
                  type === id ? 'bg-hover text-fg' : 'text-muted hover:text-fg'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            aria-label="بستن"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      }
      footer={
        <>
          {error ? (
            <p className="min-w-0 flex-1 text-[12.5px] text-down" role="alert">
              {error}
            </p>
          ) : (
            <div className="flex-1" />
          )}
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button
            variant="primary"
            className="h-9 rounded-full px-5"
            disabled={busy}
            onClick={() => void submit()}
            data-testid="create-session-submit"
          >
            {busy ? 'در حال ساخت…' : 'ساخت جلسه'}
          </Button>
        </>
      }
    >
      <div className="flex min-h-[440px] flex-col sm:flex-row">
        <nav className="flex shrink-0 gap-1 border-b border-line p-3 sm:w-[210px] sm:flex-col sm:border-b-0 sm:border-e">
          <SectionTab
            active={section === 'basics'}
            title="پایه"
            text="نام، موجودی، نماد و تاریخ"
            onClick={() => setSection('basics')}
          />
          <SectionTab
            active={section === 'more'}
            title="گزینه‌های بیشتر"
            text={type === 'prop' ? 'اسپرد، کارمزد و قوانین پراپ' : 'اسپرد و کارمزد'}
            onClick={() => setSection('more')}
          />
        </nav>
        <div className="min-w-0 flex-1 space-y-5 p-5 text-[13px]">
          {section === 'basics' ? (
            <>
              <label className="block space-y-1.5">
                <FieldLabel required>نام جلسه</FieldLabel>
                <input
                  aria-label="نام جلسه"
                  aria-invalid={nameMissing}
                  className={`${field} ${nameMissing ? 'border-down focus:border-down' : ''}`}
                  placeholder="نام جلسه را بنویسید"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                />
                {nameMissing ? <p className="text-[12px] text-down">این فیلد لازم است</p> : null}
              </label>

              <div className="space-y-1.5">
                <FieldLabel required>موجودی حساب</FieldLabel>
                <div className="flex flex-wrap gap-1 rounded-lg border border-line p-1">
                  {BALANCE_PRESETS.map((p) => {
                    const on = !customBalance && balance === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setCustomBalance(false);
                          setBalance(p.value);
                        }}
                        className={`h-8 flex-1 rounded-md px-2 text-[12.5px] font-semibold transition ${
                          on
                            ? 'bg-accent text-accent-fg'
                            : 'text-muted hover:bg-hover hover:text-fg'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={customBalance}
                    onClick={() => setCustomBalance(true)}
                    className={`h-8 flex-1 rounded-md px-2 text-[12.5px] font-semibold transition ${
                      customBalance
                        ? 'bg-accent text-accent-fg'
                        : 'text-muted hover:bg-hover hover:text-fg'
                    }`}
                  >
                    دلخواه
                  </button>
                </div>
                {customBalance ? (
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
                ) : (
                  <p className="text-[12px] text-muted">{faNum(balance)} دلار</p>
                )}
              </div>

              <label className="block space-y-1.5">
                <FieldLabel>برچسب استراتژی</FieldLabel>
                <input
                  aria-label="برچسب استراتژی"
                  className={field}
                  placeholder="اختیاری؛ برای گروه‌بندی جلسه‌ها"
                  value={tag}
                  maxLength={40}
                  onChange={(e) => setTag(e.target.value)}
                />
              </label>

              <label className="block space-y-1.5">
                <FieldLabel required>نماد</FieldLabel>
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
                <p className="text-[12px] leading-6 text-muted">
                  هر لات {faNum(spec.contractSize, 0)} واحد، پیپ {faNum(spec.pipSize)}، حجم{' '}
                  {faNum(spec.lotMin)} تا {faNum(spec.lotMax)} لات.
                </p>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <FieldLabel required>تاریخ شروع</FieldLabel>
                  <JalaliDateField
                    ariaLabel="تاریخ شروع"
                    value={start}
                    min={toDateInput(range.start)}
                    max={toDateInput(range.end - DAY_MS)}
                    onChange={setStart}
                  />
                </label>
                <label className="block space-y-1.5">
                  <FieldLabel required>تاریخ پایان</FieldLabel>
                  <JalaliDateField
                    ariaLabel="تاریخ پایان"
                    value={end}
                    min={start}
                    max={toDateInput(range.end - DAY_MS)}
                    onChange={setEnd}
                  />
                </label>
              </div>
              <p className="-mt-3 text-[12px] leading-6 text-muted">
                {days > 0 ? `${faNum(days)} روز` : ''}
                {' · '}
                داده از {utcDate(range.start)} تا {utcDate(range.end - DAY_MS)}. تاریخ شمسی است و
                ساعت جلسه، ساعت جهانی می‌ماند.
              </p>
            </>
          ) : (
            <>
              <CostRow
                label="اسپرد"
                hint={`${faNum(spread / spec.pipSize, 1)} پیپ، واحد قیمت`}
                on={spreadOn}
                onToggle={setSpreadOn}
                valueLabel="اسپرد"
                value={spread}
                step={spec.tickSize}
                onValue={setSpread}
              />
              <CostRow
                label="کارمزد"
                hint="دلار برای هر لات، هم ورود و هم خروج"
                on={commOn}
                onToggle={setCommOn}
                valueLabel="کارمزد هر لات"
                value={comm}
                step={0.5}
                onValue={setComm}
              />
              {type === 'prop' ? (
                <fieldset className="space-y-3">
                  <legend className="text-[13px] font-semibold">قوانین پراپ</legend>
                  <p className="text-[12px] leading-6 text-muted">درصد موجودی شروع.</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ['profitTargetPct', 'هدف سود'],
                        ['maxDailyLossPct', 'سقف ضرر روزانه'],
                        ['maxTotalLossPct', 'سقف ضرر کل'],
                      ] as const
                    ).map(([k, label]) => (
                      <label key={k} className="block space-y-1.5">
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
                  </div>
                </fieldset>
              ) : null}
              <label className="block space-y-1.5">
                <FieldLabel>توضیح</FieldLabel>
                <input
                  aria-label="توضیح"
                  className={field}
                  placeholder="اختیاری"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function FieldLabel({
  children,
  required = false,
}: {
  readonly children: string;
  readonly required?: boolean;
}) {
  return (
    <span className="text-[13px] font-medium text-fg">
      {children}
      {required ? <span className="text-down"> *</span> : null}
    </span>
  );
}

function SectionTab({
  active,
  title,
  text,
  onClick,
}: {
  readonly active: boolean;
  readonly title: string;
  readonly text: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      onClick={onClick}
      className={`rounded-xl px-3 py-2.5 text-start transition ${
        active ? 'border border-line bg-chart' : 'border border-transparent hover:bg-hover'
      }`}
    >
      <span className="block text-[13px] font-semibold">{title}</span>
      <span className="mt-0.5 block text-[11.5px] leading-5 text-muted">{text}</span>
    </button>
  );
}

function CostRow({
  label,
  hint,
  on,
  onToggle,
  valueLabel,
  value,
  step,
  onValue,
}: {
  readonly label: string;
  readonly hint: string;
  readonly on: boolean;
  readonly onToggle: (on: boolean) => void;
  readonly valueLabel: string;
  readonly value: number;
  readonly step: number;
  readonly onValue: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span>
          <span className="block font-medium">{label}</span>
          <span className="text-[12px] text-muted">{hint}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          onClick={() => onToggle(!on)}
          className={`flex h-6 w-11 shrink-0 rounded-full p-0.5 transition ${
            on ? 'justify-end bg-accent' : 'justify-start bg-line'
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white" />
        </button>
      </div>
      {on ? (
        <input
          aria-label={valueLabel}
          type="number"
          dir="ltr"
          min={0}
          step={step}
          className={numField}
          value={value}
          onChange={(e) => onValue(Number(e.target.value))}
        />
      ) : null}
    </div>
  );
}
