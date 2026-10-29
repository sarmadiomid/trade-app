'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { Candle, TimeframeId } from '@/lib/core';
import {
  MAX_IMPORT_BARS,
  parseCandleCsv,
  timeframeFromPath,
  toTuples,
  type AssetClass,
  type HourPreset,
  type InstrumentDraft,
} from '@/lib/data';
import { faNum, formatJalaliDateTime } from '@/lib/locale/jalali';
import { ApiError, api } from '@/components/platform/api';
import { PageHead, Panel, fieldClass, labelClass } from './ui';

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

interface SymbolRow {
  readonly symbol: string;
  readonly description: string;
  readonly assetClass: string;
  readonly source: 'builtin' | 'custom';
  readonly active: boolean;
  readonly timeframe: TimeframeId | null;
  readonly barCount: number;
  readonly dataStart: number | null;
  readonly dataEnd: number | null;
  readonly practiceReady: boolean;
}

interface StoredSeries {
  readonly timeframe: TimeframeId;
  readonly barCount: number;
  readonly dataStart: number;
  readonly dataEnd: number;
}

interface SymbolDetail extends SymbolRow {
  readonly draft: InstrumentDraft | null;
  readonly preview: Candle[];
  readonly series: readonly StoredSeries[];
}

interface ReadyFile {
  readonly name: string;
  readonly timeframe: TimeframeId;
  readonly bars: Candle[];
}

type OpenMode = 'open' | 'refresh' | 'saved';
type ListFilter = 'all' | 'custom' | 'builtin';
type Dialog =
  { readonly kind: 'delete' } | { readonly kind: 'discard'; readonly proceed: () => void };
type Errors = Partial<Record<keyof InstrumentDraft, string>>;

const ASSETS: ReadonlyArray<{ id: AssetClass; label: string }> = [
  { id: 'forex', label: 'فارکس' },
  { id: 'metals', label: 'فلزات' },
  { id: 'indices', label: 'شاخص' },
  { id: 'crypto', label: 'رمزارز' },
];

const HOURS: ReadonlyArray<{ id: HourPreset; label: string }> = [
  { id: 'forex', label: 'فارکس، بدون وقفه روزانه' },
  { id: 'metals', label: 'فلزات، وقفه ۲۱ تا ۲۲' },
  { id: 'indices', label: 'شاخص، مثل فلزات' },
  { id: 'crypto', label: 'شبانه‌روزی' },
];

const TIMEFRAMES: TimeframeId[] = ['1m', '5m', '15m', '1h', '4h', '1D'];

const EMPTY: InstrumentDraft = {
  symbol: '',
  description: '',
  baseCurrency: '',
  quoteCurrency: 'USD',
  assetClass: 'forex',
  hours: 'forex',
  tickSize: 0.00001,
  pipSize: 0.0001,
  contractSize: 100000,
  lotMin: 0.01,
  lotStep: 0.01,
  lotMax: 100,
  defaultSpread: 0.0001,
  defaultCommissionPerLot: 0,
  active: true,
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b78ff]/60';
const FOCUS_RING_INSET = `${FOCUS_RING} focus-visible:ring-inset`;
const INVALID = '!border-[#ff6b81]/60';

const BTN_PRIMARY = `inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--a-accent)] px-5 text-[13.5px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(59,120,255,0.8)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:active:scale-100 ${FOCUS_RING}`;
const BTN_GHOST = `inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[13.5px] font-medium text-[#c9d3ea] transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING}`;
const BTN_DANGER = `inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#ff6b81]/35 px-4 text-[13.5px] font-medium text-[#ffb3bf] transition hover:bg-[#ff6b81]/10 disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING}`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'انجام نشد';
}

function sameDraft(a: InstrumentDraft, b: InstrumentDraft): boolean {
  return (Object.keys(a) as Array<keyof InstrumentDraft>).every((key) => Object.is(a[key], b[key]));
}

/** Accept Persian / Arabic-Indic digits and separators in numeric fields. */
function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫]/g, '.')
    .replace(/[٬،,\s]/g, '');
}

const POSITIVE_KEYS = [
  'tickSize',
  'pipSize',
  'contractSize',
  'lotMin',
  'lotStep',
  'lotMax',
] as const;
const NON_NEGATIVE_KEYS = ['defaultSpread', 'defaultCommissionPerLot'] as const;

function validate(draft: InstrumentDraft): Errors {
  const errors: Errors = {};
  if (!draft.symbol.trim()) errors.symbol = 'نام نماد لازم است';
  for (const key of POSITIVE_KEYS) {
    const value = draft[key];
    if (!(Number.isFinite(value) && value > 0)) errors[key] = 'یک عدد بزرگ‌تر از صفر وارد کنید';
  }
  for (const key of NON_NEGATIVE_KEYS) {
    const value = draft[key];
    if (!(Number.isFinite(value) && value >= 0)) errors[key] = 'عدد صفر یا بیشتر وارد کنید';
  }
  if (!errors.lotMin && !errors.lotMax && draft.lotMin > draft.lotMax) {
    errors.lotMax = 'سقف لات از حداقل لات کمتر است';
  }
  return errors;
}

function mergeReady(files: readonly ReadyFile[]): ReadyFile[] {
  const byTimeframe = new Map<TimeframeId, ReadyFile>();
  for (const file of files) {
    const prev = byTimeframe.get(file.timeframe);
    if (!prev) {
      byTimeframe.set(file.timeframe, file);
      continue;
    }
    byTimeframe.set(file.timeframe, {
      name: `${prev.name} + ${file.name}`,
      timeframe: file.timeframe,
      bars: [...prev.bars, ...file.bars].sort((a, b) => a.time - b.time),
    });
  }
  return [...byTimeframe.values()];
}

function usePortalTarget(): HTMLElement | null {
  return useSyncExternalStore(
    () => () => {},
    () => document.body,
    () => null,
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconName =
  | 'plus'
  | 'search'
  | 'close'
  | 'upload'
  | 'folder'
  | 'file'
  | 'trash'
  | 'check'
  | 'alert'
  | 'info'
  | 'lock'
  | 'save'
  | 'undo'
  | 'chart';

const ICONS: Record<IconName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  upload: (
    <>
      <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  folder: (
    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2.5h8.5A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" />
  ),
  file: (
    <>
      <path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z" />
      <path d="M14 3v4.5h4.5" />
    </>
  ),
  trash: <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <path d="M12 4 3 19.5h18z" />
      <path d="M12 10v4.5M12 17.2h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  save: (
    <>
      <path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </>
  ),
  undo: (
    <>
      <path d="M9 7 4.5 11.5 9 16" />
      <path d="M4.5 11.5H14a5 5 0 0 1 0 10h-3" />
    </>
  ),
  chart: <path d="M4 18V9M9 18V5M14 18v-6M19 18V8" />,
};

function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICONS[name]}
    </svg>
  );
}

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.22" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.06] ${className}`} />;
}

/* ------------------------------------------------------------------ */
/* Overlays: toasts and confirm dialog                                 */
/* ------------------------------------------------------------------ */

function Toasts({
  error,
  notice,
  onCloseError,
  onCloseNotice,
}: {
  readonly error: string;
  readonly notice: string;
  readonly onCloseError: () => void;
  readonly onCloseNotice: () => void;
}) {
  const portal = usePortalTarget();
  if (!portal || (!error && !notice)) return null;
  const toast = (tone: 'ok' | 'bad', text: string, onClose: () => void) => (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-6 shadow-2xl shadow-black/50 backdrop-blur ${
        tone === 'bad'
          ? 'border-[#ff6b81]/35 bg-[#2a1018]/95 text-[#ffc2cc]'
          : 'border-[#3ecf8e]/30 bg-[#0e2219]/95 text-[#a6f0cb]'
      }`}
    >
      <Icon name={tone === 'bad' ? 'alert' : 'check'} className="mt-1 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{text}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="بستن پیام"
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg opacity-70 transition hover:bg-white/10 hover:opacity-100 ${FOCUS_RING}`}
      >
        <Icon name="close" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
  return createPortal(
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-md flex-col gap-2">
      {error ? toast('bad', error, onCloseError) : null}
      {notice ? toast('ok', notice, onCloseNotice) : null}
    </div>,
    portal,
  );
}

function ConfirmDialog({
  title,
  text,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  readonly title: string;
  readonly text: string;
  readonly confirmLabel: string;
  readonly danger?: boolean;
  readonly busy?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const portal = usePortalTarget();
  const titleId = useId();
  const textId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelFn = useRef(onCancel);

  useEffect(() => {
    cancelFn.current = onCancel;
  });

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') cancelFn.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!portal) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        dir="rtl"
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f1420] p-5 shadow-2xl shadow-black/60"
      >
        <span
          className={`grid h-11 w-11 place-items-center rounded-full ring-1 ${
            danger
              ? 'bg-[#ff6b81]/12 text-[#ff97a7] ring-[#ff6b81]/25'
              : 'bg-[#f5b544]/12 text-[#f7c46a] ring-[#f5b544]/25'
          }`}
        >
          <Icon name={danger ? 'trash' : 'alert'} className="h-5 w-5" />
        </span>
        <h3 id={titleId} className="mt-4 text-[16px] font-semibold">
          {title}
        </h3>
        <p id={textId} className="mt-1.5 text-[13.5px] leading-7 text-[var(--a-muted)]">
          {text}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`${danger ? 'bg-[#e5484d] text-white shadow-[0_6px_18px_-8px_rgba(229,72,77,0.9)]' : 'bg-[var(--a-accent)] text-white'} inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold transition hover:brightness-110 disabled:opacity-50 ${FOCUS_RING}`}
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </button>
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`${BTN_GHOST} flex-1`}
          >
            انصراف
          </button>
        </div>
      </div>
    </div>,
    portal,
  );
}

/* ------------------------------------------------------------------ */
/* Small shared UI                                                     */
/* ------------------------------------------------------------------ */

function StatusBadge({ row }: { readonly row: SymbolRow }) {
  let label: string;
  let tone: string;
  if (row.source === 'builtin') {
    label = 'داخلی';
    tone = 'border-white/10 bg-white/[0.05] text-[#b9c6e4]';
  } else if (row.practiceReady) {
    label = 'آماده تمرین';
    tone = 'border-[#3ecf8e]/30 bg-[#3ecf8e]/10 text-[#8ef0cf]';
  } else if (row.barCount > 0) {
    label = 'ذخیره شده';
    tone = 'border-[#f5b544]/30 bg-[#f5b544]/10 text-[#f7c46a]';
  } else {
    label = 'بدون داده';
    tone = 'border-white/10 bg-white/[0.03] text-[var(--a-muted)]';
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {error ? (
        <span
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-5 text-[#ffb3bf]"
        >
          <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-[11.5px] leading-5 text-[var(--a-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

function Num({
  label,
  value,
  hint,
  error,
  attempted,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly attempted: boolean;
  readonly onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [touched, setTouched] = useState(false);
  const showError = error && (touched || attempted) ? error : undefined;
  return (
    <Field label={label} hint={hint} error={showError}>
      <input
        dir="ltr"
        inputMode="decimal"
        value={text}
        aria-invalid={showError ? true : undefined}
        onBlur={() => setTouched(true)}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const cleaned = normalizeDigits(raw);
          const next = Number(cleaned);
          onChange(cleaned !== '' && Number.isFinite(next) ? next : Number.NaN);
        }}
        className={`${fieldClass} ${showError ? INVALID : ''}`}
      />
    </Field>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
  readonly label: string;
  readonly hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-3.5 text-start transition hover:bg-white/[0.04] ${FOCUS_RING}`}
    >
      <span>
        <span className="block text-[13.5px] font-medium">{label}</span>
        <span className="mt-0.5 block text-[12px] text-[var(--a-muted)]">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[#3b78ff]' : 'bg-white/15'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'start-[1.375rem]' : 'start-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: T;
  readonly options: ReadonlyArray<{ id: T; label: string }>;
  readonly onChange: (next: T) => void;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex h-11 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
      >
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.id)}
              className={`flex-1 rounded-lg px-2 text-[12.5px] font-medium transition ${FOCUS_RING} ${
                active
                  ? 'bg-[#3b78ff]/20 text-[#cfdcff] ring-1 ring-[#3b78ff]/40'
                  : 'text-[var(--a-muted)] hover:text-white'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Callout({
  tone,
  children,
}: {
  readonly tone: 'info' | 'warn' | 'ok';
  readonly children: ReactNode;
}) {
  const style =
    tone === 'ok'
      ? 'border-[#3ecf8e]/25 bg-[#3ecf8e]/8 text-[#a6f0cb]'
      : tone === 'warn'
        ? 'border-[#f5b544]/25 bg-[#f5b544]/8 text-[#f7d58f]'
        : 'border-[#3b78ff]/25 bg-[#3b78ff]/8 text-[#b3c8ff]';
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] leading-6 ${style}`}
    >
      <Icon
        name={tone === 'ok' ? 'check' : tone === 'warn' ? 'alert' : 'info'}
        className="mt-1 h-4 w-4 shrink-0"
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Section({
  title,
  hint,
  first = false,
  children,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly first?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div className={first ? '' : 'mt-6 border-t border-[var(--a-line)] pt-5'}>
      <h4 className="text-[13.5px] font-semibold">{title}</h4>
      {hint ? <p className="mt-0.5 text-[12px] text-[var(--a-muted)]">{hint}</p> : null}
      <div className="mt-3.5 grid gap-x-3 gap-y-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Desk                                                                */
/* ------------------------------------------------------------------ */

export function SymbolsDesk() {
  const [rows, setRows] = useState<SymbolRow[]>([]);
  const [selected, setSelected] = useState<string>('new');
  const [detail, setDetail] = useState<SymbolDetail | null>(null);
  const [draft, setDraft] = useState<InstrumentDraft>(EMPTY);
  const [baseline, setBaseline] = useState<InstrumentDraft>(EMPTY);
  const [formVersion, setFormVersion] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ListFilter>('all');
  const requestRef = useRef(0);
  const detailRef = useRef<HTMLDivElement>(null);

  const builtin = rows.find((row) => row.symbol === selected && row.source === 'builtin');
  const dirty = !detailLoading && !builtin && !sameDraft(draft, baseline);

  const scrollToDetail = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openSymbol = async (
    symbol: string,
    list: readonly SymbolRow[] = rows,
    mode: OpenMode = 'open',
  ) => {
    const token = ++requestRef.current;
    const row = list.find((item) => item.symbol === symbol);
    if (mode === 'open') {
      setSelected(symbol);
      setNotice('');
      setError('');
      setDetailError('');
    }
    if (row?.source === 'builtin') {
      setSelected(symbol);
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    if (mode === 'open') {
      setDetail(null);
      setDetailLoading(true);
    }
    try {
      const body = await api<{ symbol: SymbolDetail }>(
        `/api/admin/symbols/${encodeURIComponent(symbol)}`,
      );
      if (token !== requestRef.current) return;
      setDetail(body.symbol);
      if (mode !== 'refresh') {
        const next: InstrumentDraft = body.symbol.draft ?? {
          ...EMPTY,
          symbol: body.symbol.symbol,
          description: body.symbol.description,
        };
        setDraft(next);
        setBaseline(next);
        if (mode === 'open') setFormVersion((v) => v + 1);
      }
    } catch (e) {
      if (token !== requestRef.current) return;
      if (mode === 'open') setDetailError(messageOf(e));
      else setError(messageOf(e));
    } finally {
      if (mode === 'open' && token === requestRef.current) setDetailLoading(false);
    }
  };

  const load = async (keep?: string, mode: OpenMode = 'refresh') => {
    const body = await api<{ symbols: SymbolRow[] }>('/api/admin/symbols');
    setRows(body.symbols);
    if (keep) await openSymbol(keep, body.symbols, mode);
  };

  const loadRows = () => {
    setLoading(true);
    setListError('');
    void api<{ symbols: SymbolRow[] }>('/api/admin/symbols')
      .then((body) => setRows(body.symbols))
      .catch((e: unknown) => setListError(e instanceof Error ? e.message : 'خوانده نشد'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let live = true;
    void api<{ symbols: SymbolRow[] }>('/api/admin/symbols')
      .then((body) => {
        if (live) setRows(body.symbols);
      })
      .catch((e: unknown) => {
        if (live) setListError(e instanceof Error ? e.message : 'خوانده نشد');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  // Success notices fade on their own; errors stay until dismissed.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Warn before closing the tab with unsaved spec changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const guarded = (action: () => void) => {
    if (dirty) setDialog({ kind: 'discard', proceed: action });
    else action();
  };

  const choose = (symbol: string) => {
    if (symbol === selected && !detailError) {
      scrollToDetail();
      return;
    }
    guarded(() => {
      void openSymbol(symbol);
      scrollToDetail();
    });
  };

  const startNew = () =>
    guarded(() => {
      requestRef.current++;
      setSelected('new');
      setDetail(null);
      setDetailLoading(false);
      setDetailError('');
      setDraft(EMPTY);
      setBaseline(EMPTY);
      setFormVersion((v) => v + 1);
      setError('');
      setNotice('');
      scrollToDetail();
    });

  const resetForm = () => {
    setDraft(baseline);
    setFormVersion((v) => v + 1);
  };

  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const wasNew = detail === null;
      const body = await api<{ symbol: SymbolRow }>('/api/admin/symbols', {
        method: 'POST',
        body: draft,
      });
      await load(body.symbol.symbol, wasNew ? 'open' : 'saved');
      setNotice(
        wasNew ? 'مشخصات نماد ذخیره شد. حالا دادهٔ کندل را وارد کنید.' : 'تغییرات ذخیره شد.',
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ذخیره انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await api(`/api/admin/symbols/${encodeURIComponent(detail.symbol)}`, { method: 'DELETE' });
      requestRef.current++;
      setSelected('new');
      setDetail(null);
      setDraft(EMPTY);
      setBaseline(EMPTY);
      setFormVersion((v) => v + 1);
      setDialog(null);
      await load();
      setNotice('نماد حذف شد.');
    } catch (e) {
      setDialog(null);
      setError(e instanceof ApiError ? e.message : 'حذف انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(
    () => ({
      all: rows.length,
      custom: rows.filter((row) => row.source === 'custom').length,
      builtin: rows.filter((row) => row.source === 'builtin').length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (filter === 'all' || row.source === filter) &&
        (!needle ||
          row.symbol.toLowerCase().includes(needle) ||
          row.description.toLowerCase().includes(needle)),
    );
  }, [rows, search, filter]);

  return (
    <div>
      <PageHead
        kicker="بازار"
        title="نمادها و داده"
        text="نماد داخلی کندلو ثابت است. نماد تازه را با مشخصات قرارداد بسازید، بعد پوشهٔ advanced-get یا فایل‌های PRN را بارگذاری کنید. تمرین فقط با فایل یک‌دقیقه‌ای باز می‌شود."
      />

      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ---------- Symbol list ---------- */}
        <Panel className="overflow-hidden lg:sticky lg:top-4">
          <button
            type="button"
            onClick={startNew}
            className={`flex h-12 w-full items-center justify-between border-b border-[var(--a-line)] px-4 text-[13.5px] font-semibold text-[var(--a-gold)] transition hover:bg-white/[0.04] ${FOCUS_RING_INSET} ${
              selected === 'new' ? 'bg-white/[0.04]' : ''
            }`}
          >
            نماد جدید
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--a-gold)]/15">
              <Icon name="plus" className="h-3.5 w-3.5" />
            </span>
          </button>

          <div className="space-y-2.5 border-b border-[var(--a-line)] p-3">
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-muted)]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی نماد"
                aria-label="جستجوی نماد"
                className={`${fieldClass} !h-10 !ps-9 !pe-9 text-[13px]`}
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="پاک کردن جستجو"
                  className={`absolute end-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--a-muted)] transition hover:bg-white/10 hover:text-white ${FOCUS_RING}`}
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div
              role="tablist"
              aria-label="فیلتر نمادها"
              className="flex gap-1 rounded-xl bg-white/[0.04] p-1"
            >
              {(
                [
                  ['all', 'همه'],
                  ['custom', 'سفارشی'],
                  ['builtin', 'داخلی'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition ${FOCUS_RING} ${
                    filter === id
                      ? 'bg-white/10 text-white'
                      : 'text-[var(--a-muted)] hover:text-white'
                  }`}
                >
                  {label}
                  <span className="ms-1 tabular-nums opacity-60">{faNum(counts[id])}</span>
                </button>
              ))}
            </div>
          </div>

          <nav aria-label="فهرست نمادها">
            <ul className="max-h-72 overflow-y-auto lg:max-h-[calc(100vh-17rem)]">
              {loading
                ? Array.from({ length: 5 }, (_, i) => (
                    <li key={i} className="space-y-2 border-b border-[var(--a-line)] px-4 py-3.5">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-14 !rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-40" />
                    </li>
                  ))
                : null}
              {!loading && listError ? (
                <li className="space-y-3 px-4 py-6 text-center">
                  <p className="text-[13px] text-[#ffb3bf]">{listError}</p>
                  <button
                    type="button"
                    onClick={loadRows}
                    className={`${BTN_GHOST} !h-9 text-[12.5px]`}
                  >
                    تلاش دوباره
                  </button>
                </li>
              ) : null}
              {!loading && !listError && visible.length === 0 ? (
                <li className="px-4 py-8 text-center text-[13px] text-[var(--a-muted)]">
                  {rows.length === 0 ? 'هنوز نمادی ثبت نشده.' : 'نمادی با این جستجو پیدا نشد.'}
                </li>
              ) : null}
              {visible.map((row) => {
                const isSelected = selected === row.symbol;
                const assetLabel = ASSETS.find((item) => item.id === row.assetClass)?.label;
                return (
                  <li key={`${row.source}-${row.symbol}`} className="relative">
                    {isSelected ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 start-0 w-0.5 bg-[#3b78ff]"
                      />
                    ) : null}
                    <button
                      type="button"
                      aria-current={isSelected ? 'true' : undefined}
                      onClick={() => choose(row.symbol)}
                      className={`flex w-full flex-col items-start gap-1 border-b border-[var(--a-line)] px-4 py-3 text-start transition hover:bg-white/[0.03] ${FOCUS_RING_INSET} ${
                        isSelected ? 'bg-[#3b78ff]/[0.08]' : ''
                      }`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <bdi className="font-semibold">{row.symbol}</bdi>
                        <StatusBadge row={row} />
                      </span>
                      <span className="line-clamp-1 text-[12px] text-[var(--a-muted)]">
                        {row.description}
                      </span>
                      {assetLabel || !row.active ? (
                        <span className="flex items-center gap-1.5 text-[11px] text-[var(--a-muted)]/80">
                          {assetLabel}
                          {!row.active ? (
                            <span className="rounded bg-white/[0.06] px-1.5 py-px">غیرفعال</span>
                          ) : null}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Panel>

        {/* ---------- Detail pane ---------- */}
        <div ref={detailRef} className="min-w-0 scroll-mt-4 space-y-4">
          {builtin ? (
            <BuiltinCard row={builtin} />
          ) : detailLoading ? (
            <FormSkeleton />
          ) : detailError && selected !== 'new' ? (
            <Panel className="p-6 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#ff6b81]/12 text-[#ff97a7] ring-1 ring-[#ff6b81]/25">
                <Icon name="alert" className="h-5 w-5" />
              </span>
              <p className="mt-4 text-[14.5px] font-semibold">مشخصات نماد خوانده نشد</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-6 text-[var(--a-muted)]">
                {detailError}
              </p>
              <button
                type="button"
                onClick={() => void openSymbol(selected)}
                className={`${BTN_GHOST} mt-4`}
              >
                تلاش دوباره
              </button>
            </Panel>
          ) : (
            <>
              <StepsBar detail={detail} />
              <SpecForm
                key={`${selected}:${formVersion}`}
                draft={draft}
                locked={detail !== null}
                busy={busy}
                dirty={dirty}
                onChange={setDraft}
                onSave={() => void save()}
                onReset={resetForm}
                onDelete={detail ? () => setDialog({ kind: 'delete' }) : null}
              />
              {detail ? (
                <DataPanel
                  key={detail.symbol}
                  detail={detail}
                  onImported={async (text) => {
                    await load(detail.symbol, 'refresh');
                    setNotice(text);
                  }}
                  onError={setError}
                />
              ) : (
                <Panel className="flex items-start gap-3.5 p-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-[var(--a-muted)] ring-1 ring-white/10">
                    <Icon name="lock" className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <h3 className="text-[14.5px] font-semibold">دادهٔ کندل</h3>
                    <p className="mt-1 text-[13px] leading-7 text-[var(--a-muted)]">
                      بعد از ذخیرهٔ مشخصات، بخش ورود داده اینجا باز می‌شود.
                    </p>
                  </div>
                </Panel>
              )}
            </>
          )}
        </div>
      </div>

      <Toasts
        error={error}
        notice={notice}
        onCloseError={() => setError('')}
        onCloseNotice={() => setNotice('')}
      />

      {dialog?.kind === 'delete' && detail ? (
        <ConfirmDialog
          danger
          busy={busy}
          title={`حذف نماد ${detail.symbol}`}
          text="نماد و همهٔ دادهٔ کندل آن برای همیشه حذف می‌شود. این کار قابل بازگشت نیست."
          confirmLabel="حذف نماد"
          onConfirm={() => void remove()}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'discard' ? (
        <ConfirmDialog
          title="تغییرات ذخیره نشده"
          text="مشخصات این نماد هنوز ذخیره نشده است. اگر ادامه دهید، تغییرات از بین می‌رود."
          confirmLabel="ادامه بدون ذخیره"
          onConfirm={() => {
            const proceed = dialog.proceed;
            setDialog(null);
            proceed();
          }}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Steps, skeleton, builtin                                            */
/* ------------------------------------------------------------------ */

function StepsBar({ detail }: { readonly detail: SymbolDetail | null }) {
  const current = !detail ? 0 : detail.practiceReady ? 3 : 1;
  const steps = ['مشخصات قرارداد', 'ورود داده', 'آمادهٔ تمرین'];
  return (
    <ol className="flex items-center gap-2 px-1" aria-label="مراحل ساخت نماد">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            className="flex min-w-0 flex-1 items-center gap-2"
            aria-current={active ? 'step' : undefined}
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ring-1 ${
                done
                  ? 'bg-[#3ecf8e]/15 text-[#8ef0cf] ring-[#3ecf8e]/30'
                  : active
                    ? 'bg-[#3b78ff]/20 text-[#cfdcff] ring-[#3b78ff]/50'
                    : 'bg-white/[0.04] text-[var(--a-muted)] ring-white/10'
              }`}
            >
              {done ? <Icon name="check" className="h-3 w-3" /> : faNum(index + 1)}
            </span>
            <span
              className={`truncate text-[12px] ${
                active ? 'font-medium text-white' : 'text-[var(--a-muted)]'
              }`}
            >
              {label}
            </span>
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={`h-px flex-1 ${done ? 'bg-[#3ecf8e]/40' : 'bg-white/10'}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function FormSkeleton() {
  return (
    <Panel className="p-5" aria-busy="true">
      <Skeleton className="h-5 w-40" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-11 w-full !rounded-xl" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function BuiltinCard({ row }: { readonly row: SymbolRow }) {
  return (
    <Panel className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] text-[var(--a-gold)]">نماد داخلی</p>
          <h3 className="mt-1 text-[22px] font-bold">
            <bdi>{row.symbol}</bdi>
          </h3>
          <p className="mt-1.5 text-[14px] text-[var(--a-muted)]">{row.description}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11.5px] text-[#b9c6e4]">
          <Icon name="lock" className="h-3.5 w-3.5" />
          فقط‌خواندنی
        </span>
      </div>
      {row.dataStart && row.dataEnd ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(
            [
              ['شروع بازهٔ مصنوعی', row.dataStart],
              ['پایان بازهٔ مصنوعی', row.dataEnd],
            ] as const
          ).map(([label, time]) => (
            <div
              key={label}
              className="rounded-xl border border-[var(--a-line)] bg-white/[0.03] px-4 py-3"
            >
              <div className="text-[11.5px] text-[var(--a-muted)]">{label}</div>
              <div className="mt-1 text-[13.5px] font-medium tabular-nums">
                {formatJalaliDateTime(time, false)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-5">
        <Callout tone="info">
          تاریخچهٔ این نماد داخل برنامه ساخته می‌شود و از پنل عوض نمی‌شود. برای قیمت واقعی، نماد
          تازه‌ای با نام دیگر بسازید و پوشهٔ داده را بارگذاری کنید.
        </Callout>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Spec form                                                           */
/* ------------------------------------------------------------------ */

function SpecForm({
  draft,
  locked,
  busy,
  dirty,
  onChange,
  onSave,
  onReset,
  onDelete,
}: {
  readonly draft: InstrumentDraft;
  readonly locked: boolean;
  readonly busy: boolean;
  readonly dirty: boolean;
  readonly onChange: (next: InstrumentDraft) => void;
  readonly onSave: () => void;
  readonly onReset: () => void;
  readonly onDelete: (() => void) | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [attempted, setAttempted] = useState(false);
  const errors = validate(draft);
  const errorCount = Object.keys(errors).length;

  const set = <K extends keyof InstrumentDraft>(key: K, value: InstrumentDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (errorCount > 0) {
      setAttempted(true);
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    if (locked && !dirty) return;
    onSave();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const symbolError = attempted ? errors.symbol : undefined;
  const statusText =
    attempted && errorCount > 0
      ? `${faNum(errorCount)} مورد نیاز به اصلاح دارد`
      : dirty
        ? 'تغییرات ذخیره‌نشده'
        : locked
          ? 'همهٔ تغییرات ذخیره شده است'
          : '';
  const statusTone =
    attempted && errorCount > 0
      ? 'text-[#ffb3bf]'
      : dirty
        ? 'text-[#f7c46a]'
        : 'text-[var(--a-muted)]';

  return (
    <Panel className="p-5">
      <form ref={formRef} onSubmit={submit} onKeyDown={onKeyDown} noValidate>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2.5 text-[16px] font-semibold">
            {locked ? (
              <>
                ویرایش <bdi dir="ltr">{draft.symbol}</bdi>
              </>
            ) : (
              'مشخصات قرارداد'
            )}
          </h3>
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f5b544]/30 bg-[#f5b544]/10 px-2.5 py-0.5 text-[11.5px] font-medium text-[#f7c46a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f5b544]" aria-hidden="true" />
              ذخیره نشده
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          <Section first title="هویت نماد">
            <Field
              label="نماد"
              error={symbolError}
              hint={
                locked ? 'نام نماد بعد از ساخت قابل تغییر نیست.' : 'حروف انگلیسی بزرگ، بدون فاصله'
              }
            >
              <input
                dir="ltr"
                disabled={locked}
                value={draft.symbol}
                aria-invalid={symbolError ? true : undefined}
                onChange={(e) => set('symbol', e.target.value.replace(/\s/g, '').toUpperCase())}
                className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-60 ${
                  symbolError ? INVALID : ''
                }`}
                placeholder="EURJPY"
              />
            </Field>
            <Field label="توضیح">
              <input
                value={draft.description}
                onChange={(e) => set('description', e.target.value)}
                className={fieldClass}
                placeholder="Euro / Japanese Yen"
              />
            </Field>
            <Field label="ارز پایه">
              <input
                dir="ltr"
                value={draft.baseCurrency}
                onChange={(e) => set('baseCurrency', e.target.value.toUpperCase())}
                className={fieldClass}
                placeholder="EUR"
              />
            </Field>
            <Field label="ارز قیمت">
              <input
                dir="ltr"
                value={draft.quoteCurrency}
                onChange={(e) => set('quoteCurrency', e.target.value.toUpperCase())}
                className={fieldClass}
                placeholder="USD"
              />
            </Field>
          </Section>

          <Section title="بازار">
            <Field label="دسته">
              <select
                value={draft.assetClass}
                onChange={(e) => {
                  const assetClass = e.target.value as AssetClass;
                  // Keep trading hours in step with the class unless the admin customized them.
                  const followHours = (draft.hours as string) === (draft.assetClass as string);
                  onChange({
                    ...draft,
                    assetClass,
                    hours: followHours ? (assetClass as HourPreset) : draft.hours,
                  });
                }}
                className={fieldClass}
              >
                {ASSETS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ساعت بازار" hint="با تغییر دسته، به‌طور خودکار هم‌راستا می‌شود.">
              <select
                value={draft.hours}
                onChange={(e) => set('hours', e.target.value as HourPreset)}
                className={fieldClass}
              >
                {HOURS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="قیمت و قرارداد">
            <Num
              label="اندازه تیک"
              hint="کوچک‌ترین تغییر ممکن قیمت"
              value={draft.tickSize}
              error={errors.tickSize}
              attempted={attempted}
              onChange={(value) => set('tickSize', value)}
            />
            <Num
              label="اندازه پیپ"
              hint="مقدار یک پیپ در واحد قیمت"
              value={draft.pipSize}
              error={errors.pipSize}
              attempted={attempted}
              onChange={(value) => set('pipSize', value)}
            />
            <Num
              label="حجم قرارداد"
              hint="مقدار واحد پایه در یک لات"
              value={draft.contractSize}
              error={errors.contractSize}
              attempted={attempted}
              onChange={(value) => set('contractSize', value)}
            />
          </Section>

          <Section title="حجم معامله (لات)">
            <Num
              label="حداقل لات"
              value={draft.lotMin}
              error={errors.lotMin}
              attempted={attempted}
              onChange={(value) => set('lotMin', value)}
            />
            <Num
              label="گام لات"
              hint="فاصلهٔ بین حجم‌های مجاز"
              value={draft.lotStep}
              error={errors.lotStep}
              attempted={attempted}
              onChange={(value) => set('lotStep', value)}
            />
            <Num
              label="سقف لات"
              value={draft.lotMax}
              error={errors.lotMax}
              attempted={attempted}
              onChange={(value) => set('lotMax', value)}
            />
          </Section>

          <Section title="هزینه‌های پیش‌فرض">
            <Num
              label="اسپرد پیش‌فرض"
              hint="به واحد قیمت"
              value={draft.defaultSpread}
              error={errors.defaultSpread}
              attempted={attempted}
              onChange={(value) => set('defaultSpread', value)}
            />
            <Num
              label="کمیسیون هر لات"
              hint="مبلغ ثابت برای هر لات"
              value={draft.defaultCommissionPerLot}
              error={errors.defaultCommissionPerLot}
              attempted={attempted}
              onChange={(value) => set('defaultCommissionPerLot', value)}
            />
          </Section>
        </div>

        <div className="mt-6">
          <Toggle
            checked={draft.active}
            onChange={(next) => set('active', next)}
            label="نمایش در فهرست تمرین"
            hint="اگر خاموش باشد، نماد برای کاربران پنهان می‌ماند."
          />
        </div>

        <div className="sticky bottom-0 -mx-5 -mb-5 mt-6 flex flex-wrap items-center gap-3 rounded-b-2xl border-t border-[var(--a-line)] bg-[#0c1018]/90 px-5 py-3.5 backdrop-blur">
          <button
            type="submit"
            disabled={busy || (locked && !dirty)}
            title="Ctrl + S"
            className={BTN_PRIMARY}
          >
            {busy ? <Spinner /> : <Icon name="save" />}
            {busy ? 'در حال ذخیره…' : locked ? 'ذخیره تغییرات' : 'ساخت نماد'}
          </button>
          {dirty ? (
            <button type="button" disabled={busy} onClick={onReset} className={BTN_GHOST}>
              <Icon name="undo" />
              {locked ? 'بازگرداندن' : 'پاک کردن فرم'}
            </button>
          ) : null}
          {statusText ? (
            <span role="status" className={`text-[12.5px] ${statusTone}`}>
              {statusText}
            </span>
          ) : null}
          <span className="flex-1" />
          {onDelete ? (
            <button type="button" disabled={busy} onClick={onDelete} className={BTN_DANGER}>
              <Icon name="trash" />
              حذف نماد
            </button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Data import                                                         */
/* ------------------------------------------------------------------ */

function DataPanel({
  detail,
  onImported,
  onError,
}: {
  readonly detail: SymbolDetail;
  readonly onImported: (text: string) => Promise<void>;
  readonly onError: (text: string) => void;
}) {
  const [timeframe, setTimeframe] = useState<TimeframeId>(detail.timeframe ?? '1m');
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [ready, setReady] = useState<readonly ReadyFile[]>([]);
  const [reading, setReading] = useState<{ done: number; total: number } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const sparkBars = ready.find((file) => file.timeframe === '1m')?.bars ?? ready[0]?.bars;
  const closes = useMemo(
    () => (sparkBars ?? detail.preview).map((bar) => bar.close),
    [sparkBars, detail.preview],
  );

  const readFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onError('');
    const files = Array.from(list).filter((file) =>
      /\.(prn|csv|txt)$/i.test(file.webkitRelativePath || file.name),
    );
    if (files.length === 0) {
      onError('فایل PRN یا CSV پیدا نشد. فایل‌های .prn، .csv یا .txt را انتخاب کنید.');
      return;
    }
    setReading({ done: 0, total: files.length });
    const next: ReadyFile[] = [];
    const problems: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const path = file.webkitRelativePath || file.name;
      try {
        const detected = timeframeFromPath(path) ?? timeframe;
        const result = parseCandleCsv(await file.text(), detected);
        if (!result.ok) {
          problems.push(`${file.name}: ${result.error}`);
        } else if (result.bars[0] && result.bars[result.bars.length - 1]) {
          next.push({ name: path, timeframe: detected, bars: result.bars });
        }
      } catch {
        problems.push(`${file.name}: فایل خوانده نشد`);
      }
      setReading({ done: i + 1, total: files.length });
    }
    setReading(null);
    const merged = mergeReady(next);
    setReady(merged);
    if (merged.length === 0) onError(problems[0] ?? 'فایل PRN یا CSV پیدا نشد');
    else if (problems.length > 0) onError(problems.join(' · '));
  };

  const upload = async () => {
    if (ready.length === 0) return;
    setBusy(true);
    onError('');
    try {
      const saved: string[] = [];
      const total = ready.reduce(
        (sum, file) => sum + Math.ceil(file.bars.length / MAX_IMPORT_BARS),
        0,
      );
      let done = 0;
      for (const file of ready) {
        const tuples = toTuples(file.bars);
        const parts = Math.ceil(tuples.length / MAX_IMPORT_BARS);
        for (let i = 0; i < parts; i++) {
          setProgress({
            done,
            total,
            label: `در حال ارسال ${file.timeframe}، بخش ${faNum(i + 1)} از ${faNum(parts)}`,
          });
          await api(`/api/admin/symbols/${encodeURIComponent(detail.symbol)}/bars`, {
            method: 'POST',
            body: {
              timeframe: file.timeframe,
              mode: i === 0 ? mode : 'append',
              bars: tuples.slice(i * MAX_IMPORT_BARS, (i + 1) * MAX_IMPORT_BARS),
            },
          });
          done++;
        }
        saved.push(`${file.timeframe}: ${faNum(file.bars.length)}`);
      }
      setReady([]);
      setProgress(null);
      await onImported(`دادهٔ ${detail.symbol} ذخیره شد. ${saved.join('، ')}`);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'ورود داده انجام نشد');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const working = busy || reading !== null;
  const hasMinute =
    detail.series.some((series) => series.timeframe === '1m') ||
    ready.some((file) => file.timeframe === '1m');
  const pct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold">دادهٔ کندل</h3>
          <p className="mt-1 text-[12.5px] text-[var(--a-muted)]">پیش‌نمایش روند قیمت بسته‌شدن</p>
        </div>
        <Sparkline values={closes} />
      </div>

      <div className="mt-4">
        {detail.practiceReady ? (
          <Callout tone="ok">این نماد در تمرین در دسترس است.</Callout>
        ) : (
          <Callout tone="warn">برای باز شدن نماد در تمرین، فایل 1minute لازم است.</Callout>
        )}
      </div>

      {detail.series.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {detail.series.map((series) => (
            <li
              key={series.timeframe}
              className="flex items-center gap-3 rounded-xl border border-[var(--a-line)] bg-white/[0.03] p-3"
            >
              <span
                dir="ltr"
                className="grid h-9 min-w-[2.75rem] place-items-center rounded-lg bg-white/[0.06] px-2 text-[12px] font-semibold text-[#cfdcff] ring-1 ring-white/10"
              >
                {series.timeframe}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium tabular-nums">
                  {faNum(series.barCount)} کندل
                </div>
                <div className="truncate text-[11.5px] text-[var(--a-muted)]">
                  <bdi>
                    {formatJalaliDateTime(series.dataStart, false)} –{' '}
                    {formatJalaliDateTime(series.dataEnd, false)}
                  </bdi>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] text-[var(--a-muted)]">هنوز کندلی ذخیره نشده.</p>
      )}

      <div className="mt-6 border-t border-[var(--a-line)] pt-5">
        <h4 className="text-[13.5px] font-semibold">بارگذاری داده</h4>
        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
          <Field
            label="تایم‌فریم پیش‌فرض"
            hint="فقط وقتی استفاده می‌شود که نام فایل یا پوشه دوره نداشته باشد."
          >
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as TimeframeId)}
              className={fieldClass}
            >
              {TIMEFRAMES.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </Field>
          <Segmented
            label="اگر دادهٔ قبلی همین تایم‌فریم هست"
            value={mode}
            onChange={setMode}
            options={[
              { id: 'replace', label: 'جایگزین شود' },
              { id: 'append', label: 'به انتها اضافه شود' },
            ]}
          />
        </div>

        <FilePicks disabled={working} onFiles={(files) => void readFiles(files)} />

        {reading ? (
          <div
            className="mt-3 flex items-center gap-2.5 text-[12.5px] text-[var(--a-muted)]"
            role="status"
          >
            <Spinner className="h-4 w-4 text-[#7aa2ff]" />
            در حال خواندن فایل‌ها ({faNum(reading.done)} از {faNum(reading.total)})
          </div>
        ) : null}

        {ready.length > 0 ? (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-semibold">
                آمادهٔ ذخیره <span className="text-[var(--a-muted)]">({faNum(ready.length)})</span>
              </h4>
              <button
                type="button"
                disabled={busy}
                onClick={() => setReady([])}
                className={`rounded-lg px-2 py-1 text-[12px] text-[var(--a-muted)] transition hover:bg-white/5 hover:text-white disabled:opacity-40 ${FOCUS_RING}`}
              >
                پاک کردن همه
              </button>
            </div>
            <ul className="mt-2 space-y-2">
              {ready.map((file) => {
                const first = file.bars[0];
                const last = file.bars[file.bars.length - 1];
                if (!first || !last) return null;
                const existing = detail.series.find(
                  (series) => series.timeframe === file.timeframe,
                );
                return (
                  <li
                    key={file.timeframe}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <span
                      dir="ltr"
                      className="grid h-9 min-w-[2.75rem] place-items-center rounded-lg bg-[#3b78ff]/12 px-2 text-[12px] font-semibold text-[#9db9ff] ring-1 ring-[#3b78ff]/25"
                    >
                      {file.timeframe}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium tabular-nums">
                        {faNum(file.bars.length)} کندل
                      </div>
                      <div className="mt-0.5 text-[12px] text-[var(--a-muted)]">
                        <bdi>
                          {formatJalaliDateTime(first.time, false)} –{' '}
                          {formatJalaliDateTime(last.time, false)}
                        </bdi>
                      </div>
                      <span dir="ltr" className="mt-0.5 block truncate text-[11px] opacity-60">
                        {file.name}
                      </span>
                      {existing ? (
                        <div
                          className={`mt-1.5 text-[11.5px] ${
                            mode === 'replace' ? 'text-[#f7c46a]' : 'text-[var(--a-muted)]'
                          }`}
                        >
                          {mode === 'replace'
                            ? `${faNum(existing.barCount)} کندل موجود جایگزین می‌شود.`
                            : `به ${faNum(existing.barCount)} کندل موجود اضافه می‌شود.`}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`حذف ${file.timeframe} از فهرست`}
                      onClick={() =>
                        setReady((list) => list.filter((item) => item.timeframe !== file.timeframe))
                      }
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--a-muted)] transition hover:bg-white/10 hover:text-white disabled:opacity-40 ${FOCUS_RING}`}
                    >
                      <Icon name="close" className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {!hasMinute ? (
              <div className="mt-3">
                <Callout tone="warn">
                  در این بارگذاری فایل 1minute نیست؛ نماد بدون آن در تمرین باز نمی‌شود.
                </Callout>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4">
          <button
            type="button"
            disabled={ready.length === 0 || working}
            onClick={() => void upload()}
            className={`${BTN_PRIMARY} w-full sm:w-auto`}
          >
            {busy ? <Spinner /> : <Icon name="upload" />}
            {busy ? (progress?.label ?? 'در حال ذخیره…') : 'ذخیره داده'}
          </button>
          {progress ? (
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label="پیشرفت ارسال"
            >
              <div
                className="h-full rounded-full bg-[#3b78ff] transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* File pickers                                                        */
/* ------------------------------------------------------------------ */

const PICK_BOX = `group flex min-h-28 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed bg-white/[0.02] px-4 py-6 text-center text-[var(--a-text)] transition disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;

function FilePicks({
  disabled,
  onFiles,
}: {
  readonly disabled: boolean;
  readonly onFiles: (files: FileList | null) => void;
}) {
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const portal = usePortalTarget();
  const [dragging, setDragging] = useState(false);
  const boxTone = dragging
    ? 'border-[#3b78ff] bg-[#3b78ff]/10'
    : 'border-white/15 hover:border-[#3b78ff]/50 hover:bg-white/[0.04]';

  return (
    <>
      <div
        className="mt-4"
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) onFiles(event.dataTransfer.files);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={disabled}
            className={`${PICK_BOX} ${boxTone}`}
            onClick={(event) => openFilePicker(filesRef.current, event.currentTarget)}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#3b78ff]/12 text-[#7aa2ff] ring-1 ring-[#3b78ff]/25 transition group-hover:scale-105">
              <Icon name="file" className="h-[18px] w-[18px]" />
            </span>
            <span className="mt-3 text-[14px] font-medium">فایل‌های PRN</span>
            <span dir="ltr" className="mt-1 text-[11.5px] text-[var(--a-muted)]">
              {'<DTYYYYMMDD>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>'}
            </span>
          </button>
          <button
            type="button"
            disabled={disabled}
            className={`${PICK_BOX} ${boxTone}`}
            onClick={(event) => openFilePicker(folderRef.current, event.currentTarget)}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#9b7bff]/12 text-[#b7a0ff] ring-1 ring-[#9b7bff]/25 transition group-hover:scale-105">
              <Icon name="folder" className="h-[18px] w-[18px]" />
            </span>
            <span className="mt-3 text-[14px] font-medium">پوشه advanced-get</span>
            <span className="mt-1 text-[12px] leading-5 text-[var(--a-muted)]">
              1minute تا 240minute، هر پوشه یک تایم‌فریم
            </span>
          </button>
        </div>
        <p className="mt-2 text-center text-[11.5px] text-[var(--a-muted)]">
          یا فایل‌ها را بکشید و همین‌جا رها کنید. برای پوشه از دکمهٔ بالا استفاده کنید.
        </p>
      </div>
      {portal
        ? createPortal(
            <>
              <input
                ref={filesRef}
                type="file"
                multiple
                tabIndex={-1}
                aria-hidden="true"
                accept=".prn,.csv,.txt,text/plain,text/csv"
                className="admin-file-input"
                onChange={(event) => {
                  onFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <input
                ref={(node) => {
                  folderRef.current = node;
                  if (!node) return;
                  node.setAttribute('webkitdirectory', '');
                  node.setAttribute('directory', '');
                }}
                type="file"
                multiple
                tabIndex={-1}
                aria-hidden="true"
                className="admin-file-input"
                onChange={(event) => {
                  onFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </>,
            portal,
          )
        : null}
    </>
  );
}

function openFilePicker(input: HTMLInputElement | null, source: HTMLElement): void {
  if (!input) return;
  const scroller = source.closest('main');
  const top = scroller instanceof HTMLElement ? scroller.scrollTop : 0;
  const winX = window.scrollX;
  const winY = window.scrollY;
  input.click();
  const restore = () => {
    if (scroller instanceof HTMLElement) scroller.scrollTop = top;
    window.scrollTo(winX, winY);
  };
  restore();
  requestAnimationFrame(restore);
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

function Sparkline({ values }: { readonly values: readonly number[] }) {
  const gradientId = `spark-${useId().replace(/:/g, '')}`;
  if (values.length < 2) {
    return (
      <div className="grid h-14 w-36 place-items-center rounded-xl border border-dashed border-white/10 text-[var(--a-muted)]">
        <Icon name="chart" className="h-5 w-5 opacity-50" />
      </div>
    );
  }
  const stride = Math.ceil(values.length / 240);
  const sampled =
    stride > 1
      ? values.filter((_, index) => index % stride === 0 || index === values.length - 1)
      : values;
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min || 1;
  const step = 140 / (sampled.length - 1);
  const coords = sampled.map((value, index) => ({
    x: index * step,
    y: 46 - ((value - min) / span) * 40,
  }));
  const points = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const end = coords[coords.length - 1]!;
  const up = sampled[sampled.length - 1]! >= sampled[0]!;
  const color = up ? '#3dcea0' : '#ff6b81';
  return (
    <svg viewBox="0 0 140 52" className="h-14 w-36" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradientId})`} points={`0,52 ${points} 140,52`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
      <circle cx={end.x} cy={end.y} r="2.6" fill={color} />
    </svg>
  );
}
