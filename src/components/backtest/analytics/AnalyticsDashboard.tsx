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
import { useThemeCssVars } from '../../hooks/useThemeCssVars';
import { Icon } from '../../ui/Icon';
import {
  duration,
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
import { useStoredSession } from '../useStoredSession';
import { BarChart, LineChart, type BarDatum } from './charts';
import { PnlCalendar } from './PnlCalendar';

type SideFilter = 'all' | 'buy' | 'sell';

const r2 = (v: number | null | undefined, suffix = '') =>
  v === null || v === undefined ? '—' : `${faNum(v, 2)}${suffix}`;

function Card({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-panel p-4 ${className}`}>
      <h2 className="mb-3 text-[13px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  cls = 'text-fg',
  hint,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  cls?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3" title={hint}>
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className={`mt-0.5 text-[17px] font-semibold tabular-nums ${cls}`}>{value}</div>
      {sub ? <div className="text-[11px] text-muted">{sub}</div> : null}
    </div>
  );
}

const bucketTip = (title: string, b: Bucket) => (
  <span>
    <b>{title}</b> · {faNum(b.trades)} معامله · {signedMoney(b.pnl)} · برد{' '}
    {faNum(Math.round(b.winRate * 100))}٪ · {faNum(b.r, 2)}R
  </span>
);

/** `/backtest/[id]/analytics`: FX Replay-style statistics of a session. */
export default function AnalyticsDashboard({ id }: { readonly id: string }) {
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
      <div className="flex h-full items-center justify-center bg-chart text-muted">
        در حال بارگذاری…
      </div>
    );
  if (state.status === 'missing' || !a || !ready)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-chart text-fg">
        <p className="text-muted">این جلسه وجود ندارد.</p>
        <Link href="/backtest" className="text-accent">
          بازگشت به جلسه‌ها
        </Link>
      </div>
    );

  const { session } = ready;
  const s = a.stats;
  const start = session.settings.startingBalance;
  const status = session.account.status;
  const pf = s.profitFactor === null ? (s.grossProfit > 0 ? '∞' : '—') : faNum(s.profitFactor, 2);
  const statusLine =
    status === 'active'
      ? `در جریان (بازپخش تا ${utcDateTime(session.cursor)}، ساعت جهانی)`
      : status === 'ended'
        ? 'تمام‌شده'
        : `متوقف شد: ${failReasonFa(session.account.failReason ?? '')}`;
  const PERIOD_FA = { day: 'روز', week: 'هفته', month: 'ماه' } as const;
  const sel = 'h-8 rounded-md border border-line bg-panel px-2 text-[13px]';

  return (
    <div className="h-full overflow-y-auto bg-chart text-fg">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-panel px-5">
        <Link
          href="/backtest"
          className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"
        >
          <Icon name="chevronLeft" size={16} className="rtl:-scale-x-100" /> جلسه‌ها
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold">{session.settings.name} · عملکرد</h1>
          <p className="text-[11.5px] text-muted">
            <bdi>{session.settings.symbol}</bdi> · {utcDate(session.settings.startDate)} تا{' '}
            {utcDate(session.settings.endDate)} · {statusLine}
          </p>
        </div>
        <div className="flex-1" />
        <Link
          href={`/backtest/${id}/journal`}
          className="inline-flex h-8 items-center rounded-md border border-line px-3 text-[13px] hover:bg-hover"
        >
          دفتر معاملات
        </Link>
        <Link
          href={`/backtest/${id}`}
          className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg"
        >
          {status === 'active' ? 'ادامه جلسه' : 'باز کردن نمودار'}
        </Link>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 p-5" data-testid="analytics">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">فیلتر</span>
          <select
            aria-label="جهت"
            className={sel}
            value={side}
            onChange={(e) => setSide(e.target.value as SideFilter)}
          >
            <option value="all">همه جهت‌ها</option>
            <option value="buy">خرید</option>
            <option value="sell">فروش</option>
          </select>
          <select
            aria-label="برچسب"
            className={sel}
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
            className={sel}
            value={tsession}
            onChange={(e) => setTsession(e.target.value)}
          >
            <option value="">همه سشن‌ها</option>
            {TRADING_SESSIONS.map((x) => (
              <option key={x.id} value={x.id}>
                {SESSION_FA[x.id] ?? x.label} ({faNum(x.from)}:۰۰ تا {faNum(x.to)}:۰۰ جهانی)
              </option>
            ))}
          </select>
          <span className="text-muted">{faNum(trades.length)} معامله</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi
            label="سود خالص"
            value={signedMoney(s.netPnl)}
            sub={pct(s.returnPct)}
            cls={pnlClass(s.netPnl)}
          />
          <Kpi
            label="نرخ برد"
            value={plainPct(s.winRate)}
            sub={`${faNum(s.winners)} سود · ${faNum(s.losers)} ضرر · ${faNum(s.breakeven)} سربه‌سر`}
          />
          <Kpi
            label="ضریب سود"
            value={pf}
            sub={`${money(s.grossProfit)} / ${money(s.grossLoss)}`}
            hint="سود ناخالص تقسیم بر ضرر ناخالص"
          />
          <Kpi
            label="تعداد معاملات"
            value={faNum(s.totalTrades)}
            sub={`${faNum(s.longs)} خرید · ${faNum(s.shorts)} فروش`}
          />
          <Kpi
            label="امید ریاضی"
            value={signedMoney(s.expectancy)}
            sub={s.expectancyR === null ? 'هر معامله' : `${faNum(s.expectancyR, 2)}R هر معامله`}
            hint="نرخ برد ضربدر میانگین سود، منهای نرخ باخت ضربدر میانگین ضرر"
          />
          <Kpi
            label="بیشترین افت"
            value={money(s.drawdown.max)}
            sub={`${faNum(s.drawdown.maxPct, 2)}٪ از قله`}
            cls={s.drawdown.max > 0 ? 'text-down' : 'text-fg'}
          />
          <Kpi
            label="میانگین سود"
            value={s.winners ? signedMoney(s.avgWin) : '—'}
            cls={s.winners ? 'text-up' : 'text-fg'}
          />
          <Kpi
            label="میانگین ضرر"
            value={s.losers ? signedMoney(s.avgLoss) : '—'}
            cls={s.losers ? 'text-down' : 'text-fg'}
          />
          <Kpi label="بهترین معامله" value={signedMoney(s.bestWin)} sub={pct(s.bestWinPct)} />
          <Kpi
            label="بدترین معامله"
            value={s.losers ? signedMoney(s.worstLoss) : '—'}
            sub={s.losers ? pct(s.worstLossPct) : undefined}
          />
          <Kpi
            label="میانگین ریسک به ریوارد"
            value={s.avgRR === null ? '—' : `۱ : ${faNum(s.avgRR, 2)}`}
            sub="معامله‌های دارای حد ضرر و حد سود"
            hint="میانگین ریسک به ریوارد برنامه‌ریزی‌شده؛ فقط معامله‌هایی که هم حد ضرر دارند و هم حد سود"
          />
          <Kpi
            label="بیشترین ریسک به ریوارد"
            value={s.maxRR === null ? '—' : `۱ : ${faNum(s.maxRR, 2)}`}
          />
          <Kpi
            label="ریسک به ریوارد ایده‌آل"
            value={a.ideal ? `۱ : ${faNum(a.ideal.target)}` : excursions ? '—' : '…'}
            sub={a.ideal ? `مجموع ${faNum(a.ideal.totalR, 1)}R` : 'شبیه‌ساز'}
            hint="حد سودی که مجموع R را بیشینه می‌کرد"
          />
          <Kpi
            label="میانگین R"
            value={r2(s.avgR, 'R')}
            sub={s.totalR === null ? undefined : `مجموع ${faNum(s.totalR, 2)}R`}
            cls={pnlClass(s.avgR ?? 0)}
          />
          <Kpi
            label="میانگین افت"
            value={money(s.drawdown.average)}
            sub={`${faNum(s.drawdown.episodes)} دوره`}
          />
          <Kpi
            label="برد و باخت پیاپی"
            value={`${faNum(s.maxConsecutiveWins)} برد / ${faNum(s.maxConsecutiveLosses)} باخت`}
            sub="بیشترین رشته"
          />
          <Kpi
            label="میانگین مدت"
            value={duration(s.avgDuration)}
            sub={`سود ${duration(s.avgWinDuration)} · ضرر ${duration(s.avgLossDuration)}`}
          />
          <Kpi
            label="ضریب بازیابی"
            value={r2(s.recoveryFactor)}
            sub={`شارپ (R) ${r2(s.sharpeR)} · کارمزد ${money(s.totalCommission)}`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="منحنی موجودی" className="lg:col-span-2">
            <LineChart
              label="موجودی پس از هر معاملهٔ بسته‌شده"
              baseline={start}
              points={a.curve.map((p, i) => ({
                x: i,
                y: p.balance,
                tip: (
                  <span>
                    {i === 0 ? 'شروع' : `معامله ${faNum(Number(p.tradeId))}`} · {money(p.balance)} ·{' '}
                    {utcDateTime(p.time)}
                  </span>
                ),
              }))}
            />
            <h3 className="mb-1 mt-3 text-[12px] text-muted">افت سرمایه</h3>
            <LineChart
              label="افت از قلهٔ جاری"
              height={110}
              baseline={0}
              color="var(--tc-down)"
              points={a.curve.map((p, i) => ({
                x: i,
                y: p.drawdown,
                tip: <span>{money(p.drawdown)}</span>,
              }))}
            />
          </Card>
          <Card title="خرید در برابر فروش">
            {(['buy', 'sell'] as const).map((k) => {
              const b = a.sides[k];
              return (
                <div key={k} className="mb-3 rounded-lg border border-line p-3">
                  <div className="font-semibold">{k === 'buy' ? 'خریدها' : 'فروش‌ها'}</div>
                  <dl className="mt-1 grid grid-cols-2 gap-1 text-[12.5px]">
                    <dt className="text-muted">معاملات</dt>
                    <dd className="text-end tabular-nums">{faNum(b.trades)}</dd>
                    <dt className="text-muted">نرخ برد</dt>
                    <dd className="text-end tabular-nums">{plainPct(b.winRate)}</dd>
                    <dt className="text-muted">سود خالص</dt>
                    <dd className={`text-end tabular-nums ${pnlClass(b.pnl)}`}>
                      {signedMoney(b.pnl)}
                    </dd>
                    <dt className="text-muted">مجموع R</dt>
                    <dd className="text-end tabular-nums">{faNum(b.r, 2)}R</dd>
                  </dl>
                </div>
              );
            })}
            <h3 className="mb-1 text-[12px] text-muted">افت روی معاملات سودده (R)</h3>
            {s.winnerDrawdownR ? (
              <dl className="grid grid-cols-3 gap-1 text-center text-[12.5px]">
                <div>
                  <dt className="text-muted">میانگین</dt>
                  <dd className="font-semibold">{faNum(s.winnerDrawdownR.avg, 2)}R</dd>
                </div>
                <div>
                  <dt className="text-muted">بیشترین</dt>
                  <dd className="font-semibold">{faNum(s.winnerDrawdownR.max, 2)}R</dd>
                </div>
                <div>
                  <dt className="text-muted">کمترین</dt>
                  <dd className="font-semibold">{faNum(s.winnerDrawdownR.min, 2)}R</dd>
                </div>
              </dl>
            ) : (
              <p className="text-[12px] text-muted">
                برای این عدد، معاملهٔ سودده با حد ضرر لازم است.
              </p>
            )}
          </Card>
        </div>

        <Card title="تقویم سود و زیان">
          <PnlCalendar days={a.days} initial={trades[0]?.closeTime ?? session.settings.startDate} />
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="عملکرد روزهای هفته">
            <BarChart
              label="سود خالص بر اساس روز ورود"
              data={a.weekday.map((b, i): BarDatum => ({
                label: WEEKDAY_NAMES[i]!,
                value: b.pnl,
                tip: bucketTip(WEEKDAY_NAMES[i]!, b),
              }))}
            />
            <p className="mt-1 text-[12px] text-muted">
              بهترین: {bestOf(a.weekday, WEEKDAY_NAMES)} · بدترین:{' '}
              {worstOf(a.weekday, WEEKDAY_NAMES)}
            </p>
          </Card>
          <Card title="عملکرد ساعت ورود (ساعت جهانی)">
            <BarChart
              label="سود خالص بر اساس ساعت ورود"
              data={a.hour.map((b, h): BarDatum => ({
                label: faNum(h),
                value: b.pnl,
                tip: bucketTip(`${faNum(h)}:۰۰`, b),
              }))}
            />
          </Card>
          <Card title="عملکرد سشن‌ها">
            <BarChart
              label="سود خالص بر اساس سشن معاملاتی"
              data={a.sessions.map((b, i): BarDatum => ({
                label: SESSION_FA[TRADING_SESSIONS[i]!.id] ?? TRADING_SESSIONS[i]!.label,
                value: b.pnl,
                tip: bucketTip(
                  SESSION_FA[TRADING_SESSIONS[i]!.id] ?? TRADING_SESSIONS[i]!.label,
                  b,
                ),
              }))}
            />
          </Card>
          <Card title="میانگین سود و ضرر دوره‌ای">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-muted">
                  <th className="py-1 text-start font-medium">دوره</th>
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
                  <tr key={p} className="border-t border-line/60 tabular-nums">
                    <td className="py-1">{PERIOD_FA[p]}</td>
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
          </Card>
          <Card title="توزیع سود و زیان">
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
          </Card>
          <Card title="توزیع ضریب R">
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
          </Card>
        </div>

        <Card title="شبیه‌ساز ریسک به ریوارد">
          <p className="mb-2 text-[12.5px] text-muted">
            معاملات دوباره روی دادهٔ یک‌دقیقه‌ای اجرا می‌شوند؛ حد ضرر همان می‌ماند و حد سود روی هر
            ضریب R امتحان می‌شود. نسبت ایده‌آل همانی است که مجموع R را بیشینه می‌کند
            {excursions ? '' : ` — در حال محاسبه ${progress}`}.
          </p>
          {a.rr ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-muted">
                    {[
                      'هدف',
                      'معاملات',
                      'نرخ برد',
                      'مجموع R',
                      'امید ریاضی',
                      'ضریب سود',
                      'میانگین افت سودده‌ها',
                    ].map((h) => (
                      <th key={h} className="py-1 text-end font-medium first:text-start">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {a.rr.map((r) => (
                    <tr
                      key={r.target}
                      className={`border-t border-line/60 tabular-nums ${a.ideal?.target === r.target ? 'bg-accent/10 font-semibold' : ''}`}
                    >
                      <td className="py-1">
                        ۱ : {faNum(r.target)}
                        {a.ideal?.target === r.target ? ' · ایده‌آل' : ''}
                      </td>
                      <td className="text-end">{faNum(r.trades)}</td>
                      <td className="text-end">{plainPct(r.winRate)}</td>
                      <td className={`text-end ${pnlClass(r.totalR)}`}>{faNum(r.totalR, 2)}R</td>
                      <td className="text-end">{faNum(r.expectancyR, 2)}R</td>
                      <td className="text-end">
                        {r.profitFactor === null ? '—' : faNum(r.profitFactor, 2)}
                      </td>
                      <td className="text-end">{faNum(r.avgDrawdownR, 2)}R</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[12.5px] text-muted">در حال محاسبه…</p>
          )}
        </Card>
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
  const best = active.reduce((a, x) => (x.pnl > a.pnl ? x : a));
  return `${names[best.key]} (${signedMoney(best.pnl)})`;
}

function worstOf(b: readonly Bucket[], names: readonly string[]): string {
  const active = b.filter((x) => x.trades > 0);
  if (!active.length) return '—';
  const worst = active.reduce((a, x) => (x.pnl < a.pnl ? x : a));
  return `${names[worst.key]} (${signedMoney(worst.pnl)})`;
}
