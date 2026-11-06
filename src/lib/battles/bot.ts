import type { Candle } from '@/lib/core';

/** How long a lone searcher waits before a sparring opponent is filled in. */
export const BOT_WAIT_MS = 25_000;

/** Elo change vs a filled opponent is half of a normal ranked duel. */
export const BOT_ELO_SCALE = 0.5;

/** How many public standby lobbies to keep visible for cold-start. */
export const SEED_LOBBY_TARGET = 3;

/** Display names that look like normal traders (never the word bot). */
export const BOT_NAMES = [
  'آرین',
  'نیما',
  'سارا',
  'کسری',
  'مهسا',
  'پارسا',
  'الناز',
  'کیان',
  'هستی',
  'رادین',
  'نگار',
  'امیر',
  'یاسمن',
  'سینا',
  'دنیا',
  'پویا',
  'مریم',
  'آرمین',
  'شایان',
  'نیکا',
  'رضا',
  'مینا',
  'کاوه',
  'لیلا',
] as const;

/** Subset of backtest TradeAction the sparring bot emits (kept local to avoid layer edges). */
export type BotTradeAction =
  | {
      readonly type: 'market';
      readonly id: string;
      readonly side: 'buy' | 'sell';
      readonly volume: number;
      readonly sl: number | null;
      readonly tp: number | null;
    }
  | { readonly type: 'close'; readonly id: string };

export interface BotTradeStep {
  readonly t: number;
  readonly a: BotTradeAction;
}

export interface BotPlanInput {
  readonly bars: readonly Candle[];
  readonly startT: number;
  readonly endT: number;
  readonly pipSize: number;
  readonly lotMin: number;
  readonly seed: number;
  /** 0..1 — higher = fewer mistakes, tighter risk. */
  readonly skill: number;
}

/** Maps a human Elo into a 0..1 skill for the sparring opponent. */
export function botSkill(elo: number): number {
  return Math.max(0.15, Math.min(0.92, (elo - 700) / 1_200));
}

/** Deterministic mulberry32 RNG from a 32-bit seed. */
export function botRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random-looking trader name; pass a seed for stable picks. */
export function randomBotName(seed: number): string {
  const rand = botRng(seed >>> 0);
  const base = BOT_NAMES[Math.floor(rand() * BOT_NAMES.length)]!;
  if (rand() < 0.35) {
    const n = 10 + Math.floor(rand() * 89);
    return `${base}_${n}`;
  }
  return base;
}

const sma = (closes: readonly number[], i: number, n: number): number | null => {
  if (i + 1 < n) return null;
  let sum = 0;
  for (let k = i - n + 1; k <= i; k++) sum += closes[k]!;
  return sum / n;
};

/**
 * Rules-based sparring plan over the battle's 1-minute bars: SMA cross with skill-scaled
 * noise, delayed entries, and SL/TP. Deterministic for a given seed so live ticks can
 * recompute the same script.
 */
export function planBotTrades(input: BotPlanInput): BotTradeStep[] {
  const { bars, startT, endT, pipSize, lotMin, seed, skill } = input;
  const rand = botRng(seed);
  const closes = bars.map((b) => b.close);
  const fast = 8;
  const slow = 21;
  const entryLag = Math.round((1 - skill) * 3);
  const noise = (1 - skill) * 0.45;
  const slPips = 12 + Math.round((1 - skill) * 14);
  const tpMult = 1.4 + skill * 1.1;
  const volume = Math.max(lotMin, Number((lotMin * (skill > 0.7 ? 1.5 : 1)).toFixed(2)));
  const steps: BotTradeStep[] = [];

  let side: 'buy' | 'sell' | null = null;
  let posId: string | null = null;
  let pendingSide: 'buy' | 'sell' | null = null;
  let pendingAt = -1;
  let tradeSeq = 0;

  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i]!;
    if (bar.time < startT || bar.time > endT) continue;
    const f0 = sma(closes, i - 1, fast);
    const s0 = sma(closes, i - 1, slow);
    const f1 = sma(closes, i, fast);
    const s1 = sma(closes, i, slow);
    if (f0 === null || s0 === null || f1 === null || s1 === null) continue;

    let signal: 'buy' | 'sell' | null = null;
    if (f0 <= s0 && f1 > s1) signal = 'buy';
    else if (f0 >= s0 && f1 < s1) signal = 'sell';

    if (signal) {
      if (rand() < noise) signal = signal === 'buy' ? 'sell' : 'buy';
      pendingSide = signal;
      pendingAt = i + entryLag;
    }

    if (pendingSide && i === pendingAt) {
      if (side && posId && side !== pendingSide) {
        steps.push({ t: bar.time, a: { type: 'close', id: posId } });
        side = null;
        posId = null;
      }
      if (!side) {
        const id = `bot-${++tradeSeq}`;
        const entry = bar.close;
        const dist = slPips * pipSize;
        const sl = pendingSide === 'buy' ? entry - dist : entry + dist;
        const tp =
          pendingSide === 'buy' ? entry + dist * tpMult : entry - dist * tpMult;
        steps.push({
          t: bar.time,
          a: {
            type: 'market',
            id,
            side: pendingSide,
            volume,
            sl: roundPrice(sl, pipSize),
            tp: roundPrice(tp, pipSize),
          },
        });
        side = pendingSide;
        posId = id;
      }
      pendingSide = null;
      pendingAt = -1;
    }
  }

  return steps;
}

const roundPrice = (price: number, pipSize: number) => {
  const n = Math.max(0, Math.round(-Math.log10(pipSize)));
  const f = 10 ** n;
  return Math.round(price * f) / f;
};

/** Scales a raw Elo delta for a human who faced a filled opponent. */
export const scaleBotEloDelta = (delta: number) => Math.round(delta * BOT_ELO_SCALE);

/** Presets for cold-start public lobbies (look like normal custom battles). */
export const SEED_LOBBY_PRESETS = [
  {
    name: 'نبرد طلا',
    assets: ['XAUUSD'] as const,
    durationMin: 10,
    speed: 30,
    winCondition: 'time-trial' as const,
    profitTargetPct: null,
    maxDrawdownPct: 10,
  },
  {
    name: 'دوئل یورو',
    assets: ['EURUSD'] as const,
    durationMin: 15,
    speed: 30,
    winCondition: 'time-trial' as const,
    profitTargetPct: null,
    maxDrawdownPct: 10,
  },
  {
    name: 'اسپرینت شاخص',
    assets: ['NAS100'] as const,
    durationMin: 8,
    speed: 60,
    winCondition: 'profit-target' as const,
    profitTargetPct: 2,
    maxDrawdownPct: 5,
  },
] as const;
