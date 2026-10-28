'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { Notice, PageHead, Panel, fieldClass, labelClass } from './ui';

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

export function SymbolsDesk() {
  const [rows, setRows] = useState<SymbolRow[]>([]);
  const [selected, setSelected] = useState<string>('new');
  const [detail, setDetail] = useState<SymbolDetail | null>(null);
  const [draft, setDraft] = useState<InstrumentDraft>(EMPTY);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const openSymbol = async (symbol: string, list: readonly SymbolRow[] = rows) => {
    setSelected(symbol);
    setNotice('');
    setError('');
    const row = list.find((item) => item.symbol === symbol);
    if (row?.source === 'builtin') {
      setDetail(null);
      return;
    }
    const body = await api<{ symbol: SymbolDetail }>(
      `/api/admin/symbols/${encodeURIComponent(symbol)}`,
    );
    setDetail(body.symbol);
    if (body.symbol.draft) setDraft(body.symbol.draft);
  };

  const load = async (keep?: string) => {
    const body = await api<{ symbols: SymbolRow[] }>('/api/admin/symbols');
    setRows(body.symbols);
    if (keep && keep !== 'new') await openSymbol(keep, body.symbols);
  };

  useEffect(() => {
    let live = true;
    void api<{ symbols: SymbolRow[] }>('/api/admin/symbols')
      .then((body) => {
        if (live) setRows(body.symbols);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : 'خوانده نشد');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = await api<{ symbol: SymbolRow }>('/api/admin/symbols', {
        method: 'POST',
        body: draft,
      });
      setNotice('مشخصات نماد ذخیره شد. حالا دادهٔ کندل را وارد کنید.');
      await load(body.symbol.symbol);
      setSelected(body.symbol.symbol);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ذخیره انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!detail || !window.confirm(`نماد ${detail.symbol} و داده‌اش حذف شود؟`)) return;
    setBusy(true);
    try {
      await api(`/api/admin/symbols/${encodeURIComponent(detail.symbol)}`, { method: 'DELETE' });
      setSelected('new');
      setDetail(null);
      setDraft(EMPTY);
      await load();
      setNotice('نماد حذف شد.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'حذف انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  const builtin = rows.find((row) => row.symbol === selected && row.source === 'builtin');

  return (
    <div>
      <PageHead
        kicker="بازار"
        title="نمادها و داده"
        text="نماد داخلی کندلو ثابت است. نماد تازه را با مشخصات قرارداد بسازید، بعد پوشهٔ advanced-get یا فایل‌های PRN را بارگذاری کنید. تمرین فقط با فایل یک‌دقیقه‌ای باز می‌شود."
      />
      {error ? (
        <div className="mb-3">
          <Notice tone="bad">{error}</Notice>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-3">
          <Notice tone="ok">{notice}</Notice>
        </div>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Panel className="overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setSelected('new');
              setDetail(null);
              setDraft(EMPTY);
              setError('');
            }}
            className="flex h-12 w-full items-center justify-between border-b border-[var(--a-line)] px-4 text-[13.5px] font-semibold text-[var(--a-gold)]"
          >
            نماد جدید
            <span className="text-[18px] leading-none">+</span>
          </button>
          <ul className="max-h-[640px] overflow-y-auto">
            {loading ? (
              <li className="px-4 py-6 text-[13px] text-[var(--a-muted)]">در حال خواندن…</li>
            ) : null}
            {rows.map((row) => (
              <li key={`${row.source}-${row.symbol}`}>
                <button
                  type="button"
                  onClick={() =>
                    void openSymbol(row.symbol).catch((e: unknown) => setError(messageOf(e)))
                  }
                  className={`flex w-full flex-col items-start gap-1 border-b border-[var(--a-line)] px-4 py-3 text-right transition hover:bg-white/[0.03] ${
                    selected === row.symbol ? 'bg-white/[0.04]' : ''
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <bdi className="font-semibold">{row.symbol}</bdi>
                    <Status row={row} />
                  </span>
                  <span className="line-clamp-1 text-[12px] text-[var(--a-muted)]">
                    {row.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        {builtin ? (
          <BuiltinCard row={builtin} />
        ) : (
          <div className="space-y-4">
            <SpecForm
              key={selected === 'new' ? 'new' : selected}
              draft={draft}
              locked={detail !== null}
              busy={busy}
              onChange={setDraft}
              onSave={() => void save()}
              onDelete={detail ? () => void remove() : null}
            />
            {detail ? (
              <DataPanel
                detail={detail}
                onImported={async (text) => {
                  setNotice(text);
                  await load(detail.symbol);
                }}
                onError={setError}
              />
            ) : (
              <Panel className="p-5 text-[13.5px] leading-7 text-[var(--a-muted)]">
                بعد از ذخیرهٔ مشخصات، بخش ورود داده اینجا باز می‌شود.
              </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Status({ row }: { readonly row: SymbolRow }) {
  const label =
    row.source === 'builtin'
      ? 'داخلی'
      : row.practiceReady
        ? 'آماده تمرین'
        : row.barCount > 0
          ? 'ذخیره شده'
          : 'بدون داده';
  const tone = row.practiceReady ? 'text-[#8ef0cf]' : 'text-[var(--a-muted)]';
  return <span className={`text-[11px] ${tone}`}>{label}</span>;
}

function BuiltinCard({ row }: { readonly row: SymbolRow }) {
  return (
    <Panel className="p-6">
      <p className="text-[12px] text-[var(--a-gold)]">نماد داخلی</p>
      <h3 className="mt-1 text-[22px] font-bold">
        <bdi>{row.symbol}</bdi>
      </h3>
      <p className="mt-2 text-[14px] text-[var(--a-muted)]">{row.description}</p>
      <p className="mt-4 text-[13.5px] leading-7 text-[var(--a-muted)]">
        تاریخچهٔ این نماد داخل برنامه ساخته می‌شود و از پنل عوض نمی‌شود. برای قیمت واقعی، نماد
        تازه‌ای با نام دیگر بسازید و پوشهٔ داده را بارگذاری کنید.
      </p>
      {row.dataStart && row.dataEnd ? (
        <p className="mt-4 text-[13px]">
          بازهٔ مصنوعی: {formatJalaliDateTime(row.dataStart, false)} تا{' '}
          {formatJalaliDateTime(row.dataEnd, false)}
        </p>
      ) : null}
    </Panel>
  );
}

function SpecForm({
  draft,
  locked,
  busy,
  onChange,
  onSave,
  onDelete,
}: {
  readonly draft: InstrumentDraft;
  readonly locked: boolean;
  readonly busy: boolean;
  readonly onChange: (next: InstrumentDraft) => void;
  readonly onSave: () => void;
  readonly onDelete: (() => void) | null;
}) {
  const set = <K extends keyof InstrumentDraft>(key: K, value: InstrumentDraft[K]) =>
    onChange({ ...draft, [key]: value });
  return (
    <Panel className="p-5">
      <h3 className="text-[16px] font-semibold">مشخصات قرارداد</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="نماد">
          <input
            dir="ltr"
            disabled={locked}
            value={draft.symbol}
            onChange={(e) => set('symbol', e.target.value.toUpperCase())}
            className={fieldClass}
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
        <Field label="دسته">
          <select
            value={draft.assetClass}
            onChange={(e) => set('assetClass', e.target.value as AssetClass)}
            className={fieldClass}
          >
            {ASSETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ساعت بازار">
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
        <Num
          label="اندازه تیک"
          value={draft.tickSize}
          onChange={(value) => set('tickSize', value)}
        />
        <Num label="اندازه پیپ" value={draft.pipSize} onChange={(value) => set('pipSize', value)} />
        <Num
          label="حجم قرارداد"
          value={draft.contractSize}
          onChange={(value) => set('contractSize', value)}
        />
        <Num label="حداقل لات" value={draft.lotMin} onChange={(value) => set('lotMin', value)} />
        <Num label="گام لات" value={draft.lotStep} onChange={(value) => set('lotStep', value)} />
        <Num label="سقف لات" value={draft.lotMax} onChange={(value) => set('lotMax', value)} />
        <Num
          label="اسپرد پیش‌فرض"
          value={draft.defaultSpread}
          onChange={(value) => set('defaultSpread', value)}
        />
        <Num
          label="کمیسیون هر لات"
          value={draft.defaultCommissionPerLot}
          onChange={(value) => set('defaultCommissionPerLot', value)}
        />
      </div>
      <label className="mt-4 flex items-center gap-2 text-[13.5px]">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => set('active', e.target.checked)}
        />
        در فهرست تمرین نمایش داده شود
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className="h-11 rounded-xl bg-[var(--a-accent)] px-4 text-[13.5px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'در حال ذخیره…' : 'ذخیره مشخصات'}
        </button>
        {onDelete ? (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="h-11 rounded-xl border border-[#ff6b81]/40 px-4 text-[13.5px] text-[#ffb3bf]"
          >
            حذف نماد
          </button>
        ) : null}
      </div>
    </Panel>
  );
}

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
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const sparkBars = ready.find((file) => file.timeframe === '1m')?.bars ?? ready[0]?.bars;
  const closes = useMemo(
    () => (sparkBars ?? detail.preview).map((bar) => bar.close),
    [sparkBars, detail.preview],
  );

  const readFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onError('');
    const next: ReadyFile[] = [];
    const problems: string[] = [];
    for (const file of list) {
      const path = file.webkitRelativePath || file.name;
      if (!/\.(prn|csv|txt)$/i.test(path)) continue;
      const detected = timeframeFromPath(path) ?? timeframe;
      const result = parseCandleCsv(await file.text(), detected);
      if (!result.ok) {
        problems.push(`${file.name}: ${result.error}`);
        continue;
      }
      const first = result.bars[0];
      const last = result.bars[result.bars.length - 1];
      if (!first || !last) continue;
      next.push({ name: path, timeframe: detected, bars: result.bars });
    }
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
      for (const file of ready) {
        const tuples = toTuples(file.bars);
        const parts = Math.ceil(tuples.length / MAX_IMPORT_BARS);
        for (let i = 0; i < parts; i++) {
          setProgress(`در حال ارسال ${file.timeframe}، بخش ${faNum(i + 1)} از ${faNum(parts)}`);
          await api(`/api/admin/symbols/${encodeURIComponent(detail.symbol)}/bars`, {
            method: 'POST',
            body: {
              timeframe: file.timeframe,
              mode: i === 0 ? mode : 'append',
              bars: tuples.slice(i * MAX_IMPORT_BARS, (i + 1) * MAX_IMPORT_BARS),
            },
          });
        }
        saved.push(`${file.timeframe}: ${faNum(file.bars.length)}`);
      }
      setReady([]);
      setProgress('');
      await onImported(`دادهٔ ${detail.symbol} ذخیره شد. ${saved.join('، ')}`);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'ورود داده انجام نشد');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold">دادهٔ کندل</h3>
          <p className="mt-1 text-[13px] leading-6 text-[var(--a-muted)]">
            {detail.series.length > 0
              ? detail.series
                  .map((series) => `${series.timeframe}: ${faNum(series.barCount)}`)
                  .join(' · ')
              : 'هنوز کندلی ذخیره نشده.'}
            {detail.practiceReady
              ? ' این نماد در تمرین در دسترس است.'
              : ' برای تمرین، فایل 1minute لازم است.'}
          </p>
        </div>
        <Sparkline values={closes} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="تایم‌فریم، اگر نام فایل دوره نداشته باشد">
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
        <Field label="اگر دادهٔ قبلی همین تایم‌فریم هست">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'replace' | 'append')}
            className={fieldClass}
          >
            <option value="replace">جایگزین شود</option>
            <option value="append">به انتها اضافه شود</option>
          </select>
        </Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center">
          <input
            type="file"
            multiple
            accept=".prn,.csv,.txt,text/plain,text/csv"
            className="sr-only"
            onChange={(e) => {
              void readFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <span className="text-[14px] font-medium">فایل‌های PRN</span>
          <span dir="ltr" className="mt-1 text-[12px] text-[var(--a-muted)]">
            {'<DTYYYYMMDD>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>'}
          </span>
        </label>
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center">
          <input
            type="file"
            multiple
            className="sr-only"
            ref={(node) => {
              if (node) node.setAttribute('webkitdirectory', '');
            }}
            onChange={(e) => {
              void readFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <span className="text-[14px] font-medium">پوشه advanced-get</span>
          <span className="mt-1 text-[12px] leading-5 text-[var(--a-muted)]">
            1minute تا 240minute، هر پوشه یک تایم‌فریم
          </span>
        </label>
      </div>
      {ready.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[13px] text-[var(--a-muted)]">
          {ready.map((file) => {
            const first = file.bars[0];
            const last = file.bars[file.bars.length - 1];
            if (!first || !last) return null;
            return (
              <li key={file.name}>
                <bdi>
                  {file.timeframe} · {faNum(file.bars.length)} ·{' '}
                  {formatJalaliDateTime(first.time, false)} –{' '}
                  {formatJalaliDateTime(last.time, false)}
                </bdi>
                <span dir="ltr" className="mt-0.5 block truncate text-[11px] opacity-70">
                  {file.name}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <button
        type="button"
        disabled={ready.length === 0 || busy}
        onClick={() => void upload()}
        className="mt-3 h-11 rounded-xl bg-white px-4 text-[13.5px] font-semibold text-[#10141e] disabled:opacity-40"
      >
        {busy ? progress || 'در حال ذخیره…' : 'ذخیره داده'}
      </button>
    </Panel>
  );
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

function Sparkline({ values }: { readonly values: readonly number[] }) {
  if (values.length < 2) return <div className="h-14 w-36" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = 140 / (values.length - 1);
  const points = values
    .map(
      (value, index) =>
        `${(index * step).toFixed(1)},${(46 - ((value - min) / span) * 40).toFixed(1)}`,
    )
    .join(' ');
  const up = values[values.length - 1]! >= values[0]!;
  return (
    <svg viewBox="0 0 140 52" className="h-14 w-36" aria-hidden="true">
      <polyline fill="none" stroke={up ? '#3dcea0' : '#ff6b81'} strokeWidth="2" points={points} />
    </svg>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  return (
    <Field label={label}>
      <input
        dir="ltr"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const next = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(next)) onChange(next);
        }}
        className={fieldClass}
      />
    </Field>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'انجام نشد';
}
