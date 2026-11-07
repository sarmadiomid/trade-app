import { clamp } from './rng';

/** Operator settings of bot presence. */
export interface BotConfig {
  /** Master switch. */
  readonly enabled: boolean;
  /** 0–1 overall presence (1 = full cold-start activity). */
  readonly level: number;
  /** Concurrent real traders at which bots are fully phased out. */
  readonly phaseOutHumans: number;
  /** Bot-hosted public battles in the lobby. */
  readonly world: boolean;
  /** Bots joining public battles hosted by real users. */
  readonly fill: boolean;
  /** Unrated duel offered when ranked matchmaking finds nobody. */
  readonly duel: boolean;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  enabled: true,
  level: 1,
  phaseOutHumans: 40,
  world: true,
  fill: true,
  duel: true,
};

const bool = (v: string | undefined, d: boolean) =>
  v === undefined || v === '' ? d : !/^(0|false|off|no)$/i.test(v.trim());
const num = (v: string | undefined, d: number) => {
  const n = v === undefined || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};

/** Reads `BATTLE_BOTS`, `BATTLE_BOTS_LEVEL`, `BATTLE_BOTS_PHASE_OUT`, `BATTLE_BOTS_WORLD|FILL|DUEL`. */
export function botConfigFromEnv(env: Readonly<Record<string, string | undefined>>): BotConfig {
  return normalizeBotConfig({
    enabled: bool(env.BATTLE_BOTS, DEFAULT_BOT_CONFIG.enabled),
    level: num(env.BATTLE_BOTS_LEVEL, DEFAULT_BOT_CONFIG.level),
    phaseOutHumans: num(env.BATTLE_BOTS_PHASE_OUT, DEFAULT_BOT_CONFIG.phaseOutHumans),
    world: bool(env.BATTLE_BOTS_WORLD, DEFAULT_BOT_CONFIG.world),
    fill: bool(env.BATTLE_BOTS_FILL, DEFAULT_BOT_CONFIG.fill),
    duel: bool(env.BATTLE_BOTS_DUEL, DEFAULT_BOT_CONFIG.duel),
  });
}

export function normalizeBotConfig(c: Partial<BotConfig>, base = DEFAULT_BOT_CONFIG): BotConfig {
  return {
    enabled: typeof c.enabled === 'boolean' ? c.enabled : base.enabled,
    level: clamp(
      typeof c.level === 'number' && Number.isFinite(c.level) ? c.level : base.level,
      0,
      1,
    ),
    phaseOutHumans: clamp(
      typeof c.phaseOutHumans === 'number' && Number.isFinite(c.phaseOutHumans)
        ? Math.round(c.phaseOutHumans)
        : base.phaseOutHumans,
      1,
      100_000,
    ),
    world: typeof c.world === 'boolean' ? c.world : base.world,
    fill: typeof c.fill === 'boolean' ? c.fill : base.fill,
    duel: typeof c.duel === 'boolean' ? c.duel : base.duel,
  };
}

/**
 * How much bot activity is wanted (0–1) with `humans` real traders active right now: the
 * configured level, fading out linearly as real activity approaches the phase-out point.
 */
export function botPresence(c: BotConfig, humans: number): number {
  if (!c.enabled) return 0;
  return clamp(c.level * (1 - Math.max(0, humans) / c.phaseOutHumans), 0, 1);
}
