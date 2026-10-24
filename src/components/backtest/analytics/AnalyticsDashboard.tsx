'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { scanExcursions } from '@/lib/app';
import {
  TRADING_SESSIONS,
  byDay,
  byHour,
  bySession,
  bySide,
  byWeekday,
  computeStats,
  equityCurve,
  histogram,
  idealRR,
  initialRisk,
  periodAverages,
  simulateRR,
  tradingSessionOf,
  type Bucket,
  type Excursion,
  type Trade,
} from '@/lib/backtest';
import { JALALI_MONTHS, utcToJalali } from '@/lib/locale/jalali';
import { useThemeCssVars } from '../../hooks/useThemeCssVars';
import { Icon } from '../../ui/Icon';
import {
  duration,
  faDigits,
  faNum,
  failReasonFa,
  money,
  pct,
  plainPct,
  pnlClass,
  SESSION_FA,
  signedMoney,
  utcDate,
  utcDateTime,
  WEEKDAY_NAMES,
} from '../format';
import { journalHref } from '../../home/journal-href';
import { useStoredSession } from '../useStoredSession';
import { BarChart, DonutChart, HBars, LineChart, RadarChart, type BarDatum } from './charts';
import { PnlCalendar } from './PnlCalendar';
import { RRSimulator } from './RRSimulator';

type SideFilter = 'all' | 'buy' | 'sell';

const BLUE = '#4c8dff';
const GREEN = '#2fce9a';
const RED = '#ff5d73';
const SESSION_SHORT = ['آسیا', 'لندن', 'نیویورک', 'آف'] as const;
const PERIOD_FA = { day: 'روز', week: 'هفته', month: 'ماه' } as const;

const r2 = (v: number | null | undefined, suffix = '') =>
  v === null || v === undefined ? '—' : `${faNum(v, 2)}${suffix}`;

interface MonthRow {
  readonly key: string;
  readonly y: number;
  readonly m: number;
  readonly label: string;
  readonly pnl: number;
  readonly trades: number;
  readonly wins: number;
  readonly r: number;
}

function monthsOf(days: ReadonlyMap<number, Bucket>): MonthRow[] {
  const acc = new Map<string, MonthRow>();
  for (const [time, bucket] of days) {
    const j = utcToJalali(time);
    const key = `${j.jy}-${j.jm}`;
    const row = acc.get(key) ?? {
      key,
      y: j.jy,
      m: j.jm,
      label: `${JALALI_MONTHS[j.jm - 1] ?? ''} ${faDigits(j.jy)}`,
      pnl: 0,
      trades: 0,
      wins: 0,
      r: 0,
    };
    acc.set(key, {
      ...row,
      pnl: row.pnl + bucket.pnl,
      trades: row.trades + bucket.trades,
      wins: row.wins + bucket.wins,
      r: row.r + bucket.r,
    });
  }
  return [...acc.values()].sort((a, b) => a.y - b.y || a.m - b.m);
}

function shortDate(time: number): string {
  const j = utcToJalali(time);
  return `${faNum(j.jd)} ${JALALI_MONTHS[j.jm - 1] ?? ''}`;
}

const bucketTip = (title: string, b: Bucket) => (
  <span>
    <b>{title}</b> · {faNum(b.trades)} معامله · {signedMoney(b.pnl)} · برد{' '}
    {faNum(Math.round(b.winRate * 100))}٪ · {faNum(b.r, 2)}R
  </span>
);

function Heading({
  title,
  hint,
  swatch,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly swatch?: string;
}) {
  return (
    <h2 className="an-heading">
      {swatch ? <span className="an-swatch" style={{ background: swatch }} /> : null}
      {title}
      {hint ? (
        <span className="an-hint" title={hint}>
          <Icon name="info" size={14} />
        </span>
      ) : null}
    </h2>
  );
}

function Metric({
  label,
  value,
  sub,
  cls = '',
  lead = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub?: string;
  readonly cls?: string;
  readonly lead?: boolean;
}) {
  return (
    <div>
      <div className="an-label">{label}</div>
      <div className={`${lead ? 'an-lead' : 'an-value'} tabular-nums ${cls}`}>{value}</div>
      {sub ? <div className="an-metric-sub">{sub}</div> : null}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  cls = '',
}: {
  readonly label: string;
  readonly value: string;
  readonly sub?: string | undefined;
  readonly cls?: string;
}) {
  return (
    <div className="an-tile">
      <div className="an-tile-label">{label}</div>
      <div className={`an-tile-value tabular-nums ${cls}`}>{value}</div>
      {sub ? <div className="an-tile-sub">{sub}</div> : null}
    </div>
  );
}

function StatRows({
  rows,
}: {
  readonly rows: readonly { label: string; value: string; cls?: string }[];
}) {
  return (
    <dl className="an-stats">
      {rows.map((row) => (
        <div key={row.label} className="an-stat">
          <dt>{row.label}</dt>
          <dd className={`tabular-nums ${row.cls ?? ''}`}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EmptyState({
  title,
  body,
  href,
  ghost = 'bars',
  action = true,
}: {
  readonly title: string;
  readonly body: string;
  readonly href: string;
  readonly ghost?: 'bars' | 'calendar';
  readonly action?: boolean;
}) {
  return (
    <div className="an-empty">
      {ghost === 'bars' ? (
        <div className="an-ghost-bars" aria-hidden>
          {[42, 68, 54, 86, 48, 74, 60, 36].map((height) => (
            <span key={height} style={{ height: `${height}%` }} />
          ))}
        </div>
      ) : (
        <div className="an-ghost-cal" aria-hidden>
          {Array.from({ length: 35 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      )}
      <div className="an-empty-copy">
        <p className="an-empty-title">{title}</p>
        <p className="an-empty-body">{body}</p>
        {action ? (
          <Link href={href} className="an-empty-btn">
            باز کردن نمودار
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function FilteredEmpty({
  blank,
  href,
  title,
  body,
  ghost = 'bars',
}: {
  readonly blank: boolean;
  readonly href: string;
  readonly title: string;
  readonly body: string;
  readonly ghost?: 'bars' | 'calendar';
}) {
  return (
    <EmptyState
      href={href}
      ghost={ghost}
      action={blank}
      title={blank ? title : 'با این فیلتر معامله‌ای نیست'}
      body={blank ? body : 'فیلتر جهت، برچسب یا سشن را بردارید تا آمار جلسه برگردد.'}
    />
  );
}

/**
 * Session statistics. `embedded` renders inside the home shell (sidebar and top bar
 * stay put). The standalone page redirects there.
 */
export default function AnalyticsDashboard({
  id,
  embedded = false,
}: {
  readonly id: string;
  readonly embedded?: boolean;
}) {
  useThemeCssVars();
  const { state } = useStoredSession(id);
  const [side, setSide] = useState<SideFilter>('all');
  const [tag, setTag] = useState('');
  const [tsession, setTsession] = useState('');
  const [excursions, setExcursions] = useState<Excursion[] | null>(null);
  const [progress, setProgress] = useState('');

  const ready = state.status === 'ready' ? state : null;
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void scanExcursions(
      ready.services.market,
      ready.session,
      ready.cfg,
      ready.session.account.trades,
      (d, t) => {
        if (!cancelled) setProgress(`${faNum(d)} از ${faNum(t)}`);
      },
    ).then((ex) => !cancelled && setExcursions(ex));
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const tags = useMemo(() => {
    if (!ready) return [];
    return [...new Set(Object.values(ready.session.journal).flatMap((j) => j.tags))].sort();
  }, [ready]);

  const trades = useMemo((): Trade[] => {
    if (!ready) return [];
    return ready.session.account.trades.filter(
      (t) =>
        (side === 'all' || t.side === side) &&
        (!tag || (ready.session.journal[t.id]?.tags ?? []).includes(tag)) &&
        (!tsession || tradingSessionOf(t.entryTime) === tsession),
    );
  }, [ready, side, tag, tsession]);

  const a = useMemo(() => {
    if (!ready) return null;
    const { cfg, session } = ready;
    const ids = new Set(trades.map((t) => t.id));
    const rr = excursions ? simulateRR(excursions.filter((e) => ids.has(e.tradeId))) : null;
    return {
      stats: computeStats(cfg, trades),
      curve: equityCurve(cfg, trades, session.settings.startDate),
      weekday: byWeekday(cfg, trades),
      hour: byHour(cfg, trades),
      sessions: bySession(cfg, trades),
      sides: bySide(cfg, trades),
      days: byDay(cfg, trades),
      periods: (['day', 'week', 'month'] as const).map(
        (p) => [p, periodAverages(cfg, trades, p)] as const,
      ),
      pnlHist: histogram(
        trades.map((t) => t.netPnl),
        12,
      ),
      rHist: histogram(
        trades
          .map((t) => {
            const risk = initialRisk(cfg, t);
            return risk === null ? null : t.netPnl / risk;
          })
          .filter((x): x is number => x !== null),
        12,
      ),
      rr,
      ideal: rr ? idealRR(rr) : null,
    };
  }, [ready, trades, excursions]);

  if (state.status === 'loading')
    return (
      <div
        className={
          embedded
            ? 'px-4 py-10 text-center text-[13px] text-[var(--h-muted)] sm:px-8'
            : 'an-page flex h-full items-center justify-center text-muted'
        }
      >
        در حال بارگذاری…
      </div>
    );
  if (state.status === 'missing' || !a || !ready)
    return (
      <div
        className={
          embedded
            ? 'flex flex-col items-center gap-3 px-4 py-10 text-center sm:px-8'
            : 'an-page flex h-full flex-col items-center justify-center gap-3'
        }
      >
        <p className="text-muted">این جلسه وجود ندارد.</p>
        <Link href={embedded ? '/home?tab=sessions' : '/backtest'} className="text-accent">
          بازگشت به جلسه‌ها
        </Link>
      </div>
    );

  const { session } = ready;
  const s = a.stats;
  const chartHref = `/backtest/${id}`;
  const empty = trades.length === 0;
  const blank = session.account.trades.length === 0;
  const months = monthsOf(a.days);
  const curve =
    a.curve.length >= 2
      ? a.curve
      : [
          { ...a.curve[0]!, time: session.settings.startDate },
          { ...a.curve[0]!, time: session.settings.endDate },
        ];
  const pf = s.profitFactor === null ? (s.grossProfit > 0 ? '∞' : '—') : faNum(s.profitFactor, 2);
  const expPos =
    s.expectancyR === null ? 50 : ((Math.max(-2, Math.min(2, s.expectancyR)) + 2) / 4) * 100;
  const lossRate = s.totalTrades ? s.losers / s.totalTrades : 0;
  const activeDays = a.days.size;
  const perDay = activeDays ? trades.length / activeDays : 0;
  const status = session.account.status;
  const chip =
    status === 'active' ? 'an-chip-live' : status === 'ended' ? 'an-chip' : 'an-chip-bad';
  const statusLine =
    status === 'active'
      ? 'در جریان'
      : status === 'ended'
        ? 'تمام‌شده'
        : failReasonFa(session.account.failReason ?? '');
  const sessionAxes = (pick: (b: Bucket) => number) =>
    a.sessions.map((b, i) => ({ label: SESSION_SHORT[i] ?? '', value: pick(b) }));

  const filters = (
    <>
      <select
        aria-label="جهت"
        className="an-select"
        value={side}
        onChange={(e) => setSide(e.target.value as SideFilter)}
      >
        <option value="all">همه جهت‌ها</option>
        <option value="buy">خرید</option>
        <option value="sell">فروش</option>
      </select>
      <select
        aria-label="برچسب"
        className="an-select"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
      >
        <option value="">همه برچسب‌ها</option>
        {tags.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <select
        aria-label="سشن معاملاتی"
        className="an-select"
        value={tsession}
        onChange={(e) => setTsession(e.target.value)}
      >
        <option value="">همه سشن‌ها</option>
        {TRADING_SESSIONS.map((x) => (
          <option key={x.id} value={x.id}>
            {SESSION_FA[x.id] ?? x.label} ({faNum(x.from)}–{faNum(x.to)})
          </option>
        ))}
      </select>
      <span className="text-[12.5px] text-muted">{faNum(trades.length)} معامله</span>
      <Link href={chartHref} className="an-go">
        {status === 'active' ? 'ادامه جلسه' : 'باز کردن نمودار'}
      </Link>
    </>
  );

  return (
    <div className={embedded ? 'an-embed flex flex-col gap-4' : 'an-page h-full overflow-y-auto'}>
      {embedded ? null : (
        <header className="an-head">
          <div className="an-wrap flex flex-wrap items-center gap-2 py-3">
            <Link href="/backtest" className="an-back">
              <Icon name="chevronLeft" size={16} className="rtl:-scale-x-100" /> جلسه‌ها
            </Link>
            <nav className="an-tabs" aria-label="بخش‌های جلسه">
              <span className="an-tab-on">عملکرد</span>
              <Link href={journalHref(id)} className="an-tab">
                دفتر معاملات
              </Link>
            </nav>
            <div className="ms-auto flex flex-wrap items-center gap-2">{filters}</div>
          </div>
        </header>
      )}

      <main
        className={
          embedded
            ? 'flex flex-col gap-4 px-4 pb-10 pt-4 sm:px-8'
            : 'an-wrap flex flex-col gap-4 py-5'
        }
        data-testid="analytics"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {embedded ? (
              <h2 className="an-title">{session.settings.name}</h2>
            ) : (
              <h1 className="an-title">{session.settings.name}</h1>
            )}
            <p className="an-sub">
              <bdi>{session.settings.symbol}</bdi>
              <span className={chip}>{statusLine}</span>
            </p>
          </div>
          <div className="an-range">
            <Icon name="calendar" size={15} />
            <span>
              {utcDate(session.settings.startDate)} – {utcDate(session.settings.endDate)}
            </span>
            <span className="an-tz">ساعت جهانی</span>
          </div>
        </div>

        {embedded ? (
          <div className="flex flex-wrap items-center gap-2">
            <nav className="an-tabs" aria-label="بخش‌های جلسه">
              <span className="an-tab-on">عملکرد</span>
              <Link href={journalHref(id)} className="an-tab">
                دفتر معاملات
              </Link>
            </nav>
            <div className="ms-auto flex flex-wrap items-center gap-2">{filters}</div>
          </div>
        ) : null}

        <section className="an-card">
          <Heading
            title="سود و زیان"
            hint="موجودی حساب پس از هر معاملهٔ بسته‌شده. خط کمرنگ، موجودی شروع است."
          />
          <div className="an-metrics">
            <Metric
              lead
              label="سود خالص"
              value={signedMoney(s.netPnl)}
              sub={pct(s.returnPct)}
              cls={pnlClass(s.netPnl)}
            />
            <Metric
              label="ضریب سود"
              value={pf}
              sub={`${money(s.grossProfit)} / ${money(s.grossLoss)}`}
            />
            <Metric
              label="نرخ برد"
              value={plainPct(s.winRate)}
              sub={`${faNum(s.winners)} سود · ${faNum(s.losers)} ضرر`}
            />
            <Metric
              label="معاملات"
              value={faNum(s.totalTrades)}
              sub={`${faNum(s.longs)} خرید · ${faNum(s.shorts)} فروش`}
            />
            <Metric
              label="بیشترین افت"
              value={money(s.drawdown.max)}
              sub={`${faNum(s.drawdown.maxPct, 1)}٪ از قله`}
              cls={s.drawdown.max > 0 ? 'text-down' : ''}
            />
            <Metric
              label="امید ریاضی"
              value={signedMoney(s.expectancy)}
              sub="هر معامله"
              cls={pnlClass(s.expectancy)}
            />
          </div>
          <LineChart
            label="منحنی موجودی"
            baseline={session.settings.startingBalance}
            color={BLUE}
            gradient
            height={280}
            xLabels={curve.map((p) => shortDate(p.time))}
            points={curve.map((p, i) => ({
              x: i,
              y: p.balance,
              tip: (
                <span>
                  {p.tradeId === null ? 'شروع' : `معامله ${faNum(Number(p.tradeId))}`} ·{' '}
                  {money(p.balance)} · {utcDateTime(p.time)}
                </span>
              ),
            }))}
          />
          <div className="an-tiles an-tiles-6">
            <Tile
              label="میانگین سود"
              value={s.winners ? signedMoney(s.avgWin) : '—'}
              cls={s.winners ? 'text-up' : ''}
            />
            <Tile
              label="میانگین ضرر"
              value={s.losers ? signedMoney(s.avgLoss) : '—'}
              cls={s.losers ? 'text-down' : ''}
            />
            <Tile label="بهترین معامله" value={signedMoney(s.bestWin)} sub={pct(s.bestWinPct)} />
            <Tile
              label="بدترین معامله"
              value={s.losers ? signedMoney(s.worstLoss) : '—'}
              sub={s.losers ? pct(s.worstLossPct) : undefined}
            />
            <Tile
              label="میانگین ریسک به ریوارد"
              value={s.avgRR === null ? '—' : `۱ : ${faNum(s.avgRR, 2)}`}
            />
            <Tile label="میانگین مدت" value={duration(s.avgDuration)} />
          </div>
        </section>

        <section className="an-card">
          <Heading
            title="امید ریاضی و ضریب سود"
            hint="نرخ برد ضربدر میانگین سود، منهای نرخ باخت ضربدر میانگین ضرر. نشانگر روی بازهٔ −۲R تا +۲R است."
          />
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center" dir="ltr">
            <div className="w-full sm:w-40">
              <div className={`an-lead tabular-nums ${pnlClass(s.expectancyR ?? 0)}`}>
                {s.expectancyR === null ? '—' : `${faNum(s.expectancyR, 2)}R`}
              </div>
              <div className="an-metric-sub">امید ریاضی · {signedMoney(s.expectancy)}</div>
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="an-expect" />
              <span className="an-mark" style={{ left: `${expPos}%` }} />
            </div>
            <div className="w-full text-start sm:w-28 sm:text-end">
              <div className="an-lead tabular-nums">{pf}</div>
              <div className="an-metric-sub">ضریب سود</div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="an-card">
            <Heading title="برنده‌ها" swatch={GREEN} />
            <StatRows
              rows={[
                { label: 'تعداد', value: faNum(s.winners) },
                { label: 'نرخ برد', value: plainPct(s.winRate) },
                { label: 'سود ناخالص', value: signedMoney(s.grossProfit), cls: 'text-up' },
                {
                  label: 'میانگین سود',
                  value: s.winners ? signedMoney(s.avgWin) : '—',
                  cls: s.winners ? 'text-up' : '',
                },
                { label: 'بزرگ‌ترین سود', value: s.winners ? signedMoney(s.bestWin) : '—' },
                { label: 'میانگین مدت', value: duration(s.avgWinDuration) },
                { label: 'بیشترین برد پیاپی', value: faNum(s.maxConsecutiveWins) },
                { label: 'سربه‌سر', value: faNum(s.breakeven) },
                ...(s.winnerDrawdownR
                  ? [
                      {
                        label: 'میانگین افت سودده‌ها',
                        value: `${faNum(s.winnerDrawdownR.avg, 2)}R`,
                      },
                    ]
                  : []),
              ]}
            />
          </section>
          <section className="an-card">
            <Heading title="بازنده‌ها" swatch={RED} />
            <StatRows
              rows={[
                { label: 'تعداد', value: faNum(s.losers) },
                { label: 'نرخ باخت', value: plainPct(lossRate) },
                { label: 'ضرر ناخالص', value: signedMoney(-s.grossLoss), cls: 'text-down' },
                {
                  label: 'میانگین ضرر',
                  value: s.losers ? signedMoney(s.avgLoss) : '—',
                  cls: s.losers ? 'text-down' : '',
                },
                { label: 'بزرگ‌ترین ضرر', value: s.losers ? signedMoney(s.worstLoss) : '—' },
                { label: 'میانگین مدت', value: duration(s.avgLossDuration) },
                { label: 'بیشترین باخت پیاپی', value: faNum(s.maxConsecutiveLosses) },
              ]}
            />
          </section>
        </div>

        <section className="an-card">
          <Heading title="عملکرد جهت" hint="سهم برد و باخت در خریدها و فروش‌ها." />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(
              [
                ['buy', 'خرید', GREEN],
                ['sell', 'فروش', BLUE],
              ] as const
            ).map(([key, title, color]) => {
              const b = a.sides[key];
              return (
                <div key={key} className="an-inset">
                  <p className="an-inset-title">{title}</p>
                  <DonutChart
                    label={`${title}: برد و باخت`}
                    caption="برد / باخت"
                    center={b.trades ? plainPct(b.winRate) : '—'}
                    parts={[
                      { value: b.wins, color },
                      { value: b.losses, color: RED },
                      { value: b.breakeven, color: 'rgba(255,255,255,0.28)' },
                    ]}
                  />
                  <p className="mt-1 text-center text-[12.5px] text-muted">
                    {faNum(b.trades)} معامله · برد {faNum(b.wins)} · باخت {faNum(b.losses)}
                  </p>
                  <p
                    className={`mt-0.5 text-center text-[13px] font-semibold tabular-nums ${pnlClass(b.pnl)}`}
                  >
                    {signedMoney(b.pnl)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="an-card">
          <Heading
            title="عملکرد سشن‌ها"
            hint="هر نمودار سشن‌های آسیا، لندن، نیویورک و خارج از سشن را با هم مقایسه می‌کند. ساعت‌ها جهانی است."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="an-inset">
              <p className="an-inset-title">نرخ برد</p>
              <RadarChart
                label="نرخ برد سشن‌ها"
                color={GREEN}
                ceiling={1}
                format={plainPct}
                axes={sessionAxes((b) => b.winRate)}
              />
            </div>
            <div className="an-inset">
              <p className="an-inset-title">تعداد معاملات</p>
              <RadarChart
                label="تعداد معاملات سشن‌ها"
                color={BLUE}
                format={(v) => faNum(v)}
                axes={sessionAxes((b) => b.trades)}
              />
            </div>
            <div className="an-inset">
              <p className="an-inset-title">میانگین R</p>
              <RadarChart
                label="میانگین R سشن‌ها"
                color="#a78bfa"
                format={(v) => `${faNum(v, 2)}R`}
                axes={sessionAxes((b) => (b.trades ? b.r / b.trades : 0))}
              />
            </div>
            <div className="an-inset">
              <p className="an-inset-title">سود</p>
              <RadarChart
                label="سود سشن‌ها"
                color="#f0b429"
                format={signedMoney}
                axes={sessionAxes((b) => b.pnl)}
              />
            </div>
          </div>
        </section>

        <section className="an-card">
          <Heading
            title="عملکرد روزهای هفته"
            hint="سود خالص بر اساس روز ورود. جمعه آخرین روز این نمودار است."
          />
          {empty ? (
            <FilteredEmpty
              blank={blank}
              href={chartHref}
              title="معامله‌ای در روزهای هفته نیست"
              body="بعد از بستن چند معامله، سود هر روز هفته این‌جا دیده می‌شود."
            />
          ) : (
            <>
              <div className="mt-4">
                <HBars
                  label="سود خالص بر اساس روز ورود"
                  format={signedMoney}
                  rows={a.weekday.map((b, i) => ({
                    label: WEEKDAY_NAMES[i] ?? '',
                    value: b.pnl,
                    tip: `${WEEKDAY_NAMES[i] ?? ''} · ${faNum(b.trades)} معامله · ${signedMoney(b.pnl)}`,
                  }))}
                />
              </div>
              <p className="an-note">
                بهترین: {bestOf(a.weekday, WEEKDAY_NAMES)} · بدترین:{' '}
                {worstOf(a.weekday, WEEKDAY_NAMES)}
              </p>
            </>
          )}
        </section>

        <section className="an-card">
          <Heading title="عملکرد ماه" hint="سود خالص هر ماه خورشیدی، بر اساس روز بستن معامله." />
          {empty ? (
            <FilteredEmpty
              blank={blank}
              href={chartHref}
              title="معامله‌ای در ماه‌ها نیست"
              body="ماههایی که در آن‌ها معامله می‌بندید، با سود یا ضررشان این‌جا می‌آیند."
            />
          ) : (
            <>
              <div className="mt-4">
                <HBars
                  label="سود خالص هر ماه"
                  format={signedMoney}
                  rows={months.map((row) => ({
                    label: row.label,
                    value: row.pnl,
                    tip: `${row.label} · ${faNum(row.trades)} معامله · ${signedMoney(row.pnl)}`,
                  }))}
                />
              </div>
              <p className="an-note">
                بهترین: {extreme(months, 'best')} · بدترین: {extreme(months, 'worst')}
              </p>
            </>
          )}
        </section>

        <section className="an-card">
          <Heading title="عملکرد ساعت ورود" hint="سود خالص بر اساس ساعت ورود، به وقت جهانی." />
          {empty ? (
            <FilteredEmpty
              blank={blank}
              href={chartHref}
              title="معامله‌ای در ساعت‌های ورود نیست"
              body="ساعت‌هایی که وارد معامله می‌شوید، بعد از اولین معامله مشخص می‌شوند."
            />
          ) : (
            <>
              <BarChart
                label="سود خالص بر اساس ساعت ورود"
                data={a.hour.map((b, h): BarDatum => ({
                  label: faNum(h),
                  value: b.pnl,
                  tip: bucketTip(`${faNum(h)}:۰۰`, b),
                }))}
              />
              <p className="an-note">
                بهترین: {bestOf(a.hour, hourNames())} · بدترین: {worstOf(a.hour, hourNames())}
              </p>
            </>
          )}
        </section>

        <section className="an-card">
          <Heading
            title="تقویم سود و زیان"
            hint="هر روز به اندازهٔ سود یا ضرر بسته‌شده در آن روز رنگ می‌گیرد."
          />
          {empty ? (
            <FilteredEmpty
              blank={blank}
              href={chartHref}
              ghost="calendar"
              title="تقویم سود و زیان خالی است"
              body="روزهایی که معامله می‌بندید رنگی می‌شوند."
            />
          ) : (
            <div className="mt-3">
              <PnlCalendar
                days={a.days}
                initial={trades[0]?.closeTime ?? session.settings.startDate}
              />
            </div>
          )}
        </section>

        <section className="an-card">
          <Heading
            title="میانگین فراوانی معامله"
            hint="تعداد ورود در هر روز هفته. میانگین، روی روزهایی است که حداقل یک معامله در آن‌ها بسته شده."
          />
          {empty ? (
            <FilteredEmpty
              blank={blank}
              href={chartHref}
              title="ببینید چه زمانی معامله می‌کنید"
              body="فراوانی ورود در روزهای هفته بعد از اولین معامله مشخص می‌شود."
            />
          ) : (
            <>
              <p className="an-note">
                میانگین {faNum(perDay, 1)} معامله در هر روز فعال · {faNum(activeDays)} روز
              </p>
              <BarChart
                polarity={false}
                label="تعداد معامله در هر روز هفته"
                data={a.weekday.map((b, i): BarDatum => ({
                  label: WEEKDAY_NAMES[i] ?? '',
                  value: b.trades,
                  tip: (
                    <span>
                      {WEEKDAY_NAMES[i]} · {faNum(b.trades)} معامله
                    </span>
                  ),
                }))}
              />
            </>
          )}
        </section>

        <section className="an-card">
          <Heading title="افت سرمایه" hint="فاصلهٔ موجودی از قلهٔ جاری، بعد از هر معامله." />
          <LineChart
            label="افت از قلهٔ جاری"
            height={150}
            baseline={0}
            color="var(--tc-down)"
            points={curve.map((p) => ({
              x: 0,
              y: p.drawdown,
              tip: <span>{money(p.drawdown)}</span>,
            }))}
          />
        </section>

        <section className="an-card">
          <Heading title="شاخص‌های بیشتر" />
          <div className="an-tiles">
            <Tile
              label="میانگین R"
              value={r2(s.avgR, 'R')}
              sub={s.totalR === null ? undefined : `مجموع ${faNum(s.totalR, 2)}R`}
              cls={pnlClass(s.avgR ?? 0)}
            />
            <Tile
              label="بیشترین ریسک به ریوارد"
              value={s.maxRR === null ? '—' : `۱ : ${faNum(s.maxRR, 2)}`}
            />
            <Tile
              label="ریسک به ریوارد ایده‌آل"
              value={a.ideal ? `۱ : ${faNum(a.ideal.target)}` : excursions ? '—' : '…'}
              sub={a.ideal ? `مجموع ${faNum(a.ideal.totalR, 1)}R` : 'شبیه‌ساز'}
            />
            <Tile label="ضریب بازیابی" value={r2(s.recoveryFactor)} />
            <Tile label="شارپ (R)" value={r2(s.sharpeR)} />
            <Tile label="کارمزد" value={money(s.totalCommission)} />
            <Tile
              label="میانگین افت"
              value={money(s.drawdown.average)}
              sub={`${faNum(s.drawdown.episodes)} دوره`}
            />
            <Tile label="میانگین MAE" value={r2(s.avgMaeR, 'R')} />
            <Tile label="میانگین MFE" value={r2(s.avgMfeR, 'R')} />
          </div>
        </section>

        <section className="an-card">
          <Heading
            title="میانگین دوره‌ای"
            hint="میانگین سود و ضرر روز، هفته و ماه‌هایی که در آن‌ها معامله بسته شده."
          />
          <div className="mt-3 overflow-x-auto">
            <table className="an-table">
              <thead>
                <tr className="text-muted">
                  <th className="text-start font-medium">دوره</th>
                  <th className="text-end font-medium">تعداد</th>
                  <th className="text-end font-medium">میانگین سود</th>
                  <th className="text-end font-medium">میانگین ضرر</th>
                  <th className="text-end font-medium">میانگین خالص</th>
                  <th className="text-end font-medium">بهترین</th>
                  <th className="text-end font-medium">بدترین</th>
                </tr>
              </thead>
              <tbody>
                {a.periods.map(([p, v]) => (
                  <tr key={p} className="tabular-nums">
                    <td>{PERIOD_FA[p]}</td>
                    <td className="text-end">{faNum(v.periods)}</td>
                    <td className="text-end text-up">{signedMoney(v.avgGain)}</td>
                    <td className="text-end text-down">{signedMoney(v.avgLoss)}</td>
                    <td className={`text-end ${pnlClass(v.avgNet)}`}>{signedMoney(v.avgNet)}</td>
                    <td className="text-end">{signedMoney(v.best)}</td>
                    <td className="text-end">{signedMoney(v.worst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="an-card">
            <Heading title="توزیع سود و زیان" />
            {a.pnlHist.length === 0 ? (
              <p className="an-note">هنوز معامله‌ای نیست.</p>
            ) : (
              <BarChart
                label="تعداد معاملات در هر بازهٔ سود"
                polarity={false}
                data={a.pnlHist.map((b): BarDatum => ({
                  label: compactMoney((b.from + b.to) / 2),
                  value: b.count,
                  tip: (
                    <span>
                      {signedMoney(b.from)} تا {signedMoney(b.to)}: {faNum(b.count)} معامله
                    </span>
                  ),
                }))}
              />
            )}
          </section>
          <section className="an-card">
            <Heading title="توزیع ضریب R" />
            {a.rHist.length === 0 ? (
              <p className="an-note">برای این نمودار، معامله باید حد ضرر داشته باشد.</p>
            ) : (
              <BarChart
                label="تعداد معاملات در هر بازهٔ R"
                polarity={false}
                data={a.rHist.map((b): BarDatum => ({
                  label: faNum((b.from + b.to) / 2, 1),
                  value: b.count,
                  tip: (
                    <span>
                      {faNum(b.from, 2)}R تا {faNum(b.to, 2)}R: {faNum(b.count)} معامله
                    </span>
                  ),
                }))}
              />
            )}
          </section>
        </div>

        <section className="an-card">
          <Heading
            title="شبیه‌ساز ریسک به ریوارد"
            hint="حد ضرر همان می‌ماند و حد سود روی هر ضریب R دوباره اجرا می‌شود. هدف ایده‌آل همانی است که مجموع R را بیشینه می‌کند."
          />
          <RRSimulator
            rows={a.rr}
            ideal={a.ideal}
            ready={excursions !== null}
            progress={progress}
          />
        </section>
      </main>
    </div>
  );
}

const compactMoney = (v: number) => {
  const abs = Math.abs(v);
  const body = abs >= 1000 ? `${faNum(abs / 1000, 1)} هزار` : faNum(abs, 0);
  return `${v < 0 ? '−' : ''}${body} $`;
};

function bestOf(b: readonly Bucket[], names: readonly string[]): string {
  const active = b.filter((x) => x.trades > 0);
  if (!active.length) return '—';
  const best = active.reduce((acc, x) => (x.pnl > acc.pnl ? x : acc));
  return `${names[best.key] ?? ''} (${signedMoney(best.pnl)})`;
}

function worstOf(b: readonly Bucket[], names: readonly string[]): string {
  const active = b.filter((x) => x.trades > 0);
  if (!active.length) return '—';
  const worst = active.reduce((acc, x) => (x.pnl < acc.pnl ? x : acc));
  return `${names[worst.key] ?? ''} (${signedMoney(worst.pnl)})`;
}

function extreme(rows: readonly MonthRow[], dir: 'best' | 'worst'): string {
  const active = rows.filter((row) => row.trades > 0);
  if (!active.length) return '—';
  const pick = active.reduce((acc, row) =>
    dir === 'best' ? (row.pnl > acc.pnl ? row : acc) : row.pnl < acc.pnl ? row : acc,
  );
  return `${pick.label} (${signedMoney(pick.pnl)})`;
}

function hourNames(): string[] {
  return Array.from({ length: 24 }, (_, h) => faNum(h));
}
