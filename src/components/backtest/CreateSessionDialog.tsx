'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  defaultHistoryWindow,
  entitlements,
  isPlanLimitMessage,
  limitMessage,
  openPlanPrompt,
  PLAN_LABEL,
  requiresPlan,
  selectableHistoryStart,
  sessionSettingsDenial,
  STANDARD_BALANCE,
  symbolAllowed,
  symbolDenial,
  type BacktestServices,
  type PlanId,
} from '@/lib/app';
import { usePlan, usePlanReady, usePlanUsage } from '../billing/usePlan';
import { DAY_MS } from '@/lib/core';
import { customCatalogVersion, ensureCustomCatalog, subscribeCustomCatalog } from '@/lib/data';
import {
  DEFAULT_PROP_RULES,
  validateSettings,
  type SessionSettings,
  type SessionType,
} from '@/lib/backtest';
import { faNum } from '@/lib/locale/jalali';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { SymbolField } from '../market/SymbolField';
import { fromDateInput, toDateInput, utcDate } from './format';
import { JalaliDateField } from './JalaliField';

const SHELL = '[--dlg-bg:#0b0c0e] [--dlg-line:#1e2026] [--dlg-fg:#f5f6f8]';
const field =
  'h-11 w-full rounded-xl border border-[#23252c] bg-[#0b0c0e] px-3.5 text-[13.5px] text-white outline-none transition placeholder:text-[#686c78] focus:border-[#1d5eff]';
const numField = `${field} text-left`;
const dateField =
  'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-[#23252c] bg-[#0b0c0e] px-3.5 text-[13.5px] text-white outline-none transition focus:border-[#1d5eff]';

const BALANCE_PRESETS = [
  { value: 10_000, label: '$10K' },
  { value: 50_000, label: '$50K' },
  { value: 100_000, label: '$100K' },
  { value: 250_000, label: '$250K' },
] as const;

const STRATEGY_SUGGESTIONS = [
  'پرایس اکشن',
  'اسمارت مانی (ICT)',
  'شکست ساختار',
  'عرضه و تقاضا',
  'اسکالپ سشن لندن',
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
  const plan = usePlan();
  const planReady = usePlanReady();
  const usage = usePlanUsage();
  const access = entitlements(plan);
  const catalogTick = useSyncExternalStore(subscribeCustomCatalog, customCatalogVersion, () => 0);
  const instruments = useMemo(() => {
    if (catalogTick < 0) return [];
    return services.instruments();
  }, [services, catalogTick]);
  useEffect(() => {
    void ensureCustomCatalog();
  }, []);
  const [type, setType] = useState<SessionType>(initial?.type ?? defaultType);
  const [name, setName] = useState(initial ? `${initial.name} (کپی)` : '');
  const [section, setSection] = useState<Section>('basics');
  const [tried, setTried] = useState(false);
  const [symbol, setSymbol] = useState(initial?.symbol ?? instruments[0]?.symbol ?? 'XAUUSD');
  const initialSpec = services.spec(symbol);
  const [balance, setBalance] = useState(initial?.startingBalance ?? 100_000);
  const [customBalance, setCustomBalance] = useState(
    () =>
      initial !== undefined && !BALANCE_PRESETS.some((p) => p.value === initial.startingBalance),
  );
  const [start, setStart] = useState(() => {
    if (initial) return toDateInput(initial.startDate);
    const window = defaultHistoryWindow(services.dataRange(symbol));
    return toDateInput(window.start);
  });
  const [end, setEnd] = useState(() => {
    if (initial) return toDateInput(initial.endDate);
    const window = defaultHistoryWindow(services.dataRange(symbol));
    return toDateInput(window.end);
  });
  const [spreadOn, setSpreadOn] = useState(initial?.spreadEnabled ?? false);
  const [spread, setSpread] = useState(initial?.spread ?? initialSpec.defaultSpread);
  const [commOn, setCommOn] = useState(initial?.commissionEnabled ?? false);
  const [comm, setComm] = useState(
    initial?.commissionPerLot ?? (initialSpec.defaultCommissionPerLot || 3.5),
  );
  const [rules, setRules] = useState(initial?.propRules ?? DEFAULT_PROP_RULES);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [tag, setTag] = useState(initial?.strategyTag ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const strategyInputRef = useRef<HTMLInputElement>(null);
  const sessionType: SessionType = !access.prop && type === 'prop' ? 'backtesting' : type;
  const balanceValue = access.customBalance ? balance : STANDARD_BALANCE;
  const customOn = access.customBalance && customBalance;
  const spreadEnabled = access.spread && spreadOn;
  const commissionEnabled = access.commission && commOn;
  const strategyTag = access.strategyTags === 0 ? '' : tag;
  const symbolValue = symbolAllowed(plan, symbol) ? symbol : 'XAUUSD';
  const spec = services.spec(symbolValue);
  const range = services.dataRange(symbolValue);
  const lastDay = range.end - DAY_MS;
  const earliest = planReady ? selectableHistoryStart(plan, range) : range.start;
  const { start: shownStart, end: shownEnd } = fitHistory(start, end, earliest, lastDay);
  const historyLimited = planReady && access.historyMonths !== null;

  const settings = useMemo((): SessionSettings | null => {
    const fitted = fitHistory(start, end, earliest, lastDay);
    const s = fromDateInput(fitted.start);
    const e = fromDateInput(fitted.end);
    if (s === null || e === null) return null;
    return {
      name: name.trim(),
      description,
      strategyTag: strategyTag.trim(),
      type: sessionType,
      symbol: symbolValue,
      startingBalance: balanceValue,
      startDate: s,
      endDate: e,
      spreadEnabled,
      spread,
      commissionEnabled,
      commissionPerLot: comm,
      propRules: sessionType === 'prop' ? rules : null,
    };
  }, [
    name,
    description,
    strategyTag,
    sessionType,
    symbolValue,
    balanceValue,
    start,
    end,
    earliest,
    lastDay,
    spreadEnabled,
    spread,
    commissionEnabled,
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
    const denied = sessionSettingsDenial(plan, settings, range);
    if (denied) return openPlanPrompt(denied);
    if (usage.sessionLimit !== null && usage.sessions >= usage.sessionLimit) {
      return openPlanPrompt(limitMessage('جلسات بک‌تست', plan, usage.sessionLimit));
    }
    setBusy(true);
    const res = await services.create(settings);
    setBusy(false);
    if ('error' in res) {
      if (isPlanLimitMessage(res.error)) return openPlanPrompt(res.error);
      return setError(res.error);
    }
    onCreated(res.session.id);
  };

  const heading = initial ? 'کپی جلسه' : 'ساخت جلسه';
  return (
    <Dialog
      title={heading}
      onClose={onClose}
      width={940}
      className={SHELL}
      initialFocus="input[aria-label='نام جلسه']"
      header={
        <div className="flex h-16 shrink-0 items-center gap-3.5 border-b border-[#1e2026] px-6">
          <h2 className="text-[20px] font-bold tracking-tight text-white">{heading}</h2>
          <div
            className="flex items-center gap-0.5 rounded-full border border-[#22242a] bg-[#0e0f12] p-1"
            role="tablist"
            aria-label="نوع جلسه"
          >
            <button
              type="button"
              role="tab"
              aria-selected={sessionType === 'backtesting'}
              onClick={() => setType('backtesting')}
              className={`h-8 rounded-full px-3.5 text-[13px] font-semibold transition ${
                sessionType === 'backtesting'
                  ? 'bg-[#1c1d22] text-white'
                  : 'text-[#7c808d] hover:text-white'
              }`}
            >
              بک‌تست
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sessionType === 'prop'}
              onClick={() => {
                if (!access.prop) return openPlanPrompt(requiresPlan('جلسه پراپ', 'mid'));
                setError(null);
                setType('prop');
              }}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full ps-3.5 pe-2 text-[13px] font-semibold transition ${
                sessionType === 'prop'
                  ? 'bg-[#1c1d22] text-white'
                  : 'text-[#7c808d] hover:text-white'
              }`}
            >
              <span>پراپ</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#102042] px-2 py-0.5 text-[11px] font-semibold text-[#4785ff]">
                <Icon name="bolt" size={11} className="fill-current" />
                متوسط
              </span>
            </button>
          </div>
          <div className="flex-1" />
          <div className="relative hidden sm:block">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={presetOpen}
              onClick={() => setPresetOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[#23252c] bg-[#16171b] px-3.5 text-[12.5px] font-medium text-[#7c808d] transition hover:border-[#2f323c] hover:text-[#c5cad6]"
            >
              <span>بدون پیش‌فرض</span>
              <Icon name="chevronDown" size={14} />
            </button>
            {presetOpen ? (
              <div className="absolute end-0 top-full z-20 mt-1.5 w-48 rounded-xl border border-[#23252c] bg-[#141519] p-2.5 text-[12px] text-[#7c808d] shadow-2xl">
                هنوز پیش‌فرضی ذخیره نشده است.
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="بستن"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#7c808d] transition hover:bg-[#16171b] hover:text-white"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      }
      footer={
        <>
          {error ? (
            <p className="min-w-0 flex-1 text-[12.5px] text-[#ff6b81]" role="alert">
              {error}
            </p>
          ) : (
            <div className="flex-1" />
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-[14px] font-semibold text-[#e5e7eb] transition hover:text-white"
          >
            انصراف
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            data-testid="create-session-submit"
            className="h-10 rounded-full bg-[#0d59f2] px-6 text-[14px] font-semibold text-white transition hover:bg-[#1e68ff] disabled:opacity-40"
          >
            {busy ? 'در حال ساخت…' : 'ساخت جلسه'}
          </button>
        </>
      }
    >
      <div className="flex min-h-[520px] flex-col sm:flex-row">
        <nav className="flex shrink-0 gap-1.5 border-b border-[#1e2026] p-4 sm:w-[236px] sm:flex-col sm:border-b-0 sm:border-e">
          <SectionTab
            active={section === 'basics'}
            title="پایه"
            text="نام، موجودی، نماد، قالب و تاریخ‌ها"
            onClick={() => setSection('basics')}
          />
          <SectionTab
            active={section === 'more'}
            title="گزینه‌های بیشتر"
            text={
              sessionType === 'prop'
                ? 'اسپرد و کارمزد، اهرم، مارجین و قوانین پراپ'
                : 'اسپرد و کارمزد، اهرم، مارجین و اسلیپیج'
            }
            onClick={() => setSection('more')}
          />
        </nav>
        <div className="min-w-0 flex-1 space-y-5 p-5 text-[13.5px] text-white sm:p-6">
          {section === 'basics' ? (
            <>
              {historyLimited ? (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#14357a] bg-[#0b1326] px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-white">
                      تاریخ جلسه تا یک ماه گذشتهٔ بازار.
                    </p>
                    <p className="mt-1 text-[12.5px] leading-6 text-[#8a8f9e]">
                      طرح مبتدی فقط یک ماه آخر بازار را باز می‌کند. تاریخ‌های قدیمی‌تر برای طرح
                      متوسط و بالاتر است.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openPlanPrompt(requiresPlan('تاریخ قبل از یک ماه گذشتهٔ بازار', 'mid'))
                    }
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#0d59f2] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1e68ff]"
                  >
                    ارتقا
                  </button>
                </div>
              ) : null}

              <label className="block space-y-2">
                <FieldLabel required>نام جلسه</FieldLabel>
                <input
                  aria-label="نام جلسه"
                  aria-invalid={nameMissing}
                  className={`${field} ${nameMissing ? 'border-[#ff6b81] focus:border-[#ff6b81]' : ''}`}
                  placeholder="نام جلسه را بنویسید"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                />
                {nameMissing ? (
                  <p className="text-[12px] text-[#ff6b81]">این فیلد لازم است</p>
                ) : null}
              </label>

              <div className="space-y-2">
                <FieldLabel required>موجودی حساب</FieldLabel>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1e2026] bg-[#0b0c0e] p-2.5">
                  {BALANCE_PRESETS.map((p) => {
                    const on = !customOn && balanceValue === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        dir="ltr"
                        aria-pressed={on}
                        onClick={() => {
                          if (!access.customBalance && p.value !== STANDARD_BALANCE) {
                            return openPlanPrompt(requiresPlan('موجودی دلخواه', 'mid'));
                          }
                          setError(null);
                          setCustomBalance(false);
                          setBalance(p.value);
                        }}
                        className={`h-9 min-w-[4.75rem] rounded-lg px-4 text-[13px] font-semibold transition ${
                          on
                            ? 'border border-[#1d5eff] bg-[#0d1528] text-[#4285ff]'
                            : 'border border-[#262830] bg-[#17181c] text-[#e5e7eb] hover:border-[#343742] hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={customOn}
                    onClick={() => {
                      if (!access.customBalance)
                        return openPlanPrompt(requiresPlan('موجودی دلخواه', 'mid'));
                      setError(null);
                      setCustomBalance(true);
                    }}
                    className={`h-9 min-w-[4.75rem] rounded-lg px-4 text-[13px] font-semibold transition ${
                      customOn
                        ? 'border border-[#1d5eff] bg-[#0d1528] text-[#4285ff]'
                        : 'border border-[#262830] bg-[#17181c] text-[#e5e7eb] hover:border-[#343742] hover:text-white'
                    }`}
                  >
                    دلخواه
                  </button>
                </div>
                {customOn ? (
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
                ) : null}
              </div>

              <div className="space-y-2">
                <FieldLabel>استراتژی</FieldLabel>
                {access.strategyTags === 0 ? (
                  <LockedUpgrade message={requiresPlan('برچسب استراتژی', 'mid')} plan="mid" />
                ) : (
                  <StrategyField inputRef={strategyInputRef} value={tag} onChange={setTag} />
                )}
                {access.strategyTags === 0 ? null : (
                  <button
                    type="button"
                    onClick={() => strategyInputRef.current?.focus()}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-[#2f74ff] transition hover:text-[#528bff]"
                  >
                    <span>+ ساخت استراتژی جدید</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <FieldLabel required>نماد</FieldLabel>
                  <span className="text-[12.5px] text-[#7c808d]">درخواست نماد</span>
                </div>
                <SymbolField
                  instruments={instruments}
                  symbol={symbolValue}
                  plan={plan}
                  onChange={setSymbol}
                  onLocked={(next) => {
                    const message = symbolDenial(plan, next);
                    if (message) openPlanPrompt(message);
                  }}
                />
                <p className="text-[12px] leading-6 text-[#7c808d]">
                  هر لات {faNum(spec.contractSize, 0)} واحد، پیپ {faNum(spec.pipSize)}، حجم{' '}
                  {faNum(spec.lotMin)} تا {faNum(spec.lotMax)} لات.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <FieldLabel required>تاریخ شروع</FieldLabel>
                  <JalaliDateField
                    ariaLabel="تاریخ شروع"
                    className={dateField}
                    value={shownStart}
                    min={toDateInput(earliest)}
                    max={toDateInput(lastDay)}
                    onChange={setStart}
                    onBlocked={
                      historyLimited
                        ? () =>
                            openPlanPrompt(
                              requiresPlan('تاریخ قبل از یک ماه گذشتهٔ بازار', 'mid'),
                            )
                        : undefined
                    }
                  />
                </label>
                <label className="block space-y-2">
                  <FieldLabel required>تاریخ پایان</FieldLabel>
                  <JalaliDateField
                    ariaLabel="تاریخ پایان"
                    className={dateField}
                    value={shownEnd}
                    min={shownStart}
                    max={toDateInput(lastDay)}
                    onChange={setEnd}
                  />
                </label>
              </div>
              <p className="-mt-2 text-[12px] leading-6 text-[#7c808d]">
                {days > 0 ? `${faNum(days)} روز` : ''}
                {' · '}
                داده از {utcDate(range.start)} تا {utcDate(lastDay)}.
                {historyLimited ? ` در این طرح از ${utcDate(earliest)} به بعد.` : ''} تاریخ شمسی است
                و ساعت جلسه، ساعت جهانی می‌ماند.
              </p>
            </>
          ) : (
            <>
              <CostRow
                label="اسپرد"
                hint={`${faNum(spread / spec.pipSize, 1)} پیپ، واحد قیمت`}
                on={spreadEnabled}
                onToggle={(on) => {
                  if (on && !access.spread) return openPlanPrompt(requiresPlan('اسپرد', 'mid'));
                  setSpreadOn(on);
                }}
                valueLabel="اسپرد"
                value={spread}
                step={spec.tickSize}
                onValue={setSpread}
              />
              <CostRow
                label="کارمزد"
                hint="دلار برای هر لات، هم ورود و هم خروج"
                on={commissionEnabled}
                onToggle={(on) => {
                  if (on && !access.commission)
                    return openPlanPrompt(requiresPlan('کارمزد', 'mid'));
                  setCommOn(on);
                }}
                valueLabel="کارمزد هر لات"
                value={comm}
                step={0.5}
                onValue={setComm}
              />
              {sessionType === 'prop' ? (
                <fieldset className="space-y-3">
                  <legend className="text-[13px] font-semibold">قوانین پراپ</legend>
                  <p className="text-[12px] leading-6 text-[#7c808d]">درصد موجودی شروع.</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ['profitTargetPct', 'هدف سود'],
                        ['maxDailyLossPct', 'سقف ضرر روزانه'],
                        ['maxTotalLossPct', 'سقف ضرر کل'],
                      ] as const
                    ).map(([k, label]) => (
                      <label key={k} className="block space-y-1.5">
                        <span className="text-[12px] text-[#7c808d]">{label}</span>
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
              <label className="block space-y-2">
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

/** Keeps a session inside the plan's market window. A date before that window snaps to the window's edge. */
function fitHistory(
  start: string,
  end: string,
  minMs: number,
  maxMs: number,
): { readonly start: string; readonly end: string } {
  const s = fromDateInput(start);
  const e = fromDateInput(end);
  const startMs = Math.min(maxMs, Math.max(minMs, s ?? minMs));
  const endRaw = e === null || e < minMs ? maxMs : e;
  const endMs = Math.min(maxMs, Math.max(startMs, endRaw));
  return { start: toDateInput(startMs), end: toDateInput(endMs) };
}

function StrategyField({
  inputRef,
  value,
  onChange,
}: {
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const filtered = STRATEGY_SUGGESTIONS.filter((s) => !q || s.toLowerCase().includes(q));

  return (
    <div className="relative">
      <input
        ref={inputRef}
        aria-label="برچسب استراتژی"
        placeholder="انتخاب استراتژی یا ساخت استراتژی جدید"
        className={`${field} pe-9`}
        value={value}
        maxLength={40}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      <Icon
        name="chevronDown"
        size={15}
        className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-[#7c808d]"
      />
      {open && filtered.length > 0 ? (
        <ul
          role="listbox"
          aria-label="استراتژی‌ها"
          className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded-xl border border-[#23252c] bg-[#141519] py-1 shadow-2xl"
        >
          {filtered.map((item) => (
            <li key={item} role="option" aria-selected={item === value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(item);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3.5 py-2 text-start text-[13px] transition ${
                  item === value
                    ? 'bg-[#1c1e26] text-white'
                    : 'text-[#9aa3b5] hover:bg-[#181a20] hover:text-white'
                }`}
              >
                <span>{item}</span>
                {item === value ? <Icon name="check" size={14} className="text-[#2f74ff]" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function LockedUpgrade({ message, plan }: { readonly message: string; readonly plan: PlanId }) {
  return (
    <button
      type="button"
      onClick={() => openPlanPrompt(message)}
      className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#23252c] bg-[#0b0c0e] px-3.5 text-start"
    >
      <span className="inline-flex min-w-0 items-center gap-2 text-[13px] text-[#7c808d]">
        <Icon name="lock" size={14} className="shrink-0" />
        <span className="truncate">{message}</span>
      </span>
      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[#102042] px-2.5 text-[11px] font-semibold text-[#4785ff]">
        ارتقا به {PLAN_LABEL[plan]}
      </span>
    </button>
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
    <span className="text-[13px] font-medium text-[#d1d5db]">
      {children}
      {required ? <span className="text-[#ef4444]"> *</span> : null}
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
      className={`rounded-xl px-4 py-3.5 text-start transition ${
        active ? 'bg-[#17181c]' : 'hover:bg-[#17181c]/55'
      }`}
    >
      <span className={`block text-[14.5px] font-bold ${active ? 'text-white' : 'text-[#d1d5db]'}`}>
        {title}
      </span>
      <span className="mt-1 block text-[12px] leading-5 text-[#7c808d]">{text}</span>
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
    <div className="space-y-2 rounded-xl border border-[#1e2026] bg-[#111216] p-4">
      <div className="flex items-center justify-between gap-3">
        <span>
          <span className="block font-medium text-white">{label}</span>
          <span className="text-[12px] text-[#7c808d]">{hint}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          onClick={() => onToggle(!on)}
          className={`flex h-6 w-11 shrink-0 rounded-full p-0.5 transition ${
            on ? 'justify-end bg-[#0d59f2]' : 'justify-start bg-[#23252c]'
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
