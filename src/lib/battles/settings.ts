import { DAY_MS, HOUR_MS, MINUTE_MS } from '@/lib/core';
import type { BattleSettings, WinCondition } from './types';

/** Symbols that can be traded in battles (the market data must provide them). */
export const BATTLE_ASSETS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'NAS100'] as const;
export const MAX_ASSETS = 5;

/** Market minutes per real minute. */
export const BATTLE_SPEEDS = [15, 30, 60] as const;
export const STARTING_BALANCES = [5_000, 10_000, 25_000, 50_000, 100_000, 200_000] as const;
export const MIN_DURATION = 1;
export const MAX_DURATION = 99;
export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 20;
export const COUNTDOWN_MS = 10_000;
export const MAX_CHAT = 200;
export const MAX_ACTIONS = 2_000;

export const WIN_CONDITIONS: Readonly<Record<WinCondition, { name: string; short: string }>> = {
  'time-trial': {
    name: 'Time Trial',
    short: 'Highest return when the timer reaches zero wins',
  },
  'profit-target': {
    name: 'Profit Target',
    short: 'First to reach the profit target wins',
  },
};

export const DEFAULT_SETTINGS: BattleSettings = {
  name: '',
  winCondition: 'time-trial',
  startingBalance: 100_000,
  assets: ['XAUUSD'],
  durationMin: 15,
  speed: 30,
  profitTargetPct: null,
  maxDrawdownPct: 10,
  maxDailyDrawdownPct: 5,
  maxParticipants: 10,
  visibility: 'public',
  allowLateJoin: true,
};

/** Market time a battle replays. */
export const marketSpanMs = (s: Pick<BattleSettings, 'durationMin' | 'speed'>) =>
  s.durationMin * s.speed * MINUTE_MS;

/**
 * Longest replay that fits in one trading week (Monday 01:00 → Friday 20:00 UTC), so a battle
 * never sits through a weekend.
 */
export const MAX_MARKET_SPAN_MS = 4 * DAY_MS + 19 * HOUR_MS;

/** Problems with a battle's settings, or null. */
export function validateBattleSettings(s: BattleSettings): string | null {
  if (!s.name.trim()) return 'Battle name is required';
  if (s.name.trim().length > 50) return 'Battle name must be at most 50 characters';
  if (!(s.winCondition in WIN_CONDITIONS)) return 'Unknown battle type';
  if (!Number.isFinite(s.startingBalance) || s.startingBalance < 1_000 || s.startingBalance > 1e7)
    return 'Starting balance must be between 1,000 and 10,000,000';
  if (s.assets.length < 1) return 'Pick at least one asset';
  if (s.assets.length > MAX_ASSETS) return `Pick at most ${MAX_ASSETS} assets`;
  if (new Set(s.assets).size !== s.assets.length) return 'Assets must be unique';
  for (const a of s.assets)
    if (!(BATTLE_ASSETS as readonly string[]).includes(a)) return `${a} is not available`;
  if (
    !Number.isInteger(s.durationMin) ||
    s.durationMin < MIN_DURATION ||
    s.durationMin > MAX_DURATION
  )
    return `Duration must be ${MIN_DURATION}–${MAX_DURATION} minutes`;
  if (!(BATTLE_SPEEDS as readonly number[]).includes(s.speed)) return 'Unknown replay speed';
  if (marketSpanMs(s) > MAX_MARKET_SPAN_MS)
    return 'This duration at this speed replays more than one trading week';
  if (s.winCondition === 'profit-target' && s.profitTargetPct === null)
    return 'Profit Target battles need a profit target';
  if (s.profitTargetPct !== null && !(s.profitTargetPct >= 0.1 && s.profitTargetPct <= 100))
    return 'Profit target must be 0.1–100%';
  for (const [label, v] of [
    ['Max drawdown', s.maxDrawdownPct],
    ['Max daily drawdown', s.maxDailyDrawdownPct],
  ] as const)
    if (v !== null && !(v >= 0.5 && v <= 99)) return `${label} must be 0.5–99%`;
  if (
    !Number.isInteger(s.maxParticipants) ||
    s.maxParticipants < MIN_PARTICIPANTS ||
    s.maxParticipants > MAX_PARTICIPANTS
  )
    return `Participants must be ${MIN_PARTICIPANTS}–${MAX_PARTICIPANTS}`;
  if (s.visibility !== 'public' && s.visibility !== 'private') return 'Unknown visibility';
  return null;
}

/** Normalises user input (trimmed name, no target outside Profit Target battles). */
export function normalizeSettings(s: BattleSettings): BattleSettings {
  return {
    ...s,
    name: s.name.trim(),
    profitTargetPct: s.winCondition === 'profit-target' ? s.profitTargetPct : null,
  };
}

/** Matchmade ranked formats (fixed rules so every ranked game is comparable). */
export interface RankedFormat {
  readonly id: 'duel' | 'sprint';
  readonly name: string;
  readonly summary: string;
  readonly settings: BattleSettings;
}

export const RANKED_FORMATS: readonly RankedFormat[] = [
  {
    id: 'duel',
    name: 'دوئل رتبه‌ای',
    summary: 'یک‌به‌یک · ۱۰ دقیقه · زمان‌دار',
    settings: {
      name: 'دوئل رتبه‌ای',
      winCondition: 'time-trial',
      startingBalance: 100_000,
      assets: [...BATTLE_ASSETS],
      durationMin: 10,
      speed: 30,
      profitTargetPct: null,
      maxDrawdownPct: 10,
      maxDailyDrawdownPct: 5,
      maxParticipants: 2,
      visibility: 'private',
      allowLateJoin: false,
    },
  },
  {
    id: 'sprint',
    name: 'اسپرینت رتبه‌ای',
    summary: 'یک‌به‌یک · ۵ دقیقه · اولین رسیدن به ۲٪+',
    settings: {
      name: 'اسپرینت رتبه‌ای',
      winCondition: 'profit-target',
      startingBalance: 100_000,
      assets: [...BATTLE_ASSETS],
      durationMin: 5,
      speed: 60,
      profitTargetPct: 2,
      maxDrawdownPct: 5,
      maxDailyDrawdownPct: 5,
      maxParticipants: 2,
      visibility: 'private',
      allowLateJoin: false,
    },
  },
];

export function rankedFormat(id: string): RankedFormat | null {
  return RANKED_FORMATS.find((f) => f.id === id) ?? null;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const BATTLE_CODE_LENGTH = 6;

/** A battle ID players type to join a private battle, from a random source in [0, 1). */
export function battleCode(random: () => number): string {
  let out = '';
  for (let i = 0; i < BATTLE_CODE_LENGTH; i++)
    out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]!;
  return out;
}

export const normalizeCode = (code: string) =>
  code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
