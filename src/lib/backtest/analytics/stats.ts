import { excursionR, initialRisk, plannedRR } from '../execution/math';
import type { AccountConfig, Trade } from '../execution/types';

export type Outcome = 'win' | 'loss' | 'breakeven';

export const outcomeOf = (t: Trade): Outcome =>
  t.netPnl > 0.004 ? 'win' : t.netPnl < -0.004 ? 'loss' : 'breakeven';

export interface DrawdownStats {
  /** Largest peak-to-trough decline of the closed-trade balance curve. */
  readonly max: number;
  /** As a percent of the peak it fell from. */
  readonly maxPct: number;
  /** Mean depth of the drawdown episodes. */
  readonly average: number;
  readonly episodes: number;
}

export interface TradeStats {
  readonly totalTrades: number;
  readonly winners: number;
  readonly losers: number;
  readonly breakeven: number;
  readonly longs: number;
  readonly shorts: number;
  readonly winRate: number;
  readonly longWinRate: number;
  readonly shortWinRate: number;
  readonly netPnl: number;
  readonly returnPct: number;
  readonly grossProfit: number;
  readonly grossLoss: number;
  /** null when there are no losses (shown as ∞ / —). */
  readonly profitFactor: number | null;
  readonly avgWin: number;
  readonly avgLoss: number;
  readonly bestWin: number;
  readonly bestWinPct: number;
  readonly worstLoss: number;
  readonly worstLossPct: number;
  /** Planned R:R over trades with both SL and TP. */
  readonly avgRR: number | null;
  readonly maxRR: number | null;
  /** Realized R over trades with an initial SL. */
  readonly avgR: number | null;
  readonly totalR: number | null;
  readonly expectancy: number;
  readonly expectancyR: number | null;
  readonly drawdown: DrawdownStats;
  readonly maxConsecutiveWins: number;
  readonly maxConsecutiveLosses: number;
  readonly avgDuration: number;
  readonly avgWinDuration: number;
  readonly avgLossDuration: number;
  readonly totalCommission: number;
  readonly recoveryFactor: number | null;
  /** Mean R / standard deviation of R (per trade). */
  readonly sharpeR: number | null;
  /** How far price went against winning trades before they closed, in R. */
  readonly winnerDrawdownR: {
    readonly max: number;
    readonly min: number;
    readonly avg: number;
  } | null;
  readonly avgMaeR: number | null;
  readonly avgMfeR: number | null;
}

const mean = (xs: readonly number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const ratio = (a: number, b: number): number => (b > 0 ? a / b : 0);

/** Trades sorted by close time (the order they hit the balance). */
export const byClose = (trades: readonly Trade[]): Trade[] =>
  [...trades].sort((a, b) => a.closeTime - b.closeTime || a.entryTime - b.entryTime);

/** Balance before each trade's entry (for "% of balance" figures), keyed by trade id. */
function balanceAtEntry(trades: readonly Trade[], start: number): Map<string, number> {
  const closed = byClose(trades);
  const out = new Map<string, number>();
  for (const t of trades) {
    let b = start;
    for (const c of closed) {
      if (c.closeTime > t.entryTime) break;
      if (c.id !== t.id) b += c.netPnl;
    }
    out.set(t.id, b);
  }
  return out;
}

export function drawdownOf(balances: readonly number[]): DrawdownStats {
  let peak = balances[0] ?? 0;
  let max = 0;
  let maxPct = 0;
  const depths: number[] = [];
  let depth = 0;
  for (const b of balances) {
    if (b >= peak) {
      if (depth > 0) depths.push(depth);
      depth = 0;
      peak = b;
      continue;
    }
    const dd = peak - b;
    depth = Math.max(depth, dd);
    if (dd > max) max = dd;
    if (peak > 0 && (dd / peak) * 100 > maxPct) maxPct = (dd / peak) * 100;
  }
  if (depth > 0) depths.push(depth);
  return { max, maxPct, average: mean(depths), episodes: depths.length };
}

function streaks(trades: readonly Trade[]): { wins: number; losses: number } {
  let wins = 0;
  let losses = 0;
  let w = 0;
  let l = 0;
  for (const t of trades) {
    const o = outcomeOf(t);
    w = o === 'win' ? w + 1 : 0;
    l = o === 'loss' ? l + 1 : 0;
    wins = Math.max(wins, w);
    losses = Math.max(losses, l);
  }
  return { wins, losses };
}

export function computeStats(cfg: AccountConfig, trades: readonly Trade[]): TradeStats {
  const all = byClose(trades);
  const wins = all.filter((t) => outcomeOf(t) === 'win');
  const losses = all.filter((t) => outcomeOf(t) === 'loss');
  const longs = all.filter((t) => t.side === 'buy');
  const shorts = all.filter((t) => t.side === 'sell');
  const grossProfit = sum(wins.map((t) => t.netPnl));
  const grossLoss = -sum(losses.map((t) => t.netPnl));
  const netPnl = sum(all.map((t) => t.netPnl));
  const entryBal = balanceAtEntry(all, cfg.startingBalance);
  const pctOf = (t: Trade | undefined) =>
    t ? (t.netPnl / (entryBal.get(t.id) ?? cfg.startingBalance)) * 100 : 0;
  const best = wins.reduce<Trade | undefined>(
    (a, t) => (!a || t.netPnl > a.netPnl ? t : a),
    undefined,
  );
  const worst = losses.reduce<Trade | undefined>(
    (a, t) => (!a || t.netPnl < a.netPnl ? t : a),
    undefined,
  );

  const rrs = all.map(plannedRR).filter((x): x is number => x !== null);
  const rs = all
    .map((t) => {
      const risk = initialRisk(cfg, t);
      return risk === null ? null : t.netPnl / risk;
    })
    .filter((x): x is number => x !== null);
  const avgR = rs.length ? mean(rs) : null;
  const sdR = rs.length > 1 ? Math.sqrt(mean(rs.map((r) => (r - avgR!) ** 2))) : 0;

  const winRate = ratio(wins.length, all.length);
  const avgWin = mean(wins.map((t) => t.netPnl));
  const avgLoss = mean(losses.map((t) => t.netPnl));
  const balances = [cfg.startingBalance];
  for (const t of all) balances.push(balances[balances.length - 1]! + t.netPnl);
  const drawdown = drawdownOf(balances);
  const st = streaks(all);
  const dur = (xs: readonly Trade[]) => mean(xs.map((t) => t.closeTime - t.entryTime));

  const winnerMae = wins.map((t) => excursionR(t)?.mae).filter((x): x is number => x !== undefined);
  const exc = all.map(excursionR).filter((x) => x !== null);

  return {
    totalTrades: all.length,
    winners: wins.length,
    losers: losses.length,
    breakeven: all.length - wins.length - losses.length,
    longs: longs.length,
    shorts: shorts.length,
    winRate,
    longWinRate: ratio(longs.filter((t) => outcomeOf(t) === 'win').length, longs.length),
    shortWinRate: ratio(shorts.filter((t) => outcomeOf(t) === 'win').length, shorts.length),
    netPnl,
    returnPct: (netPnl / cfg.startingBalance) * 100,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    avgWin,
    avgLoss,
    bestWin: best?.netPnl ?? 0,
    bestWinPct: pctOf(best),
    worstLoss: worst?.netPnl ?? 0,
    worstLossPct: pctOf(worst),
    avgRR: rrs.length ? mean(rrs) : null,
    maxRR: rrs.length ? Math.max(...rrs) : null,
    avgR,
    totalR: rs.length ? sum(rs) : null,
    // Expectancy = win% × average win − loss% × |average loss|.
    expectancy: winRate * avgWin + ratio(losses.length, all.length) * avgLoss,
    expectancyR: avgR,
    drawdown,
    maxConsecutiveWins: st.wins,
    maxConsecutiveLosses: st.losses,
    avgDuration: dur(all),
    avgWinDuration: dur(wins),
    avgLossDuration: dur(losses),
    totalCommission: sum(all.map((t) => t.commission)),
    recoveryFactor: drawdown.max > 0 ? netPnl / drawdown.max : null,
    sharpeR: rs.length > 1 && sdR > 0 ? avgR! / sdR : null,
    winnerDrawdownR: winnerMae.length
      ? { max: Math.max(...winnerMae), min: Math.min(...winnerMae), avg: mean(winnerMae) }
      : null,
    avgMaeR: exc.length ? mean(exc.map((e) => e.mae)) : null,
    avgMfeR: exc.length ? mean(exc.map((e) => e.mfe)) : null,
  };
}
