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
  money,
  pct,
  plainPct,
  pnlClass,
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
  v === null || v === undefined ? '—' : `${v.toFixed(2)}${suffix}`;

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
    <b>{title}</b> · {b.trades} trades · {signedMoney(b.pnl)} · win {(b.winRate * 100).toFixed(0)}%
    · {b.r.toFixed(2)}R
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
        if (!cancelled) setProgress(`${d}/${t}`);
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
      <div className="flex h-full items-center justify-center bg-chart text-muted">Loading…</div>
    );
  if (state.status === 'missing' || !a || !ready)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-chart text-fg">
        <p className="text-muted">This session does not exist.</p>
        <Link href="/backtest" className="text-accent">
          Back to sessions
        </Link>
      </div>
    );

  const { session } = ready;
  const s = a.stats;
  const start = session.settings.startingBalance;
  const status = session.account.status;
  const pf = s.profitFactor === null ? (s.grossProfit > 0 ? '∞' : '—') : s.profitFactor.toFixed(2);
  const sel = 'h-8 rounded-md border border-line bg-panel px-2 text-[13px]';

  return (
    <div className="h-full overflow-y-auto bg-chart text-fg">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-panel px-5">
        <Link
          href="/backtest"
          className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"
        >
          <Icon name="chevronLeft" size={16} /> Sessions
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold">
            {session.settings.name} · Analytics
          </h1>
          <p className="text-[11.5px] text-muted">
            {session.settings.symbol} · {utcDate(session.settings.startDate)} →{' '}
            {utcDate(session.settings.endDate)} ·{' '}
            {status === 'active'
              ? `in progress (replay at ${utcDateTime(session.cursor)} UTC)`
              : status === 'ended'
                ? 'completed'
                : `stopped: ${session.account.failReason ?? ''}`}
          </p>
        </div>
        <div className="flex-1" />
        <Link
          href={`/backtest/${id}/journal`}
          className="inline-flex h-8 items-center rounded-md border border-line px-3 text-[13px] hover:bg-hover"
        >
          Journal
        </Link>
        <Link
          href={`/backtest/${id}`}
          className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg"
        >
          {status === 'active' ? 'Continue session' : 'Open chart'}
        </Link>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 p-5" data-testid="analytics">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">Filters</span>
          <select
            aria-label="Side"
            className={sel}
            value={side}
            onChange={(e) => setSide(e.target.value as SideFilter)}
          >
            <option value="all">All sides</option>
            <option value="buy">Longs</option>
            <option value="sell">Shorts</option>
          </select>
          <select
            aria-label="Tag"
            className={sel}
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            aria-label="Trading session"
            className={sel}
            value={tsession}
            onChange={(e) => setTsession(e.target.value)}
          >
            <option value="">All trading sessions</option>
            {TRADING_SESSIONS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label} ({x.from}:00–{x.to}:00 UTC)
              </option>
            ))}
          </select>
          <span className="text-muted">{trades.length} trades</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi
            label="Net P&L"
            value={signedMoney(s.netPnl)}
            sub={pct(s.returnPct)}
            cls={pnlClass(s.netPnl)}
          />
          <Kpi
            label="Win rate"
            value={plainPct(s.winRate)}
            sub={`${s.winners}W · ${s.losers}L · ${s.breakeven} BE`}
          />
          <Kpi
            label="Profit factor"
            value={pf}
            sub={`${money(s.grossProfit)} / ${money(s.grossLoss)}`}
            hint="Gross profit ÷ gross loss"
          />
          <Kpi
            label="Total trades"
            value={String(s.totalTrades)}
            sub={`${s.longs} long · ${s.shorts} short`}
          />
          <Kpi
            label="Expectancy"
            value={signedMoney(s.expectancy)}
            sub={s.expectancyR === null ? 'per trade' : `${s.expectancyR.toFixed(2)}R per trade`}
            hint="Win rate × average win − loss rate × average loss"
          />
          <Kpi
            label="Max drawdown"
            value={money(s.drawdown.max)}
            sub={`${s.drawdown.maxPct.toFixed(2)}% of peak`}
            cls={s.drawdown.max > 0 ? 'text-down' : 'text-fg'}
          />
          <Kpi
            label="Average win"
            value={s.winners ? signedMoney(s.avgWin) : '—'}
            cls={s.winners ? 'text-up' : 'text-fg'}
          />
          <Kpi
            label="Average loss"
            value={s.losers ? signedMoney(s.avgLoss) : '—'}
            cls={s.losers ? 'text-down' : 'text-fg'}
          />
          <Kpi label="Best win" value={signedMoney(s.bestWin)} sub={pct(s.bestWinPct)} />
          <Kpi
            label="Worst loss"
            value={s.losers ? signedMoney(s.worstLoss) : '—'}
            sub={s.losers ? pct(s.worstLossPct) : undefined}
          />
          <Kpi
            label="Average RR"
            value={s.avgRR === null ? '—' : `1 : ${s.avgRR.toFixed(2)}`}
            sub="trades with SL and TP"
            hint="Average planned risk:reward; only trades with both a stop loss and a take profit"
          />
          <Kpi label="Max RR" value={s.maxRR === null ? '—' : `1 : ${s.maxRR.toFixed(2)}`} />
          <Kpi
            label="Ideal RR"
            value={a.ideal ? `1 : ${a.ideal.target}` : excursions ? '—' : '…'}
            sub={a.ideal ? `${a.ideal.totalR.toFixed(1)}R total` : 'RR simulator'}
            hint="The take-profit R that would have maximised total R"
          />
          <Kpi
            label="Average R"
            value={r2(s.avgR, 'R')}
            sub={s.totalR === null ? undefined : `${s.totalR.toFixed(2)}R total`}
            cls={pnlClass(s.avgR ?? 0)}
          />
          <Kpi
            label="Avg drawdown"
            value={money(s.drawdown.average)}
            sub={`${s.drawdown.episodes} episodes`}
          />
          <Kpi
            label="Streaks"
            value={`${s.maxConsecutiveWins}W / ${s.maxConsecutiveLosses}L`}
            sub="max consecutive"
          />
          <Kpi
            label="Avg duration"
            value={duration(s.avgDuration)}
            sub={`W ${duration(s.avgWinDuration)} · L ${duration(s.avgLossDuration)}`}
          />
          <Kpi
            label="Recovery factor"
            value={r2(s.recoveryFactor)}
            sub={`Sharpe (R) ${r2(s.sharpeR)} · fees ${money(s.totalCommission)}`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Equity curve" className="lg:col-span-2">
            <LineChart
              label="Balance after each closed trade"
              baseline={start}
              points={a.curve.map((p, i) => ({
                x: i,
                y: p.balance,
                tip: (
                  <span>
                    {i === 0 ? 'Start' : `Trade #${p.tradeId}`} · {money(p.balance)} ·{' '}
                    {utcDateTime(p.time)}
                  </span>
                ),
              }))}
            />
            <h3 className="mb-1 mt-3 text-[12px] text-muted">Drawdown</h3>
            <LineChart
              label="Drawdown from the running peak"
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
          <Card title="Long vs short">
            {(['buy', 'sell'] as const).map((k) => {
              const b = a.sides[k];
              return (
                <div key={k} className="mb-3 rounded-lg border border-line p-3">
                  <div className="font-semibold">{k === 'buy' ? 'Longs' : 'Shorts'}</div>
                  <dl className="mt-1 grid grid-cols-2 gap-1 text-[12.5px]">
                    <dt className="text-muted">Trades</dt>
                    <dd className="text-right tabular-nums">{b.trades}</dd>
                    <dt className="text-muted">Win rate</dt>
                    <dd className="text-right tabular-nums">{plainPct(b.winRate)}</dd>
                    <dt className="text-muted">Net P&L</dt>
                    <dd className={`text-right tabular-nums ${pnlClass(b.pnl)}`}>
                      {signedMoney(b.pnl)}
                    </dd>
                    <dt className="text-muted">Total R</dt>
                    <dd className="text-right tabular-nums">{b.r.toFixed(2)}R</dd>
                  </dl>
                </div>
              );
            })}
            <h3 className="mb-1 text-[12px] text-muted">Drawdown on winning trades (R)</h3>
            {s.winnerDrawdownR ? (
              <dl className="grid grid-cols-3 gap-1 text-center text-[12.5px]">
                <div>
                  <dt className="text-muted">Average</dt>
                  <dd className="font-semibold">{s.winnerDrawdownR.avg.toFixed(2)}R</dd>
                </div>
                <div>
                  <dt className="text-muted">Max</dt>
                  <dd className="font-semibold">{s.winnerDrawdownR.max.toFixed(2)}R</dd>
                </div>
                <div>
                  <dt className="text-muted">Min</dt>
                  <dd className="font-semibold">{s.winnerDrawdownR.min.toFixed(2)}R</dd>
                </div>
              </dl>
            ) : (
              <p className="text-[12px] text-muted">Needs winning trades with a stop loss.</p>
            )}
          </Card>
        </div>

        <Card title="P&L calendar">
          <PnlCalendar days={a.days} initial={trades[0]?.closeTime ?? session.settings.startDate} />
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Performance per day of week">
            <BarChart
              label="Net P&L by weekday of entry"
              data={a.weekday.map((b, i): BarDatum => ({
                label: WEEKDAY_NAMES[i]!,
                value: b.pnl,
                tip: bucketTip(WEEKDAY_NAMES[i]!, b),
              }))}
            />
            <p className="mt-1 text-[12px] text-muted">
              Best: {bestOf(a.weekday, WEEKDAY_NAMES)} · Worst: {worstOf(a.weekday, WEEKDAY_NAMES)}
            </p>
          </Card>
          <Card title="Performance per hour of entry (UTC)">
            <BarChart
              label="Net P&L by hour"
              data={a.hour.map((b, h): BarDatum => ({
                label: String(h),
                value: b.pnl,
                tip: bucketTip(`${h}:00`, b),
              }))}
            />
          </Card>
          <Card title="Performance per trading session">
            <BarChart
              label="Net P&L by trading session"
              data={a.sessions.map((b, i): BarDatum => ({
                label: TRADING_SESSIONS[i]!.label,
                value: b.pnl,
                tip: bucketTip(TRADING_SESSIONS[i]!.label, b),
              }))}
            />
          </Card>
          <Card title="Average gains and losses">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-muted">
                  <th className="py-1 text-left font-medium">Per</th>
                  <th className="text-right font-medium">Periods</th>
                  <th className="text-right font-medium">Avg gain</th>
                  <th className="text-right font-medium">Avg loss</th>
                  <th className="text-right font-medium">Avg net</th>
                  <th className="text-right font-medium">Best</th>
                  <th className="text-right font-medium">Worst</th>
                </tr>
              </thead>
              <tbody>
                {a.periods.map(([p, v]) => (
                  <tr key={p} className="border-t border-line/60 tabular-nums">
                    <td className="py-1 capitalize">{p}</td>
                    <td className="text-right">{v.periods}</td>
                    <td className="text-right text-up">{signedMoney(v.avgGain)}</td>
                    <td className="text-right text-down">{signedMoney(v.avgLoss)}</td>
                    <td className={`text-right ${pnlClass(v.avgNet)}`}>{signedMoney(v.avgNet)}</td>
                    <td className="text-right">{signedMoney(v.best)}</td>
                    <td className="text-right">{signedMoney(v.worst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="P&L distribution">
            <BarChart
              label="Number of trades per P&L bin"
              polarity={false}
              data={a.pnlHist.map((b): BarDatum => ({
                label: compactMoney((b.from + b.to) / 2),
                value: b.count,
                tip: (
                  <span>
                    {signedMoney(b.from)} … {signedMoney(b.to)}: {b.count} trades
                  </span>
                ),
              }))}
            />
          </Card>
          <Card title="R-multiple distribution">
            <BarChart
              label="Number of trades per R bin"
              polarity={false}
              data={a.rHist.map((b): BarDatum => ({
                label: ((b.from + b.to) / 2).toFixed(1),
                value: b.count,
                tip: (
                  <span>
                    {b.from.toFixed(2)}R … {b.to.toFixed(2)}R: {b.count} trades
                  </span>
                ),
              }))}
            />
          </Card>
        </div>

        <Card title="RR simulator">
          <p className="mb-2 text-[12.5px] text-muted">
            Your trades re-run over the 1-minute data with their original stop loss and a take
            profit at each R target. The ideal RR is the target with the highest total R
            {excursions ? '' : ` — computing ${progress}`}.
          </p>
          {a.rr ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-muted">
                    {[
                      'Target',
                      'Trades',
                      'Win rate',
                      'Total R',
                      'Expectancy',
                      'Profit factor',
                      'Avg drawdown (winners)',
                    ].map((h) => (
                      <th key={h} className="py-1 text-right font-medium first:text-left">
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
                        1 : {r.target}
                        {a.ideal?.target === r.target ? ' · ideal' : ''}
                      </td>
                      <td className="text-right">{r.trades}</td>
                      <td className="text-right">{plainPct(r.winRate)}</td>
                      <td className={`text-right ${pnlClass(r.totalR)}`}>{r.totalR.toFixed(2)}R</td>
                      <td className="text-right">{r.expectancyR.toFixed(2)}R</td>
                      <td className="text-right">
                        {r.profitFactor === null ? '—' : r.profitFactor.toFixed(2)}
                      </td>
                      <td className="text-right">{r.avgDrawdownR.toFixed(2)}R</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[12.5px] text-muted">Computing…</p>
          )}
        </Card>
      </main>
    </div>
  );
}

const compactMoney = (v: number) =>
  `${v < 0 ? '−' : ''}$${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}k` : Math.abs(v).toFixed(0)}`;

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
