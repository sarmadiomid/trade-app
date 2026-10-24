'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  EMPTY_JOURNAL_ENTRY,
  TRADING_SESSIONS,
  computeStats,
  excursionR,
  outcomeOf,
  plannedRR,
  rMultiple,
  tradingSessionOf,
  type JournalEntry,
  type Trade,
} from '@/lib/backtest';
import { useThemeCssVars } from '../hooks/useThemeCssVars';
import { journalHref } from '../home/journal-href';
import { statsHref } from '../home/stats-href';
import { Icon } from '../ui/Icon';
import {
  duration,
  EXIT_REASON_LABEL,
  faNum,
  failReasonFa,
  lots,
  num,
  ORDER_KIND_FA,
  pct,
  plainPct,
  pnlClass,
  SESSION_FA,
  SIDE_FA,
  signedMoney,
  utcDate,
  utcDateTime,
} from './format';
import { useStoredSession } from './useStoredSession';

const OUTCOME_FA = { win: 'سود', loss: 'ضرر', breakeven: 'سربه‌سر' } as const;

const field =
  'h-10 rounded-lg border border-line bg-[var(--h-field)] px-3 text-[13px] text-fg transition-colors duration-200 motion-reduce:transition-none';

interface SessionOption {
  readonly id: string;
  readonly name: string;
}

/** Trade journal for one session. Rendered inside the home shell. */
export default function JournalView({
  id,
  sessions = [],
}: {
  readonly id: string;
  readonly sessions?: readonly SessionOption[];
}) {
  useThemeCssVars();
  const { state, update } = useStoredSession(id);
  const [q, setQ] = useState('');
  const [side, setSide] = useState('');
  const [outcome, setOutcome] = useState('');
  const [tag, setTag] = useState('');
  const [tsession, setTsession] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const restore = useRef<string | null>(null);

  const ready = state.status === 'ready' ? state : null;
  const journal = useMemo(() => ready?.session.journal ?? {}, [ready]);
  const allTags = useMemo(
    () => [...new Set(Object.values(journal).flatMap((j) => j.tags))].sort(),
    [journal],
  );
  const trades = useMemo(() => {
    if (!ready) return [];
    const needle = q.trim().toLowerCase();
    return [...ready.session.account.trades].reverse().filter((t) => {
      const j = journal[t.id] ?? EMPTY_JOURNAL_ENTRY;
      if (side && t.side !== side) return false;
      if (outcome && outcomeOf(t) !== outcome) return false;
      if (tag && !j.tags.includes(tag)) return false;
      if (tsession && tradingSessionOf(t.entryTime) !== tsession) return false;
      if (needle && !`${j.notes} ${j.tags.join(' ')} #${t.id}`.toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [ready, journal, q, side, outcome, tag, tsession]);

  const summary = useMemo(() => (ready ? computeStats(ready.cfg, trades) : null), [ready, trades]);

  const filtered = Boolean(q.trim() || side || outcome || tag || tsession);

  const closeDetail = useCallback(() => {
    setSelected((cur) => {
      restore.current = cur;
      return null;
    });
  }, []);

  const loadShot = useCallback(
    (shotId: string) =>
      ready ? ready.services.repo.loadScreenshot(shotId) : Promise.resolve(null),
    [ready],
  );

  useEffect(() => {
    if (selected || !restore.current) return;
    const tradeId = restore.current;
    restore.current = null;
    const nodes = document.querySelectorAll<HTMLElement>(`[data-trade="${CSS.escape(tradeId)}"]`);
    const visible = [...nodes].find((n) => n.getClientRects().length > 0);
    visible?.focus();
  }, [selected]);

  if (state.status === 'loading')
    return (
      <p className="px-4 py-10 text-center text-[13px] text-muted sm:px-8">در حال بارگذاری…</p>
    );
  if (!ready || !summary)
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center sm:px-8">
        <p className="text-[14px] text-muted">این جلسه وجود ندارد.</p>
        <Link href="/home?tab=sessions" className="text-[13px] font-medium text-accent">
          بازگشت به جلسه‌ها
        </Link>
      </div>
    );

  const p = ready.spec.pricePrecision;
  const current = trades.find((t) => t.id === selected) ?? null;
  const open = ready.session.account.positions;
  const session = ready.session;
  const status = session.account.status;
  const statusLine =
    status === 'active'
      ? 'در جریان'
      : status === 'ended'
        ? 'تمام‌شده'
        : failReasonFa(session.account.failReason ?? '');
  const statusChip =
    status === 'active'
      ? 'bg-accent/15 text-accent'
      : status === 'ended'
        ? 'bg-[var(--h-chip)] text-muted'
        : 'bg-down/15 text-down';
  const blank = session.account.trades.length === 0;

  const clearFilters = () => {
    setQ('');
    setSide('');
    setOutcome('');
    setTag('');
    setTsession('');
  };

  const openTrade = (tradeId: string) => setSelected(tradeId);

  return (
    <div className="an-embed flex h-full min-h-0 flex-col" data-testid="journal">
      <div className="flex shrink-0 flex-col gap-4 px-4 pb-3 pt-4 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="an-title truncate">{session.settings.name}</h2>
            <p className="an-sub">
              <bdi dir="ltr">{session.settings.symbol}</bdi>
              <span
                className={`ms-2 inline-flex h-[22px] items-center rounded-full px-2 align-middle text-[11.5px] ${statusChip}`}
              >
                {statusLine}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sessions.length > 1 ? (
              <label className="inline-flex items-center gap-2 text-[13px] text-muted">
                جلسه
                <select
                  aria-label="جلسه"
                  className={`${field} cursor-pointer`}
                  value={id}
                  onChange={(e) => {
                    window.location.assign(journalHref(e.target.value));
                  }}
                >
                  {sessions.some((s) => s.id === id) ? null : <option value={id}>این جلسه</option>}
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="an-range">
              <Icon name="calendar" size={15} />
              <span>
                {utcDate(session.settings.startDate)} – {utcDate(session.settings.endDate)}
              </span>
              <span className="an-tz">ساعت جهانی</span>
            </div>
            <Link href={`/backtest/${id}`} className="an-go">
              {status === 'active' ? 'ادامه جلسه' : 'باز کردن نمودار'}
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="an-tabs" aria-label="بخش‌های جلسه">
            <span className="an-tab-on">دفتر معاملات</span>
            <Link href={statsHref(id)} className="an-tab">
              عملکرد
            </Link>
          </nav>
          <p className="text-[12.5px] text-muted" aria-live="polite">
            {faNum(trades.length)} معامله
            {open.length ? ` · ${faNum(open.length)} باز` : ''}
          </p>
        </div>

        <div className={current ? 'max-lg:hidden' : ''}>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric
              label="سود خالص"
              value={signedMoney(summary.netPnl)}
              hint={pct(summary.returnPct)}
              tone={pnlClass(summary.netPnl)}
            />
            <Metric
              label="نرخ برد"
              value={summary.totalTrades ? plainPct(summary.winRate) : '—'}
              hint={
                summary.totalTrades
                  ? `${faNum(summary.winners)} سود · ${faNum(summary.losers)} ضرر`
                  : 'هنوز معامله‌ای بسته نشده'
              }
            />
            <Metric
              label="میانگین R"
              value={summary.avgR === null ? '—' : `${faNum(summary.avgR, 2)}R`}
              hint="معاملات دارای حد ضرر"
              tone={summary.avgR === null ? '' : pnlClass(summary.avgR)}
            />
            <Metric
              label="معاملات"
              value={faNum(summary.totalTrades)}
              hint={`${faNum(summary.longs)} خرید · ${faNum(summary.shorts)} فروش`}
            />
          </div>

          <div
            role="group"
            aria-label="فیلتر معاملات"
            className="mt-3 flex flex-wrap items-center gap-2"
          >
            <div className="relative min-w-[min(100%,220px)] flex-1">
              <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                aria-label="جستجو در یادداشت و برچسب"
                placeholder="یادداشت، برچسب یا شماره"
                className={`${field} w-full cursor-text ps-9`}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <select
              aria-label="جهت"
              className={`${field} cursor-pointer`}
              value={side}
              onChange={(e) => setSide(e.target.value)}
            >
              <option value="">همه جهت‌ها</option>
              <option value="buy">خرید</option>
              <option value="sell">فروش</option>
            </select>
            <select
              aria-label="نتیجه"
              className={`${field} cursor-pointer`}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="">همه نتایج</option>
              <option value="win">سود</option>
              <option value="loss">ضرر</option>
              <option value="breakeven">سربه‌سر</option>
            </select>
            <select
              aria-label="برچسب"
              className={`${field} max-w-full cursor-pointer`}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">همه برچسب‌ها</option>
              {allTags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              aria-label="سشن معاملاتی"
              className={`${field} cursor-pointer`}
              value={tsession}
              onChange={(e) => setTsession(e.target.value)}
            >
              <option value="">همه سشن‌ها</option>
              {TRADING_SESSIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {SESSION_FA[s.id] ?? s.label}
                </option>
              ))}
            </select>
            {filtered ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 cursor-pointer items-center rounded-lg px-3 text-[13px] font-medium text-muted transition-colors duration-200 hover:bg-[var(--h-chip)] hover:text-fg motion-reduce:transition-none"
              >
                پاک کردن فیلترها
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 px-4 pb-4 sm:px-8">
        <div
          className={`min-h-0 min-w-0 flex-1 overflow-auto rounded-2xl border border-line bg-[var(--h-card)] ${
            current ? 'hidden lg:block' : ''
          }`}
        >
          {trades.length === 0 ? (
            <EmptyJournal
              blank={blank}
              filtered={filtered}
              chartHref={`/backtest/${id}`}
              onClear={clearFilters}
            />
          ) : (
            <>
              <ul className="flex flex-col gap-2 p-3 md:hidden">
                {trades.map((t) => {
                  const j = journal[t.id] ?? EMPTY_JOURNAL_ENTRY;
                  const r = rMultiple(ready.cfg, t);
                  const result = outcomeOf(t);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        data-trade={t.id}
                        aria-pressed={selected === t.id}
                        onClick={() => openTrade(t.id)}
                        className="flex w-full cursor-pointer flex-col gap-1 rounded-xl border border-line bg-[var(--h-field)] px-3 py-3 text-start transition-colors duration-200 hover:border-accent/40 motion-reduce:transition-none"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold">
                            #{faNum(Number(t.id))} ·{' '}
                            <span className={t.side === 'buy' ? 'text-up' : 'text-down'}>
                              {SIDE_FA[t.side]}
                            </span>
                          </span>
                          <span
                            className={`text-[13px] font-semibold tabular-nums ${pnlClass(t.netPnl)}`}
                          >
                            {signedMoney(t.netPnl)}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                          <span>{utcDateTime(t.closeTime)}</span>
                          <span>· {OUTCOME_FA[result]}</span>
                          <span>· {r === null ? '—' : `${faNum(r, 2)}R`}</span>
                        </span>
                        {j.tags.length || j.notes ? (
                          <span className="flex flex-wrap items-center gap-1 text-[12px]">
                            {j.tags.map((x) => (
                              <span
                                key={x}
                                className="rounded-md bg-accent/15 px-1.5 py-0.5 text-accent"
                              >
                                {x}
                              </span>
                            ))}
                            {j.notes ? (
                              <span className="truncate text-muted">{j.notes}</span>
                            ) : null}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[960px] text-[12.5px]" data-testid="journal-table">
                  <caption className="sr-only">معاملات دفتر</caption>
                  <thead className="sticky top-0 z-10 bg-[var(--h-card)] text-muted">
                    <tr>
                      {[
                        '#',
                        'بسته‌شدن',
                        'جهت',
                        'حجم',
                        'ورود',
                        'خروج',
                        'سود',
                        'R',
                        'مدت',
                        'علت',
                        'سشن',
                        'برچسب',
                        'یادداشت',
                      ].map((h, i) => (
                        <th
                          key={`${h}${i}`}
                          className="whitespace-nowrap px-3 py-3 text-start font-medium"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => {
                      const j = journal[t.id] ?? EMPTY_JOURNAL_ENTRY;
                      const r = rMultiple(ready.cfg, t);
                      const on = selected === t.id;
                      return (
                        <tr
                          key={t.id}
                          data-trade={t.id}
                          tabIndex={0}
                          aria-selected={on}
                          onClick={() => openTrade(t.id)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter' && e.key !== ' ') return;
                            e.preventDefault();
                            openTrade(t.id);
                          }}
                          className={`cursor-pointer border-t border-line/60 transition-colors duration-200 hover:bg-[var(--h-chip)] motion-reduce:transition-none ${
                            on ? 'bg-accent/10' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5">{faNum(Number(t.id))}</td>
                          <td className="whitespace-nowrap px-3">{utcDateTime(t.closeTime)}</td>
                          <td
                            className={`px-3 font-semibold ${t.side === 'buy' ? 'text-up' : 'text-down'}`}
                          >
                            {SIDE_FA[t.side]}
                          </td>
                          <td className="px-3 tabular-nums">{lots(t.initialVolume)}</td>
                          <td className="px-3 tabular-nums">{num(t.entryPrice, p)}</td>
                          <td className="px-3 tabular-nums">{num(t.closePrice, p)}</td>
                          <td className={`px-3 font-semibold tabular-nums ${pnlClass(t.netPnl)}`}>
                            {signedMoney(t.netPnl)}
                          </td>
                          <td className="px-3 tabular-nums">
                            {r === null ? '—' : `${faNum(r, 2)}R`}
                          </td>
                          <td className="whitespace-nowrap px-3">
                            {duration(t.closeTime - t.entryTime)}
                          </td>
                          <td className="px-3">{EXIT_REASON_LABEL[t.closeReason]}</td>
                          <td className="px-3">
                            {SESSION_FA[tradingSessionOf(t.entryTime)] ?? ''}
                          </td>
                          <td className="px-3">
                            <span className="flex flex-wrap gap-1">
                              {j.tags.map((x) => (
                                <span
                                  key={x}
                                  className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent"
                                >
                                  {x}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="max-w-56 truncate px-3 text-muted">{j.notes}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        {current ? (
          <TradeDetail
            key={current.id}
            trade={current}
            entry={journal[current.id] ?? EMPTY_JOURNAL_ENTRY}
            precision={p}
            rr={plannedRR(current)}
            r={rMultiple(ready.cfg, current)}
            loadShot={loadShot}
            onClose={closeDetail}
            onSave={async (patch, shot) => {
              if (shot) {
                const sid = `${id}-${current.id}-${shot.length}-${(ready.session.journal[current.id]?.screenshots.length ?? 0) + 1}`;
                await ready.services.repo.saveScreenshot(sid, shot);
                patch = {
                  ...patch,
                  screenshots: [
                    ...(patch.screenshots ?? journal[current.id]?.screenshots ?? []),
                    sid,
                  ],
                };
              }
              await update((s) => {
                s.journal[current.id] = {
                  ...(s.journal[current.id] ?? EMPTY_JOURNAL_ENTRY),
                  ...patch,
                };
              });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = '',
}: {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-[var(--h-card)] px-4 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={`mt-1 text-[18px] font-bold tabular-nums sm:text-[20px] ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[12px] text-muted">{hint}</p>
    </div>
  );
}

function EmptyJournal({
  blank,
  filtered,
  chartHref,
  onClear,
}: {
  readonly blank: boolean;
  readonly filtered: boolean;
  readonly chartHref: string;
  readonly onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-[var(--h-chip)] text-muted">
        <Icon name="journal" size={22} />
      </span>
      <p className="mt-4 text-[15px] font-semibold">
        {blank ? 'دفتر این جلسه خالی است' : 'با این فیلتر معامله‌ای نیست'}
      </p>
      <p className="mt-1 max-w-sm text-[13px] leading-7 text-muted">
        {blank
          ? 'هر معامله‌ای که در جلسه ببندید خودش به دفتر می‌آید. بعد می‌توانید یادداشت، برچسب و تصویر به آن بچسبانید.'
          : 'جهت، نتیجه، برچسب یا سشن را بردارید تا بقیه معاملات برگردند.'}
      </p>
      {blank ? (
        <Link href={chartHref} className="an-go mt-4">
          باز کردن نمودار
        </Link>
      ) : filtered ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex h-10 cursor-pointer items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-fg"
        >
          پاک کردن فیلترها
        </button>
      ) : null}
    </div>
  );
}

function TradeDetail({
  trade: t,
  entry,
  precision,
  rr,
  r,
  loadShot,
  onSave,
  onClose,
}: {
  readonly trade: Trade;
  readonly entry: JournalEntry;
  readonly precision: number;
  readonly rr: number | null;
  readonly r: number | null;
  readonly loadShot: (id: string) => Promise<string | null>;
  readonly onSave: (patch: Partial<JournalEntry>, screenshot?: string) => Promise<void>;
  readonly onClose: () => void;
}) {
  const [notes, setNotes] = useState(entry.notes);
  const [tagText, setTagText] = useState('');
  const [shots, setShots] = useState<Array<{ id: string; url: string }>>([]);
  const panelRef = useRef<HTMLElement>(null);
  const notesRef = useRef(notes);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    const root = panelRef.current;
    root?.querySelector<HTMLElement>('[data-close]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const saved = entry.notes;
    return () => {
      if (notesRef.current !== saved) void onSaveRef.current({ notes: notesRef.current });
    };
  }, [entry.notes]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      entry.screenshots.map(async (shotId) => ({
        id: shotId,
        url: (await loadShot(shotId)) ?? '',
      })),
    ).then((list) => !cancelled && setShots(list.filter((s) => s.url)));
    return () => {
      cancelled = true;
    };
  }, [entry.screenshots, loadShot]);

  const exc = excursionR(t);
  const result = outcomeOf(t);
  const row = (k: string, v: ReactNode) => (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="text-end tabular-nums">{v}</dd>
    </>
  );
  const addTag = () => {
    const v = tagText.trim();
    if (!v || entry.tags.includes(v)) return;
    setTagText('');
    void onSave({ tags: [...entry.tags, v] });
  };

  return (
    <aside
      ref={panelRef}
      aria-label={`معامله ${t.id}`}
      className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-line bg-[var(--h-card)] text-[13px] lg:w-[400px] lg:flex-none"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-2xl border-b border-line bg-[var(--h-card)] px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">
            معامله {faNum(Number(t.id))} ·{' '}
            <span className={t.side === 'buy' ? 'text-up' : 'text-down'}>{SIDE_FA[t.side]}</span>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`text-[14px] font-bold tabular-nums ${pnlClass(t.netPnl)}`}>
              {signedMoney(t.netPnl)}
            </span>
            <span className="rounded-full bg-[var(--h-chip)] px-2 py-0.5 text-[11px] text-muted">
              {OUTCOME_FA[result]}
            </span>
          </p>
        </div>
        <button
          type="button"
          data-close=""
          aria-label="بستن جزئیات"
          onClick={onClose}
          className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-muted transition-colors duration-200 hover:bg-[var(--h-chip)] hover:text-fg motion-reduce:transition-none"
        >
          <Icon name="chevronLeft" size={16} className="rtl:-scale-x-100 lg:hidden" />
          <span className="lg:hidden">فهرست</span>
          <Icon name="close" size={16} className="hidden lg:block" />
        </button>
      </div>

      <div className="px-4 pb-4 pt-3">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          {row('ناخالص / کارمزد', `${signedMoney(t.grossPnl)} / ${signedMoney(-t.commission)}`)}
          {row('ضریب R', r === null ? '—' : `${faNum(r, 2)}R`)}
          {row('ریسک به ریوارد برنامه', rr === null ? '—' : `۱ : ${faNum(rr, 2)}`)}
          {row(
            'ورود',
            `${num(t.entryPrice, precision)} · ${ORDER_KIND_FA[t.entryKind] ?? t.entryKind}`,
          )}
          {row('زمان ورود', utcDateTime(t.entryTime))}
          {row('خروج (میانگین)', num(t.closePrice, precision))}
          {row('زمان خروج', utcDateTime(t.closeTime))}
          {row('مدت', duration(t.closeTime - t.entryTime))}
          {row('حجم', `${lots(t.initialVolume)} لات`)}
          {row(
            'حد ضرر / حد سود اولیه',
            `${num(t.initialSl, precision)} / ${num(t.initialTp, precision)}`,
          )}
          {row(
            'بیشترین ضرر / بیشترین سود مسیر',
            exc ? `${faNum(exc.mae, 2)}R / ${faNum(exc.mfe, 2)}R` : '—',
          )}
        </dl>

        <h4 className="mb-1 mt-4 font-semibold">خروج‌ها</h4>
        <ul>
          {t.exits.map((x, i) => (
            <li
              key={i}
              className="flex justify-between gap-3 border-t border-line/60 py-1.5 tabular-nums"
            >
              <span>
                {EXIT_REASON_LABEL[x.reason]} · {lots(x.volume)} @ {num(x.price, precision)}
              </span>
              <span className={pnlClass(x.pnl)}>{signedMoney(x.pnl - x.commission)}</span>
            </li>
          ))}
        </ul>

        <div className="mb-1 mt-4 flex items-center justify-between gap-2">
          <h4 className="font-semibold">اطمینان</h4>
          <span className="text-[12px] text-muted">
            {entry.confidence ? `${faNum(entry.confidence)} از ۵` : 'ثبت نشده'}
          </span>
        </div>
        <div className="flex gap-1" role="radiogroup" aria-label="اطمینان">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={entry.confidence === n}
              aria-label={`${faNum(n)} از ۵`}
              onClick={() => void onSave({ confidence: entry.confidence === n ? null : n })}
              className={`inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg transition-colors duration-200 hover:bg-[var(--h-chip)] motion-reduce:transition-none ${
                (entry.confidence ?? 0) >= n ? 'text-accent' : 'text-muted'
              }`}
            >
              <Icon name="star" size={18} />
            </button>
          ))}
        </div>

        <h4 className="mb-1 mt-4 font-semibold">برچسب‌ها</h4>
        <div className="flex flex-wrap gap-1.5">
          {entry.tags.map((x) => (
            <span
              key={x}
              className="inline-flex items-center gap-0.5 rounded-lg bg-accent/15 py-0.5 ps-2 pe-0.5 text-accent"
            >
              {x}
              <button
                type="button"
                aria-label={`حذف برچسب ${x}`}
                onClick={() => void onSave({ tags: entry.tags.filter((y) => y !== x) })}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent/20"
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            aria-label="برچسب جدید"
            placeholder="مثلاً ستاپ الف"
            className={`${field} min-w-0 flex-1 cursor-text`}
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              addTag();
            }}
          />
          <button
            type="button"
            onClick={addTag}
            className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-accent px-3 text-[13px] font-semibold text-accent-fg transition-colors duration-200 hover:brightness-110 motion-reduce:transition-none"
          >
            افزودن
          </button>
        </div>

        <label className="mb-1 mt-4 block font-semibold" htmlFor={`note-${t.id}`}>
          یادداشت
        </label>
        <textarea
          id={`note-${t.id}`}
          className="min-h-28 w-full rounded-xl border border-line bg-[var(--h-field)] p-3 text-fg transition-colors duration-200 focus:border-accent motion-reduce:transition-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== entry.notes && void onSave({ notes })}
          placeholder="چرا وارد شدید، چطور مدیریت کردید، چه چیزی یاد گرفتید…"
        />

        <h4 className="mb-2 mt-4 font-semibold">تصویرها</h4>
        <div className="grid grid-cols-2 gap-2">
          {shots.map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-xl border border-line"
            >
              {/* Data-URL screenshots from storage: next/image cannot optimise them. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.url}
                alt={`تصویر معامله ${t.id}`}
                className="h-full w-full object-cover"
              />
            </a>
          ))}
        </div>
        <label className="mt-2 inline-flex h-10 cursor-pointer items-center gap-1.5 self-start rounded-lg border border-line px-3 text-[13px] transition-colors duration-200 hover:bg-[var(--h-chip)] motion-reduce:transition-none">
          <Icon name="camera" size={15} /> افزودن تصویر
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () =>
                typeof reader.result === 'string' && void onSave({}, reader.result);
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <p className="mt-2 text-[12px] leading-6 text-muted">
          در خود جلسه، از تب تاریخچه می‌توانید تصویر نمودار را به همین معامله بچسبانید.
        </p>
      </div>
    </aside>
  );
}
