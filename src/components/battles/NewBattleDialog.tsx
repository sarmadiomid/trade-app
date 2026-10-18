'use client';

import { useState } from 'react';
import {
  BATTLE_ASSETS,
  BATTLE_SPEEDS,
  DEFAULT_SETTINGS,
  MAX_ASSETS,
  MAX_DURATION,
  MAX_PARTICIPANTS,
  MIN_DURATION,
  MIN_PARTICIPANTS,
  STARTING_BALANCES,
  WIN_CONDITIONS,
  marketSpanMs,
  MAX_MARKET_SPAN_MS,
  normalizeSettings,
  validateBattleSettings,
  type BattleSettings,
  type WinCondition,
} from '@/lib/battles';
import { faNum } from '@/lib/locale/jalali';
import { api } from '../platform/api';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';
import { duration } from '../backtest/format';
import { ASSET_COLORS, WIN_FA, compactMoney, faMessage, minutes } from './format';

const STEPS = ['نوع نبرد', 'بازار', 'قانون‌ها', 'بازبینی'] as const;

const field =
  'h-9 w-full rounded-lg border border-line bg-chart px-3 text-[13px] outline-none focus:border-accent';

/** "New Battle": a four-step setup (type → market & account → rules → review). */
export function NewBattleDialog({
  hostName,
  onClose,
  onCreated,
}: {
  readonly hostName: string;
  readonly onClose: () => void;
  readonly onCreated: (id: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [s, setS] = useState<BattleSettings>({ ...DEFAULT_SETTINGS, name: `نبرد ${hostName}` });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<BattleSettings>) => {
    setS((prev) => ({ ...prev, ...patch }));
    setError(null);
  };

  const stepError = (i: number): string | null => {
    if (i === 0) return s.name.trim() ? null : faMessage('Battle name is required');
    if (i === 1) {
      if (s.assets.length === 0) return faMessage('Pick at least one asset');
      if (marketSpanMs(s) > MAX_MARKET_SPAN_MS) return faMessage('Lower the duration or the speed');
      return null;
    }
    if (i === 2) {
      const e = validateBattleSettings(normalizeSettings(s));
      return e ? faMessage(e) : null;
    }
    return null;
  };

  const next = () => {
    const e = stepError(step);
    if (e) return setError(e);
    setStep((x) => Math.min(STEPS.length - 1, x + 1));
  };

  const create = async () => {
    const settings = normalizeSettings(s);
    const e = validateBattleSettings(settings);
    if (e) return setError(faMessage(e));
    setBusy(true);
    try {
      const r = await api<{ id: string }>('/api/battles', { method: 'POST', body: { settings } });
      onCreated(r.id);
    } catch (err) {
      setError(err instanceof Error ? faMessage(err.message) : faMessage('Could not create the battle'));
      setBusy(false);
    }
  };

  const toggleAsset = (a: string) => {
    const has = s.assets.includes(a);
    if (!has && s.assets.length >= MAX_ASSETS)
      return setError(faMessage(`Pick at most ${MAX_ASSETS} assets`));
    set({ assets: has ? s.assets.filter((x) => x !== a) : [...s.assets, a] });
  };

  return (
    <Dialog
      title="نبرد تازه"
      onClose={onClose}
      width={600}
      initialFocus="#battle-name"
      footer={
        <>
          {step > 0 ? (
            <Button onClick={() => setStep((x) => x - 1)}>
              <Icon name="chevronLeft" size={15} className="rtl:-scale-x-100" /> بازگشت
            </Button>
          ) : null}
          <div className="flex-1 text-[12px] text-down" role="alert">
            {error}
          </div>
          <Button onClick={onClose}>لغو</Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={next} data-testid="battle-next">
              بعد <Icon name="chevronRight" size={15} className="rtl:-scale-x-100" />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => void create()}
              disabled={busy}
              data-testid="battle-create"
            >
              {busy ? 'در حال ساخت…' : 'ساخت نبرد'}
            </Button>
          )}
        </>
      }
    >
      <ol className="flex items-center gap-2 border-b border-line px-5 py-3">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                i < step
                  ? 'bg-up text-white'
                  : i === step
                    ? 'bg-accent text-accent-fg'
                    : 'bg-hover text-muted'
              }`}
            >
              {i < step ? <Icon name="check" size={13} strokeWidth={2.4} /> : faNum(i + 1)}
            </span>
            <span
              className={`hidden text-[12px] sm:inline ${i === step ? 'font-semibold' : 'text-muted'}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 ? <span className="h-px flex-1 bg-line" /> : null}
          </li>
        ))}
      </ol>
      <div className="max-h-[60vh] overflow-y-auto p-5 text-[13px]">
        {step === 0 ? (
          <div className="flex flex-col gap-5">
            <label className="block">
              <span className="mb-1.5 block font-medium">نام نبرد</span>
              <input
                id="battle-name"
                value={s.name}
                maxLength={50}
                onChange={(e) => set({ name: e.target.value })}
                className={field}
                data-testid="battle-name-input"
              />
            </label>
            <div>
              <span className="mb-1.5 block font-medium">نوع نبرد</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(WIN_CONDITIONS) as WinCondition[]).map((w) => (
                  <Choice
                    key={w}
                    selected={s.winCondition === w}
                    onClick={() =>
                      set({
                        winCondition: w,
                        profitTargetPct: w === 'profit-target' ? (s.profitTargetPct ?? 5) : null,
                      })
                    }
                    icon={w === 'time-trial' ? 'clock' : 'target'}
                    title={WIN_FA[w].name}
                    text={
                      w === 'time-trial'
                        ? 'همه تا پایان زمان معامله می‌کنند. بیشترین بازده برنده است.'
                        : 'اولین کسی که معامله را روی هدف سود ببندد برنده است. اگر کسی نرسد، بیشترین بازده برنده می‌شود.'
                    }
                    testId={`type-${w}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block font-medium">نمایش</span>
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice
                  selected={s.visibility === 'public'}
                  onClick={() => set({ visibility: 'public' })}
                  icon="globe"
                  title="عمومی"
                  text="در فهرست نبردهای عمومی دیده می‌شود و هر معامله‌گری می‌تواند بپیوندد."
                />
                <Choice
                  selected={s.visibility === 'private'}
                  onClick={() => set({ visibility: 'private' })}
                  icon="lock"
                  title="خصوصی"
                  text="در فهرست نیست. ورود فقط با شناسه نبرد یا لینک دعوت تو ممکن است."
                  testId="visibility-private"
                />
              </div>
            </div>
            <p className="rounded-lg bg-hover/60 px-3 py-2 text-[12px] text-muted">
              نبرد سفارشی آزاد است: امتیاز ترکیبی می‌دهد، ولی الو را عوض نمی‌کند.
            </p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-5">
            <div>
              <span className="mb-1.5 flex items-baseline justify-between font-medium">
                نمادها
                <span className="text-[11.5px] font-normal text-muted">
                  {faNum(s.assets.length)}/{faNum(MAX_ASSETS)} · بازار موقع شروع از بین همین‌ها کشیده می‌شود
                </span>
              </span>
              <div className="flex flex-wrap gap-2">
                {BATTLE_ASSETS.map((a) => {
                  const on = s.assets.includes(a);
                  const color = ASSET_COLORS[a] ?? '#5b8cff';
                  return (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleAsset(a)}
                      className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 font-semibold transition ${
                        on ? 'border-accent bg-accent/10' : 'border-line hover:bg-hover'
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                      <bdi dir="ltr">{a}</bdi>
                      {on ? <Icon name="check" size={13} /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block font-medium">موجودی اولیه</span>
              <div className="flex flex-wrap gap-2">
                {STARTING_BALANCES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={s.startingBalance === b}
                    onClick={() => set({ startingBalance: b })}
                    className={`h-9 rounded-lg border px-3 font-semibold tabular-nums transition ${
                      s.startingBalance === b
                        ? 'border-accent bg-accent/10'
                        : 'border-line hover:bg-hover'
                    }`}
                  >
                    {compactMoney(b)}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1.5 flex items-baseline justify-between font-medium">
                مدت
                <span className="text-[13px] font-semibold tabular-nums">{minutes(s.durationMin)}</span>
              </span>
              <input
                type="range"
                min={MIN_DURATION}
                max={MAX_DURATION}
                value={s.durationMin}
                onChange={(e) => set({ durationMin: Number(e.target.value) })}
                className="w-full"
                aria-label="مدت به دقیقه"
                data-testid="duration"
              />
              <span className="flex justify-between text-[11px] text-muted">
                <span>{minutes(MIN_DURATION)}</span>
                <span>{minutes(MAX_DURATION)}</span>
              </span>
            </label>
            <div>
              <span className="mb-1.5 block font-medium">سرعت بازپخش</span>
              <div className="grid grid-cols-3 gap-2">
                {BATTLE_SPEEDS.map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    aria-pressed={s.speed === sp}
                    onClick={() => set({ speed: sp })}
                    className={`rounded-lg border px-3 py-2 text-start transition ${
                      s.speed === sp ? 'border-accent bg-accent/10' : 'border-line hover:bg-hover'
                    }`}
                  >
                    <span className="block font-semibold tabular-nums">{faNum(sp)}×</span>
                    <span className="block text-[11px] text-muted">
                      هر کندل یک‌دقیقه‌ای، {faNum(60 / sp)} ثانیه
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11.5px] text-muted">
                {duration(marketSpanMs(s))} از تاریخ بازار بازپخش می‌شود.
              </p>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            {s.winCondition === 'profit-target' ? (
              <NumberRow
                label="هدف سود"
                hint="معامله را روی این سود ببند تا ببری"
                value={s.profitTargetPct}
                suffix="%"
                step={0.5}
                onChange={(v) => set({ profitTargetPct: v })}
                required
              />
            ) : null}
            <NumberRow
              label="حداکثر افت"
              hint="از موجودی اولیه؛ رد شدن از آن یعنی حذف"
              value={s.maxDrawdownPct}
              suffix="%"
              step={0.5}
              onChange={(v) => set({ maxDrawdownPct: v })}
            />
            <NumberRow
              label="حداکثر افت روزانه"
              hint="ضرر در یک روز بازار"
              value={s.maxDailyDrawdownPct}
              suffix="%"
              step={0.5}
              onChange={(v) => set({ maxDailyDrawdownPct: v })}
            />
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
              <span>
                <span className="block font-medium">سقف نفرات</span>
                <span className="block text-[11.5px] text-muted">
                  {faNum(MIN_PARTICIPANTS)} تا {faNum(MAX_PARTICIPANTS)} معامله‌گر
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Step
                  label="کمتر"
                  icon="minus"
                  onClick={() =>
                    set({ maxParticipants: Math.max(MIN_PARTICIPANTS, s.maxParticipants - 1) })
                  }
                />
                <span className="w-8 text-center text-[15px] font-bold tabular-nums">
                  {faNum(s.maxParticipants)}
                </span>
                <Step
                  label="بیشتر"
                  icon="plus"
                  onClick={() =>
                    set({ maxParticipants: Math.min(MAX_PARTICIPANTS, s.maxParticipants + 1) })
                  }
                />
              </span>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
              <span>
                <span className="block font-medium">ورود در حین نبرد</span>
                <span className="block text-[11.5px] text-muted">
                  معامله‌گرها می‌توانند بعد از شروع هم بپیوندند
                </span>
              </span>
              <input
                type="checkbox"
                checked={s.allowLateJoin}
                onChange={(e) => set({ allowLateJoin: e.target.checked })}
                className="h-4 w-4 accent-[var(--tc-accent)]"
              />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <dl className="divide-y divide-line rounded-xl border border-line">
            {(
              [
                ['نام', s.name.trim()],
                ['نوع نبرد', WIN_FA[s.winCondition].name],
                ['نمایش', s.visibility === 'public' ? 'عمومی' : 'خصوصی'],
                ['نمادها', s.assets.join('، ')],
                ['موجودی اولیه', compactMoney(s.startingBalance)],
                ['مدت', `${minutes(s.durationMin)} با سرعت ${faNum(s.speed)}×`],
                [
                  'هدف سود',
                  s.winCondition === 'profit-target' && s.profitTargetPct !== null
                    ? `${faNum(s.profitTargetPct)}٪`
                    : 'تعیین نشده',
                ],
                ['حداکثر افت', s.maxDrawdownPct === null ? 'تعیین نشده' : `${faNum(s.maxDrawdownPct)}٪`],
                [
                  'حداکثر افت روزانه',
                  s.maxDailyDrawdownPct === null ? 'تعیین نشده' : `${faNum(s.maxDailyDrawdownPct)}٪`,
                ],
                ['نفرات', `تا ${faNum(s.maxParticipants)} نفر`],
                ['ورود دیرهنگام', s.allowLateJoin ? 'مجاز' : 'غیرمجاز'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-4 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="text-end font-medium" dir={k === 'نمادها' ? 'ltr' : undefined}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </Dialog>
  );
}

function Choice({
  selected,
  onClick,
  icon,
  title,
  text,
  testId,
}: {
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly icon: IconName;
  readonly title: string;
  readonly text: string;
  readonly testId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      data-testid={testId}
      className={`flex gap-3 rounded-xl border p-3 text-start transition ${
        selected ? 'border-accent bg-accent/10' : 'border-line hover:bg-hover'
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          selected ? 'bg-accent text-accent-fg' : 'bg-hover text-muted'
        }`}
      >
        <Icon name={icon} size={16} />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-5 text-muted">{text}</span>
      </span>
    </button>
  );
}

function NumberRow({
  label,
  hint,
  value,
  suffix,
  step,
  onChange,
  required = false,
}: {
  readonly label: string;
  readonly hint: string;
  readonly value: number | null;
  readonly suffix: string;
  readonly step: number;
  readonly onChange: (v: number | null) => void;
  readonly required?: boolean;
}) {
  const on = value !== null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block text-[11.5px] text-muted">{hint}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {!required ? (
          <label className="flex items-center gap-1.5 text-[12px] text-muted">
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => onChange(e.target.checked ? 5 : null)}
              className="h-4 w-4 accent-[var(--tc-accent)]"
              aria-label={`${label} را تعیین کن`}
            />
            {on ? 'فعال' : 'خاموش'}
          </label>
        ) : null}
        {on ? (
          <span className="flex items-center rounded-lg border border-line bg-chart">
            <input
              type="number"
              min={0.1}
              max={100}
              step={step}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
              aria-label={label}
              dir="ltr"
              className="h-8 w-16 bg-transparent px-2 text-end tabular-nums outline-none"
            />
            <span className="pe-2 text-muted">{suffix === '%' ? '٪' : suffix}</span>
          </span>
        ) : null}
      </span>
    </div>
  );
}

function Step({
  label,
  icon,
  onClick,
}: {
  readonly label: string;
  readonly icon: IconName;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line hover:bg-hover"
    >
      <Icon name={icon} size={14} />
    </button>
  );
}
