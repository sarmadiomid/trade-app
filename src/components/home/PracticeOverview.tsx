'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { browserBacktestServices } from '@/lib/app';
import { outcomeOf, type SessionSummary, type SessionType } from '@/lib/backtest';
import { faDigits, utcToJalali } from '@/lib/locale/jalali';
import { dropPracticeTime, readPracticeStore, type PracticeStore } from '../backtest/practice-time';
import { faNum, money } from '../backtest/format';
import { statsHref } from './stats-href';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';
import {
  axisTicks,
  bucketHours,
  monthOfInstant,
  niceMax,
  remainingDays,
  replayedMs,
  selectSessions,
  sessionSpanDays,
  symbolCounts,
  winRateByActivityMonth,
  type KindFilter,
  type MonthPoint,
  type RangeFilter,
  type TradePoint,
} from './overview';

const BOOK = 'M4 5h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM8 5v14';
const FUNNEL = 'M3 5h18l-7 8v6l-4 2v-8z';
const SORT = 'M8 6v12M8 6L5 9M8 6l3 3M16 18V6M16 18l-3-3M16 18l3-3';
const BARS = 'M4 19V9M10 19V5M16 19v-6M21 19H3';

const KINDS: readonly { id: KindFilter; label: string }[] = [
  { id: 'backtesting', label: 'بک‌تست' },
  { id: 'prop', label: 'پراپ' },
  { id: 'all', label: 'همه' },
];

const RANGES: readonly { id: RangeFilter; label: string }[] = [
  { id: 'all', label: 'کل دوره' },
  { id: '30d', label: '۳۰ روز' },
  { id: '90d', label: '۹۰ روز' },
];

const SORTS = [
  { id: 'new', label: 'جدید به قدیم' },
  { id: 'old', label: 'قدیم به جدید' },
  { id: 'name', label: 'نام' },
] as const;

const STATUSES = [
  { id: 'all', label: 'همه وضعیت‌ها' },
  { id: 'in-progress', label: 'در جریان' },
  { id: 'completed', label: 'تمام‌شده' },
  { id: 'failed', label: 'ناموفق' },
] as const;

type SortId = (typeof SORTS)[number]['id'];
type StatusId = (typeof STATUSES)[number]['id'];

const card = 'rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)]';

/**
 * Practice home after the first session exists: starters, performance cards and
 * recent sessions, in the same arrangement as the reference dashboard.
 */
export function PracticeOverview({
  sessions,
  onCreate,
  onChanged,
}: {
  readonly sessions: readonly SessionSummary[];
  readonly onCreate: (type: SessionType) => void;
  readonly onChanged: () => void;
}) {
  const [kind, setKind] = useState<KindFilter>(() =>
    sessions.some((s) => s.type === 'backtesting') ? 'backtesting' : 'all',
  );
  const [range, setRange] = useState<RangeFilter>('all');
  const [trades, setTrades] = useState<readonly TradePoint[] | null>(null);
  const [practice, setPractice] = useState<PracticeStore>({});
  const [now, setNow] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortId>('new');
  const [status, setStatus] = useState<StatusId>('all');
  const [deleting, setDeleting] = useState<SessionSummary | null>(null);
  const [renaming, setRenaming] = useState<SessionSummary | null>(null);

  const ids = sessions.map((s) => s.id).join('\n');

  useEffect(() => {
    let cancel = false;
    const repo = browserBacktestServices().repo;
    void Promise.all(sessions.map((s) => repo.load(s.id))).then((loaded) => {
      if (cancel) return;
      const points: TradePoint[] = [];
      for (const session of loaded) {
        if (!session) continue;
        for (const trade of session.account.trades) {
          points.push({
            sessionId: session.id,
            symbol: session.settings.symbol,
            side: trade.side,
            win: outcomeOf(trade) === 'win',
          });
        }
      }
      setTrades(points);
    });
    return () => {
      cancel = true;
    };
  }, [ids, sessions]);

  useEffect(() => {
    const read = () => {
      setPractice(readPracticeStore());
      setNow(Date.now());
    };
    read();
    window.addEventListener('focus', read);
    document.addEventListener('visibilitychange', read);
    return () => {
      window.removeEventListener('focus', read);
      document.removeEventListener('visibilitychange', read);
    };
  }, [ids]);

  const clock = now ?? 0;
  const activeRange: RangeFilter = now === null ? 'all' : range;
  const monthLabel = now === null ? '' : monthOfInstant(now).label;
  const picked = useMemo(
    () => selectSessions(sessions, kind, activeRange, clock),
    [sessions, kind, activeRange, clock],
  );
  const pickedIds = useMemo(() => new Set(picked.map((s) => s.id)), [picked]);
  const pickedTrades = useMemo(
    () => (trades ? trades.filter((t) => pickedIds.has(t.sessionId)) : null),
    [trades, pickedIds],
  );

  const days = useMemo(() => {
    const merged: Record<string, number> = {};
    for (const s of picked) {
      const row = practice[s.id];
      if (!row) continue;
      for (const [day, ms] of Object.entries(row.days)) merged[day] = (merged[day] ?? 0) + ms;
    }
    return merged;
  }, [picked, practice]);

  const invested = useMemo(() => bucketHours(days, activeRange, clock), [days, activeRange, clock]);
  const replayed = picked.reduce((n, s) => n + replayedMs(s), 0);
  const tradeCount = pickedTrades ? pickedTrades.length : picked.reduce((n, s) => n + s.trades, 0);
  const buys = pickedTrades?.filter((t) => t.side === 'buy').length ?? 0;
  const wins = pickedTrades?.filter((t) => t.win).length ?? 0;

  const winMonths = useMemo(() => {
    if (!pickedTrades) return null;
    const bySession = new Map<string, { wins: number; trades: number }>();
    for (const t of pickedTrades) {
      const row = bySession.get(t.sessionId) ?? { wins: 0, trades: 0 };
      row.trades += 1;
      if (t.win) row.wins += 1;
      bySession.set(t.sessionId, row);
    }
    return winRateByActivityMonth(
      picked.map((s) => ({
        updatedAt: s.updatedAt,
        wins: bySession.get(s.id)?.wins ?? 0,
        trades: bySession.get(s.id)?.trades ?? 0,
      })),
    );
  }, [picked, pickedTrades]);

  const symbols = useMemo(
    () =>
      symbolCounts(
        picked.map((s) => ({
          symbol: s.symbol,
          count: pickedTrades ? pickedTrades.filter((t) => t.sessionId === s.id).length : s.trades,
        })),
      ),
    [picked, pickedTrades],
  );

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = sessions.filter((s) => {
      if (status !== 'all' && s.status !== status) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.symbol.toLowerCase().includes(q);
    });
    rows.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'fa');
      const dir = sort === 'new' ? -1 : 1;
      return (a.updatedAt - b.updatedAt) * dir;
    });
    return rows;
  }, [sessions, query, sort, status]);

  const remove = async () => {
    if (!deleting) return;
    const id = deleting.id;
    setDeleting(null);
    await browserBacktestServices().repo.remove(id);
    dropPracticeTime(id);
    onChanged();
  };

  return (
    <div data-testid="practice-overview" className="px-4 py-5 sm:px-8">
      <div className="grid gap-3 md:grid-cols-3">
        <ActionTile
          testId="start-backtest"
          icon="plus"
          title="جلسه بک‌تست"
          text="شروع جلسه"
          hint="بازپخش کندل‌به‌کندل روی گذشتهٔ بازار، با حساب مجازی."
          onClick={() => onCreate('backtesting')}
        />
        <ActionTile
          testId="start-prop"
          icon="trophy"
          title="جلسه پراپ"
          text="شروع چالش"
          hint="هدف سود، سقف ضرر روزانه و سقف ضرر کلی."
          onClick={() => onCreate('prop')}
        />
        <ActionTile
          icon={null}
          path={BOOK}
          title="آموزش"
          text="به زودی"
          hint="درس‌ها هنوز باز نشده‌اند."
          href="/home/learn"
        />
      </div>

      <div className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold">عملکرد</h2>
        <div className="flex items-center gap-2">
          <PillMenu label="نوع جلسه" value={kind} options={KINDS} onChange={setKind} />
          <PillMenu label="بازه" value={range} options={RANGES} onChange={setRange} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <Metric
          className="order-1 min-h-[158px] lg:order-0"
          iconPath={BARS}
          label="زمان صرف‌شده"
          hint="مدتی که صفحهٔ بازپخش باز و جلوی چشم بوده است."
        >
          <Duration ms={invested.totalMs} small="دقیقه" />
        </Metric>
        <Metric
          className="order-2 min-h-[158px] lg:order-0"
          icon="clock"
          label="زمان تاریخی بازپخش"
          hint="مقدار بازار که نشانگر بازپخش از ابتدای جلسه جلو رفته است."
        >
          <Duration ms={replayed} small="دقیقه" coarse />
        </Metric>
        <ColumnChart
          className="order-5 min-h-[250px] lg:order-0 lg:col-span-2 lg:row-span-2"
          title="زمان صرف‌شده"
          hint="جمع زمان حضور در هر ماه."
          bars={
            invested.months.length > 0
              ? invested.months
              : [{ key: 'current', label: monthLabel, value: 0 }]
          }
          max={niceMax(Math.max(0, ...invested.months.map((m) => m.value)))}
          gradient={['#ffe08a', '#e8941a']}
          gradientId="ov-gold"
          formatTick={(v) => `${faNum(v, v >= 10 ? 0 : 1)} س`}
          formatBar={(v) => `${faNum(v, v >= 10 ? 1 : 2)} ساعت`}
          empty="وقتی بازپخش باز باشد، زمان حضور اینجا جمع می‌شود."
        />
        <Metric
          className="order-3 min-h-[158px] lg:order-0"
          icon="journal"
          label="معاملات انجام‌شده"
          hint="معاملات بسته‌شده در جلسه‌های این نما."
        >
          <span>{faNum(tradeCount)}</span>
          {pickedTrades && tradeCount > 0 ? (
            <SplitBar leftPct={(buys / tradeCount) * 100} leftLabel="خرید" rightLabel="فروش" />
          ) : (
            <p className="mt-3 text-[12px] font-medium text-[var(--h-muted)]">
              {pickedTrades ? 'هنوز معامله‌ای بسته نشده' : '…'}
            </p>
          )}
        </Metric>
        <Metric
          className="order-4 min-h-[158px] lg:order-0"
          icon="target"
          label="نرخ برد کلی"
          hint="سهم معاملات بسته‌شده‌ای که سود خالص داشته‌اند."
        >
          <span>
            {pickedTrades
              ? tradeCount > 0
                ? `${faNum((wins / tradeCount) * 100, 2)}٪`
                : '—'
              : '…'}
          </span>
        </Metric>
        <ColumnChart
          className="order-6 min-h-[250px] lg:order-0 lg:col-span-2"
          title="نرخ برد"
          hint="نرخ برد معاملات هر ماه، بر اساس آخرین کار روی جلسه."
          bars={
            winMonths && winMonths.length > 0
              ? winMonths
              : [{ key: 'current', label: monthLabel, value: 0 }]
          }
          max={100}
          gradient={['#8eb6ff', '#1d4ed8']}
          gradientId="ov-blue"
          formatTick={(v) => `${faNum(Math.round(v))}٪`}
          formatBar={(v) => `${faNum(v, 1)}٪`}
          empty={pickedTrades ? 'با بستن معامله، نرخ برد هر ماه اینجا می‌آید.' : '…'}
          loading={winMonths === null}
        />
        <SymbolChart className="order-7 lg:order-0 lg:col-span-2" rows={symbols} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-[16px] font-semibold">جلسه‌های اخیر</h2>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-[var(--h-line)] bg-[var(--h-field)] px-3 sm:max-w-xs">
            <Icon name="search" size={16} className="text-[var(--h-muted)]" />
            <span className="sr-only">جستجوی جلسه</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--h-muted)]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-[var(--h-muted)]">
              {faNum(listed.length)} از {faNum(sessions.length)} جلسه
            </span>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--h-line)]">
              <span
                className="block h-full rounded-full bg-[#3b78ff]"
                style={{
                  width: `${sessions.length ? (listed.length / sessions.length) * 100 : 0}%`,
                }}
              />
            </span>
            <PillMenu
              label="وضعیت"
              value={status}
              options={STATUSES}
              onChange={setStatus}
              icon={<Icon path={FUNNEL} size={14} />}
              iconOnly={status === 'all'}
            />
            <PillMenu
              label="ترتیب"
              value={sort}
              options={SORTS}
              onChange={setSort}
              icon={<Icon path={SORT} size={14} />}
            />
          </div>
        </div>

        {listed.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--h-line)] px-4 py-10 text-center text-[13px] text-[var(--h-muted)]">
            جلسه‌ای با این جستجو پیدا نشد.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {listed.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onDelete={() => setDeleting(s)}
                onRename={() => setRenaming(s)}
              />
            ))}
          </ul>
        )}
      </section>

      {deleting ? (
        <Dialog
          title="جلسه حذف شود؟"
          onClose={() => setDeleting(null)}
          width={420}
          footer={
            <>
              <div className="flex-1" />
              <Button onClick={() => setDeleting(null)}>انصراف</Button>
              <Button variant="danger" onClick={() => void remove()}>
                حذف
              </Button>
            </>
          }
        >
          <p className="p-5 text-[13px] leading-6">
            «{deleting.name}» به همراه {faNum(deleting.trades)} معامله، یادداشت‌ها و تصویرها پاک
            می‌شود. این کار برگشت‌پذیر نیست.
          </p>
        </Dialog>
      ) : null}

      {renaming ? (
        <RenameDialog
          key={renaming.id}
          session={renaming}
          onClose={() => setRenaming(null)}
          onSaved={() => {
            setRenaming(null);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

export function PracticeSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 px-4 py-6 sm:px-8 lg:grid-cols-4">
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={i}
          className={`h-36 animate-pulse rounded-2xl bg-[var(--h-chip)] ${
            i === 2 ? 'lg:col-span-2 lg:row-span-2 lg:h-auto lg:min-h-72' : ''
          } ${i > 4 ? 'lg:col-span-2' : ''}`}
        />
      ))}
    </div>
  );
}

function ActionTile({
  testId,
  icon,
  path,
  title,
  text,
  hint,
  href,
  onClick,
}: {
  readonly testId?: string;
  readonly icon: IconName | null;
  readonly path?: string;
  readonly title: string;
  readonly text: string;
  readonly hint: string;
  readonly href?: string;
  readonly onClick?: () => void;
}) {
  const className = `${card} flex items-center gap-3 px-4 py-3 text-start transition hover:border-[var(--h-accent)]/45`;
  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--h-line)] text-[var(--h-muted)]">
        {path ? <Icon path={path} size={16} /> : <Icon name={icon ?? 'plus'} size={16} />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[14px] font-semibold">
          {title}
          <span title={hint} className="text-[var(--h-muted)]">
            <Icon name="info" size={13} />
          </span>
        </span>
        <span className="mt-0.5 block text-[12px] text-[var(--h-muted)]">{text}</span>
      </span>
    </>
  );
  if (href) {
    return (
      <Link href={href} data-testid={testId} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" data-testid={testId} onClick={onClick} className={className}>
      {body}
    </button>
  );
}

function Metric({
  className = '',
  icon,
  iconPath,
  label,
  hint,
  children,
}: {
  readonly className?: string;
  readonly icon?: IconName;
  readonly iconPath?: string;
  readonly label: string;
  readonly hint: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={`${card} relative flex h-full flex-col p-4 ${className}`}
    >
      <div className="flex items-center gap-2 pe-6 text-[13px] text-[var(--h-muted)]">
        {iconPath ? <Icon path={iconPath} size={15} /> : <Icon name={icon ?? 'info'} size={15} />}
        <span>{label}</span>
      </div>
      <span title={hint} className="absolute end-3.5 top-3.5 text-[var(--h-muted)]">
        <Icon name="info" size={15} />
      </span>
      <div className="mt-4 text-[30px] font-bold leading-none tracking-tight tabular-nums">
        {children}
      </div>
    </section>
  );
}

function Duration({
  ms,
  coarse = false,
  small,
}: {
  readonly ms: number;
  readonly coarse?: boolean;
  readonly small: string;
}) {
  if (!(ms >= 60_000)) {
    const min = ms > 0 ? Math.max(1, Math.round(ms / 60_000)) : 0;
    return (
      <span>
        {faNum(min)}
        <Unit>{small}</Unit>
      </span>
    );
  }
  if (!coarse && ms < 3_600_000) {
    return (
      <span>
        {faNum(Math.round(ms / 60_000))}
        <Unit>دقیقه</Unit>
      </span>
    );
  }
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  if (days > 0) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span>
          {faNum(days)}
          <Unit>روز</Unit>
        </span>
        <span>
          {faNum(h)}
          <Unit>ساعت</Unit>
        </span>
      </span>
    );
  }
  const minutes = Math.round((ms - hours * 3_600_000) / 60_000);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span>
        {faNum(hours)}
        <Unit>ساعت</Unit>
      </span>
      {minutes > 0 ? (
        <span>
          {faNum(minutes)}
          <Unit>دقیقه</Unit>
        </span>
      ) : null}
    </span>
  );
}

function Unit({ children }: { readonly children: string }) {
  return <span className="ms-1.5 text-[15px] font-semibold text-[var(--h-muted)]">{children}</span>;
}

function SplitBar({
  leftPct,
  leftLabel,
  rightLabel,
}: {
  readonly leftPct: number;
  readonly leftLabel: string;
  readonly rightLabel: string;
}) {
  const right = Math.max(0, 100 - leftPct);
  return (
    <div className="mt-4 text-[12px] font-semibold leading-none">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--h-line)]">
        <span className="h-full bg-[#3dcea0]" style={{ width: `${leftPct}%` }} />
        <span className="h-full bg-[#ff6b81]" style={{ width: `${right}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[#3dcea0]">
          {faNum(leftPct, 2)}٪ {leftLabel}
        </span>
        <span className="text-[#ff6b81]">
          {faNum(right, 2)}٪ {rightLabel}
        </span>
      </div>
    </div>
  );
}

function ColumnChart({
  className = '',
  title,
  hint,
  bars,
  max,
  gradient,
  gradientId,
  formatTick,
  formatBar,
  empty,
  loading = false,
}: {
  readonly className?: string;
  readonly title: string;
  readonly hint: string;
  readonly bars: readonly MonthPoint[];
  readonly max: number;
  readonly gradient: readonly [string, string];
  readonly gradientId: string;
  readonly formatTick: (v: number) => string;
  readonly formatBar: (v: number) => string;
  readonly empty: string;
  readonly loading?: boolean;
}) {
  const ticks = axisTicks(max, 5);
  const w = 640;
  const h = 248;
  const padL = 58;
  const padR = 18;
  const padT = 12;
  const padB = 36;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const n = Math.max(bars.length, 1);
  const slot = plotW / n;
  const barW = bars.length <= 1 ? plotW * 0.74 : Math.min(slot * 0.58, 64);
  const show = bars.some((b) => b.value > 0);

  return (
    <section
      aria-label={show ? title : `${title}. ${empty}`}
      className={`${card} relative flex h-full flex-col p-4 ${className}`}
    >
      <div className="flex items-center gap-2 pe-6 text-[13px] text-[var(--h-muted)]">
        <span>{title}</span>
      </div>
      <span title={hint} className="absolute end-3.5 top-3.5 text-[var(--h-muted)]">
        <Icon name="info" size={15} />
      </span>
      {loading ? (
        <p className="flex flex-1 items-center justify-center text-[13px] text-[var(--h-muted)]">
          …
        </p>
      ) : (
        <div className="relative mt-2 flex-1" dir="ltr">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            aria-hidden="true"
            className="h-[220px] w-full text-[var(--h-muted)]"
            style={{ fontFamily: 'inherit' }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradient[0]} />
                <stop offset="100%" stopColor={gradient[1]} />
              </linearGradient>
            </defs>
            {ticks.map((t) => {
              const y = padT + plotH - (max > 0 ? (t / max) * plotH : plotH);
              return (
                <g key={t}>
                  <line
                    x1={padL}
                    x2={w - padR}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.28"
                    strokeDasharray="4 7"
                  />
                  <text x={padL - 8} y={y + 4} textAnchor="end" fill="currentColor" fontSize="13">
                    {formatTick(t)}
                  </text>
                </g>
              );
            })}
            {bars.map((b, i) => {
              const bh = b.value > 0 ? Math.max(8, (b.value / max) * plotH) : 0;
              const x = padL + slot * i + (slot - barW) / 2;
              const y = padT + plotH - bh;
              const label = bars.length > 4 ? (b.label.split(' ')[0] ?? b.label) : b.label;
              return (
                <g key={b.key}>
                  {b.value > 0 ? <title>{`${b.label}: ${formatBar(b.value)}`}</title> : null}
                  {bh > 0 ? (
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={bh}
                      rx="8"
                      fill={`url(#${gradientId})`}
                    />
                  ) : null}
                  <text
                    x={padL + slot * i + slot / 2}
                    y={h - 10}
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="14"
                    direction="rtl"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}

function SymbolChart({
  rows,
  className = '',
}: {
  readonly rows: readonly { symbol: string; count: number }[];
  readonly className?: string;
}) {
  const max = niceMax(Math.max(0, ...rows.map((r) => r.count)));
  const ticks = [0, max / 2, max];
  return (
    <section
      aria-label="معاملات هر نماد"
      className={`${card} relative flex h-full min-h-[250px] flex-col p-4 ${className}`}
    >
      <div className="pe-6 text-[13px] text-[var(--h-muted)]">معاملات هر نماد</div>
      <span
        title="تعداد معاملات بسته‌شده به تفکیک نماد."
        className="absolute end-3.5 top-3.5 text-[var(--h-muted)]"
      >
        <Icon name="info" size={15} />
      </span>
      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-center text-[13px] text-[var(--h-muted)]">
          هنوز معامله‌ای بسته نشده.
        </p>
      ) : (
        <div className="mt-4 flex min-h-0 flex-1 flex-col justify-center gap-3">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 start-[118px] end-0 flex justify-between">
              {ticks.map((t) => (
                <span key={t} className="w-px border-s border-dashed border-[var(--h-muted)]/30" />
              ))}
            </div>
            <ul className="relative flex flex-col gap-3">
              {rows.map((row) => (
                <li
                  key={row.symbol}
                  className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2"
                >
                  <span dir="ltr" className="truncate text-end text-[12px] font-medium">
                    {row.symbol}
                  </span>
                  <span className="block h-7">
                    <span
                      className="block h-full rounded-md"
                      style={{
                        width: `${Math.max(2, (row.count / max) * 100)}%`,
                        marginInlineEnd: 'auto',
                        background: 'linear-gradient(to left, #6d28d9, #e879f9)',
                      }}
                      title={`${row.symbol}: ${faNum(row.count)}`}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-[110px_minmax(0,1fr)] text-[11px] text-[var(--h-muted)]">
            <span />
            <span className="flex justify-between tabular-nums">
              {ticks.map((t) => (
                <span key={t}>{axisNumber(t)}</span>
              ))}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function SessionRow({
  session,
  onDelete,
  onRename,
}: {
  readonly session: SessionSummary;
  readonly onDelete: () => void;
  readonly onRename: () => void;
}) {
  const left = remainingDays(session);
  const done = session.status !== 'in-progress';
  return (
    <li className={`${card} flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:px-4`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link
          href={`/backtest/${session.id}`}
          aria-label={`ادامه ${session.name}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0d59f2] text-white shadow-[0_0_16px_rgba(13,89,242,0.45)] transition hover:bg-[#1e68ff]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l12-7z" fill="currentColor" />
          </svg>
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{session.name}</span>
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--h-line)] px-1.5 py-0.5 text-[11px] text-[var(--h-muted)]">
              <Icon name="clock" size={12} />
              {faNum(sessionSpanDays(session))} روز
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--h-muted)]">
            <Icon name="calendar" size={13} />
            <span>{shortDate(session.startDate)}</span>
            <span>–</span>
            <span>{shortDate(session.endDate)}</span>
            <span>·</span>
            <bdi dir="ltr">{money(session.startingBalance)}</bdi>
          </p>
          <span className="mt-1.5 inline-flex rounded-full border border-[var(--h-line)] px-2 py-0.5 text-[11px] font-medium">
            <bdi dir="ltr">{session.symbol}</bdi>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 sm:shrink-0">
        <span className="px-1 text-[12px] text-[var(--h-muted)]">
          {done
            ? session.status === 'failed'
              ? 'ناموفق'
              : 'تمام‌شده'
            : `روز باقی‌مانده: ${faNum(left)}`}
        </span>
        <IconLink label={`حذف ${session.name}`} onClick={onDelete} name="trash" />
        <IconLink label={`ویرایش نام ${session.name}`} onClick={onRename} name="edit" />
        <IconLink
          label={`دفتر ${session.name}`}
          href={`/backtest/${session.id}/journal`}
          name="journal"
        />
        <Link
          href={statsHref(session.id)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--h-line)] px-3 text-[12px] font-medium transition hover:bg-[var(--h-chip)]"
        >
          <Icon name="chart" size={14} />
          خلاصه
        </Link>
      </div>
    </li>
  );
}

function IconLink({
  label,
  name,
  href,
  onClick,
}: {
  readonly label: string;
  readonly name: IconName;
  readonly href?: string;
  readonly onClick?: () => void;
}) {
  const className =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)]';
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={className}>
        <Icon name={name} size={15} />
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={className}>
      <Icon name={name} size={15} />
    </button>
  );
}

function axisNumber(v: number): string {
  const nearest = Math.round(v * 10) / 10;
  const whole = Math.abs(nearest - Math.round(nearest)) < 0.001;
  return faNum(whole ? Math.round(nearest) : nearest, whole ? 0 : 1);
}

function shortDate(t: number): string {
  const j = utcToJalali(t);
  const p = (n: number) => faDigits(String(n).padStart(2, '0'));
  return `${faDigits(j.jy)}/${p(j.jm)}/${p(j.jd)}`;
}

function PillMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
  iconOnly = false,
}: {
  readonly label: string;
  readonly value: T;
  readonly options: readonly { id: T; label: string }[];
  readonly onChange: (id: T) => void;
  readonly icon?: ReactNode;
  readonly iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const current = options.find((o) => o.id === value)?.label ?? label;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--h-line)] bg-[var(--h-chip)] text-[13px] font-medium ${
          iconOnly ? 'w-9 justify-center px-0' : 'px-3'
        }`}
      >
        {icon}
        {iconOnly ? null : current}
        {iconOnly ? null : <Icon name="chevronDown" size={14} className="text-[var(--h-muted)]" />}
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute end-0 z-20 mt-1.5 min-w-40 rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-1 shadow-2xl"
        >
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-[13px] ${
                  o.id === value ? 'bg-[var(--h-soft)]' : 'hover:bg-[var(--h-chip)]'
                }`}
              >
                {o.id === value ? (
                  <Icon name="check" size={14} className="text-[var(--h-accent)]" />
                ) : (
                  <span className="w-3.5" />
                )}
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RenameDialog({
  session,
  onClose,
  onSaved,
}: {
  readonly session: SessionSummary;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const [name, setName] = useState(session.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const next = name.trim();
    if (!next) {
      setError('نام جلسه را وارد کنید');
      return;
    }
    if (next.length > 60) {
      setError('نام جلسه حداکثر ۶۰ نویسه است');
      return;
    }
    setBusy(true);
    const repo = browserBacktestServices().repo;
    const fresh = await repo.load(session.id);
    if (!fresh) {
      setBusy(false);
      setError('این جلسه دیگر وجود ندارد');
      return;
    }
    fresh.settings = { ...fresh.settings, name: next };
    fresh.updatedAt = Date.now();
    await repo.save(fresh);
    onSaved();
  };
  return (
    <Dialog
      title="نام جلسه"
      onClose={onClose}
      width={420}
      initialFocus="[data-rename]"
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>انصراف</Button>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            {busy ? '…' : 'ذخیره'}
          </Button>
        </>
      }
    >
      <form
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="block text-[13px]">
          <span className="text-[var(--h-muted)]">نام</span>
          <input
            value={name}
            data-rename=""
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--h-line)] bg-[var(--h-field)] px-3 text-[14px] outline-none focus:border-[var(--h-accent)]"
          />
        </label>
        {error ? <p className="mt-2 text-[12px] text-[#ff6b81]">{error}</p> : null}
      </form>
    </Dialog>
  );
}
