import { botIdentity, type BotIdentity } from './identity';
import { botRng, clamp, seedOf } from './rng';

/**
 * How a bot trades. Styles are the ones retail traders actually use in a short competition; the
 * mix leans toward beginners (gut feeling, chasing candles) as it does on any young platform.
 */
export type BotStyle = 'trend' | 'reversion' | 'scalper' | 'swing' | 'impulsive' | 'gut' | 'idle';

export const STYLES: readonly BotStyle[] = [
  'trend',
  'reversion',
  'scalper',
  'swing',
  'impulsive',
  'gut',
  'idle',
];
const STYLE_WEIGHTS = [20, 13, 15, 10, 12, 22, 8];

/** Replay-stepping habit (how a trader moves through the candles). */
export type PaceHabit = 'autoplay' | 'stepper';

export interface Persona {
  readonly index: number;
  readonly name: string;
  readonly style: BotStyle;
  readonly skill: number;
  /** Chart timeframe the trader reads signals on (minutes). */
  readonly tf: 1 | 5 | 15;
  /** Percent of balance risked per trade (before tilt and late-game adjustments). */
  readonly riskPct: number;
  /** Takes outsized risks (and sometimes trades without a stop). */
  readonly gambler: boolean;
  /** Uses a risk calculator (exact lots) instead of round lot sizes. */
  readonly riskCalc: boolean;
  /** Chance a trade gets a stop loss / take profit. */
  readonly useSl: number;
  readonly useTp: number;
  /** Reward:risk aimed for. */
  readonly rr: number;
  /** Stop distance in ATRs of the chart timeframe. */
  readonly stopAtr: number;
  /** Chance of acting on a valid signal. */
  readonly selectivity: number;
  /** Candles between a signal and the order. */
  readonly reaction: readonly [number, number];
  /** Minimum minutes between entries. */
  readonly cooldown: number;
  readonly maxOpen: number;
  /** Chance of using a pending (limit / stop) order instead of a market order. */
  readonly pendingPref: number;
  readonly beAt1R: number;
  readonly partialAt1R: number;
  /** Disposition effect: closes winners early. */
  readonly cutWinners: number;
  /** Moves the stop away when price nears it (holding losers). */
  readonly widenStops: number;
  /** Minutes a flat trade is tolerated before it is closed. */
  readonly patience: number;
  /** How much a loss feeds tilt (revenge sizing, overtrading). */
  readonly tiltGain: number;
  /** Respects drawdown limits when sizing. */
  readonly ddAware: number;
  /** Drawdown (% of start) at which they may leave, and the chance they do. */
  readonly quitAtPct: number;
  readonly quitChance: number;
  /** Return (%) after which they may stop trading to protect it. */
  readonly protectAtPct: number;
  /** Late in a time trial and behind: chance of one big swing. */
  readonly catchUp: number;
  /** Chance per minute of looking away for a while (positions keep running). */
  readonly afkRate: number;
  /** Chance per minute of checking open trades. */
  readonly attention: number;
  readonly pace: PaceHabit;
  /** Candles per second while playing (autoplay) or stepping (manual). */
  readonly stepRate: number;
  readonly chattiness: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Rounds a risk percent to what people actually type (0.25, 0.5, 1, 2 …). */
function humanPct(v: number): number {
  const steps = [0.1, 0.2, 0.25, 0.3, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  let best = steps[0]!;
  for (const s of steps) if (Math.abs(Math.log(s / v)) < Math.abs(Math.log(best / v))) best = s;
  return best;
}

/** The stable personality of an identity. */
export function basePersona(identity: BotIdentity): Persona {
  const r = botRng(seedOf(identity.seed, 'persona'));
  const s = identity.skill;
  const style = STYLES[r.weighted(STYLE_WEIGHTS)]!;
  const gambler = r.chance(0.12 * (1 - s) + (style === 'impulsive' ? 0.1 : 0));
  const styleRisk: Record<BotStyle, number> = {
    trend: 1,
    reversion: 0.9,
    scalper: 0.55,
    swing: 1.2,
    impulsive: 1.35,
    gut: 1.15,
    idle: 0.6,
  };
  const rawRisk = lerp(1.25, 0.5, s) * styleRisk[style] * r.logNormal(1, 0.45) * (gambler ? 3 : 1);
  const riskCalc = r.chance(0.15 + 0.6 * s);
  const tfByStyle: Record<BotStyle, readonly number[]> = {
    trend: [1, 3, 4],
    reversion: [2, 4, 2],
    scalper: [8, 2, 0],
    swing: [0, 2, 6],
    impulsive: [6, 3, 1],
    gut: [3, 3, 2],
    idle: [2, 3, 3],
  };
  const tf = ([1, 5, 15] as const)[r.weighted(tfByStyle[style])]!;
  const rrBy: Record<BotStyle, readonly [number, number]> = {
    trend: [1.5, 3],
    reversion: [0.9, 1.8],
    scalper: [0.7, 1.4],
    swing: [2, 3.5],
    impulsive: [1, 2.5],
    gut: [0.8, 2.2],
    idle: [1, 2],
  };
  const cooldownBy: Record<BotStyle, readonly [number, number]> = {
    trend: [15, 45],
    reversion: [12, 40],
    scalper: [3, 10],
    swing: [45, 120],
    impulsive: [6, 25],
    gut: [10, 45],
    idle: [60, 200],
  };
  const selectBy: Record<BotStyle, number> = {
    trend: 0.6,
    reversion: 0.55,
    scalper: 0.65,
    swing: 0.7,
    impulsive: 0.7,
    gut: 0.5,
    idle: 0.12,
  };
  const beginner = style === 'gut' || style === 'impulsive';
  const pace: PaceHabit = r.chance(0.62) ? 'autoplay' : 'stepper';
  const stepRate =
    pace === 'autoplay' ? r.pick([0.5, 1, 1, 1, 2, 2, 3]) : r.range(0.25, 0.9) * (1 + s * 0.3);
  return {
    index: identity.index,
    name: identity.name,
    style,
    skill: s,
    tf,
    riskPct: clamp(humanPct(rawRisk), 0.1, gambler ? 10 : 4),
    gambler,
    riskCalc,
    useSl: clamp(0.5 + 0.5 * s - (beginner ? 0.15 : 0) - (gambler ? 0.3 : 0), 0.15, 1),
    useTp: clamp(0.35 + 0.45 * s + (style === 'scalper' ? 0.2 : 0), 0.1, 0.98),
    rr: r.range(...rrBy[style]),
    stopAtr: r.range(1.1, 2.6) * (style === 'scalper' ? 0.7 : style === 'swing' ? 1.3 : 1),
    selectivity: clamp(selectBy[style] * r.range(0.7, 1.25), 0.05, 0.95),
    reaction: s > 0.6 ? [0, 1] : s > 0.3 ? [0, 2] : [1, 3],
    cooldown: Math.round(r.range(...cooldownBy[style])),
    maxOpen: style === 'scalper' || gambler ? r.int(1, 3) : r.chance(0.2) ? 2 : 1,
    pendingPref: clamp(0.05 + 0.25 * s * r.next() + (style === 'reversion' ? 0.2 : 0), 0, 0.5),
    beAt1R: clamp(0.1 + 0.55 * s + r.range(-0.1, 0.1), 0, 0.9),
    partialAt1R: clamp(0.05 + 0.3 * s * r.next(), 0, 0.5),
    cutWinners: clamp(0.55 - 0.45 * s + r.range(-0.1, 0.1), 0.03, 0.8),
    widenStops: clamp(0.4 - 0.35 * s + r.range(-0.1, 0.1), 0, 0.6),
    patience: Math.round(r.range(20, 90) * (style === 'swing' ? 2 : style === 'scalper' ? 0.4 : 1)),
    tiltGain: clamp(0.75 - 0.6 * s + r.range(-0.15, 0.15), 0.05, 0.95),
    ddAware: clamp(0.25 + 0.75 * s, 0, 1),
    quitAtPct: r.logNormal(3.5, 0.4),
    quitChance: clamp(0.45 - 0.35 * s, 0.05, 0.5),
    protectAtPct: r.logNormal(1.6, 0.5) * (gambler ? 2.5 : 1),
    catchUp: clamp(0.5 - 0.3 * s + (gambler ? 0.3 : 0), 0.05, 0.9),
    afkRate: r.range(0.002, 0.012) * (style === 'idle' ? 3 : 1),
    attention: clamp(0.55 + 0.4 * s + r.range(-0.1, 0.1), 0.3, 0.98),
    pace,
    stepRate,
    chattiness: clamp(r.logNormal(0.25, 0.8), 0, 1),
  };
}

const cache = new Map<number, Persona>();

/** The persona of identity `index` (memoised; personas never change). */
export function personaOf(index: number): Persona {
  let p = cache.get(index);
  if (!p) cache.set(index, (p = basePersona(botIdentity(index))));
  return p;
}

/**
 * Today's version of a persona: the same trader, in a slightly different mood (risk a bit
 * higher or lower, a little more or less patient). Deterministic per battle.
 */
export function moodOf(p: Persona, battleSeed: number): Persona {
  const r = botRng(seedOf(battleSeed, p.index, 'mood'));
  return {
    ...p,
    riskPct: clamp(p.riskPct * r.logNormal(1, 0.2), 0.05, p.gambler ? 12 : 5),
    selectivity: clamp(p.selectivity * r.logNormal(1, 0.15), 0.03, 0.97),
    cooldown: Math.max(2, Math.round(p.cooldown * r.logNormal(1, 0.2))),
    stepRate: p.stepRate * r.logNormal(1, 0.12),
  };
}
