import type { BattleSettings } from '@/lib/battles';
import { objectIdHex } from './identity';
import { botRng, clamp, seedOf, type BotRng } from './rng';

const MINUTE_MS = 60_000;
/** Tehran is UTC+3:30 (no daylight saving since 2022). */
const TEHRAN_OFFSET_MS = 3.5 * 60 * MINUTE_MS;

/** Relative activity by Tehran hour: quiet nights, a lunch bump, busy evenings. */
const HOURLY = [
  0.72, 0.52, 0.34, 0.2, 0.12, 0.1, 0.12, 0.2, 0.3, 0.4, 0.5, 0.55, 0.56, 0.5, 0.5, 0.55, 0.62,
  0.72, 0.82, 0.9, 0.96, 1, 1, 0.9,
];

/** 0–1 platform activity at wall time `now` (Tehran evening ≈ 1, before dawn ≈ 0.1). */
export function activityAt(now: number): number {
  const local = now + TEHRAN_OFFSET_MS;
  const minuteOfDay = Math.floor(local / MINUTE_MS) % (24 * 60);
  const h = Math.floor(minuteOfDay / 60);
  const f = (minuteOfDay % 60) / 60;
  const v = HOURLY[h]! * (1 - f) + HOURLY[(h + 1) % 24]! * f;
  const weekday = new Date(local).getUTCDay(); // 4 = Thursday, 5 = Friday (Iranian weekend)
  const day = weekday === 5 ? (h >= 10 ? 1.15 : 1.05) : weekday === 4 ? 1.06 : 1;
  return clamp(v * day, 0, 1.2);
}

/** World schedule granularity: every slot may open one public battle. */
export const WORLD_SLOT_MS = 30_000;
/** Public battles on show at peak activity, and how long one stays visible on average. */
export const WORLD_PEAK_BATTLES = 12;
const AVG_VISIBLE_MIN = 19;

/** Probability that slot `slot` opens a battle, at activity `a` and presence `presence`. */
export function slotChance(a: number, presence: number): number {
  const perMinute = (WORLD_PEAK_BATTLES * a) / AVG_VISIBLE_MIN;
  return clamp(perMinute * (WORLD_SLOT_MS / MINUTE_MS) * presence, 0, 0.95);
}

export interface WorldBattleSpec {
  readonly slot: number;
  /** Battle `_id` (an ordinary-looking ObjectId created at `createdAt`). */
  readonly id: string;
  readonly seed: number;
  readonly createdAt: number;
  readonly settings: BattleSettings;
  /** 0.5–1.5: how attractive the battle is (gold, short and mid-sized battles fill faster). */
  readonly appeal: number;
  /** Uniform draw deciding whether the slot opens at all (compared with `slotChance`). */
  readonly roll: number;
}

const NAMES = {
  gold: [
    'طلا امشب',
    'نبرد طلا',
    'XAU 15m',
    'gold rush',
    'اونس بازی',
    'طلای شبانه',
    'xau scalp',
    'gold only',
  ],
  fx: ['دوئل یورو', 'EURUSD fight', 'پوند بازها', 'فارکس شبانه', 'majors', 'eu/gu'],
  index: ['نزدک بازی', 'NAS100 sprint', 'شاخص‌بازها', 'us100'],
  any: [
    'بزن بریم',
    'کی میاد؟',
    'تمرین قبل از نیویورک',
    'نبرد سریع',
    'اسکلپ سریع',
    'فقط حرفه‌ای‌ها',
    'بیاین یه دست',
    'نبرد شبانه',
    'friendly',
    'تمرین مدیریت ریسک',
    'battle',
    'یه دست سریع',
    'بدون استرس',
    'چالش دراودان',
    'سشن لندن',
    'رقابت دوستانه',
  ],
};

function pickAssets(r: BotRng): { assets: string[]; kind: keyof typeof NAMES } {
  const k = r.weighted([50, 12, 8, 6, 3, 10, 11]);
  if (k === 0) return { assets: ['XAUUSD'], kind: 'gold' };
  if (k === 1) return { assets: ['EURUSD'], kind: 'fx' };
  if (k === 2) return { assets: ['NAS100'], kind: 'index' };
  if (k === 3) return { assets: ['GBPUSD'], kind: 'fx' };
  if (k === 4) return { assets: ['AUDUSD'], kind: 'fx' };
  if (k === 5) return { assets: ['XAUUSD', 'EURUSD'], kind: 'any' };
  const all = ['XAUUSD', 'EURUSD', 'GBPUSD', 'AUDUSD', 'NAS100'];
  const n = r.int(2, 5);
  const out: string[] = [];
  while (out.length < n) {
    const a = r.pick(all);
    if (!out.includes(a)) out.push(a);
  }
  return { assets: out, kind: 'any' };
}

/** Settings a real host would pick (validated by the same rules as the New Battle dialog). */
export function presetSettings(r: BotRng): { settings: BattleSettings; appeal: number } {
  const { assets, kind } = pickAssets(r);
  const durationMin = [5, 8, 10, 15, 20, 30][r.weighted([8, 4, 18, 22, 10, 6])]!;
  const speed = [15, 30, 60][r.weighted([6, 74, 20])]!;
  const maxParticipants = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20][
    r.weighted([14, 4, 9, 8, 10, 14, 22, 6, 6, 7])
  ]!;
  const target = r.chance(0.25);
  const startingBalance = [5_000, 10_000, 25_000, 50_000, 100_000, 200_000][
    r.weighted([5, 18, 12, 14, 45, 6])
  ]!;
  const maxDrawdownPct = [null, 5, 8, 10, 15, 20][r.weighted([10, 18, 8, 40, 12, 12])]!;
  const maxDailyDrawdownPct =
    maxDrawdownPct === null ? null : [null, 3, 4, 5][r.weighted([30, 15, 10, 45])]!;
  const named = r.chance(0.55) ? r.pick(NAMES[kind]) : r.pick(NAMES.any);
  const settings: BattleSettings = {
    name: named,
    winCondition: target ? 'profit-target' : 'time-trial',
    startingBalance,
    assets,
    historyStart: null,
    historyEnd: null,
    durationMin,
    speed,
    profitTargetPct: target ? [1, 1.5, 2, 2, 3, 5][r.int(0, 5)]! : null,
    maxDrawdownPct,
    maxDailyDrawdownPct:
      maxDailyDrawdownPct !== null &&
      maxDrawdownPct !== null &&
      maxDailyDrawdownPct > maxDrawdownPct
        ? maxDrawdownPct
        : maxDailyDrawdownPct,
    maxParticipants,
    visibility: 'public',
    // A Profit Target battle can be over before a latecomer arrives; hosts close entries.
    allowLateJoin: !target && r.chance(0.65),
  };
  const appeal = clamp(
    (assets.includes('XAUUSD') ? 1.15 : 0.9) *
      (durationMin <= 15 ? 1.08 : 0.85) *
      (maxParticipants === 2 ? 0.8 : 1) *
      r.logNormal(1, 0.2),
    0.5,
    1.5,
  );
  return { settings, appeal };
}

/** The battle slot `slot` would open (deterministic; whether it opens depends on `roll`). */
export function worldSlot(slot: number): WorldBattleSpec {
  const seed = seedOf('world', slot);
  const r = botRng(seed);
  const roll = r.next();
  const createdAt = slot * WORLD_SLOT_MS + Math.floor(r.next() * WORLD_SLOT_MS);
  return specAt(seed, r, createdAt, slot, roll);
}

/** A battle opened outside the schedule (to keep a joinable lobby around), created at `createdAt`. */
export function extraBattle(seed: number, createdAt: number): WorldBattleSpec {
  return specAt(seed, botRng(seed), createdAt, -1, 0);
}

function specAt(seed: number, r: BotRng, createdAt: number, slot: number, roll: number) {
  const { settings, appeal } = presetSettings(r);
  return {
    slot,
    id: objectIdHex(seedOf(seed, 'id'), createdAt / 1000),
    seed,
    createdAt,
    settings,
    appeal,
    roll,
  };
}

/**
 * Open lobbies (waiting for players) to keep at activity `a`: someone who opens the Battles page
 * at a normal hour should always find a battle to join; before dawn the lobby may be quiet.
 */
export function openLobbyFloor(a: number, presence: number): number {
  if (presence < 0.35) return 0;
  return a >= 0.8 ? 2 : a >= 0.4 ? 1 : 0;
}

export const slotOf = (t: number) => Math.floor(t / WORLD_SLOT_MS);
