import { botRng, seedOf } from './rng';

/**
 * Bot identities. Every bot is one of a fixed pool of stable identities, so a regular you meet
 * again has the same name and the same trading personality. Ids look like ordinary ObjectIds
 * (a registration time in 2025–26 and random bytes) because they reach the browser; bots are
 * identified by the registry below and the `isBot` flag, never by the shape of the id.
 */
export const BOT_POOL_SIZE = 360;

export interface BotIdentity {
  readonly index: number;
  /** 24-hex ObjectId string. */
  readonly id: string;
  readonly name: string;
  /** Seed every persona trait is derived from. */
  readonly seed: number;
  /** Relative chance of showing up (a few regulars, a long tail of occasional players). */
  readonly activity: number;
  /** 0–1 trading skill (most retail traders are beginners: skewed low). */
  readonly skill: number;
}

const REGISTERED_FROM = Date.UTC(2025, 8, 1) / 1000;
const REGISTERED_SPAN = 400 * 86_400;

/** A deterministic, ordinary-looking ObjectId (hex) for a seed. */
export function objectIdHex(seed: number, epochSec: number): string {
  const r = botRng(seed);
  let hex = (Math.floor(epochSec) >>> 0).toString(16).padStart(8, '0');
  for (let i = 0; i < 8; i++) hex += r.int(0, 255).toString(16).padStart(2, '0');
  return hex;
}

export const botIdHex = (index: number) => {
  const r = botRng(seedOf('bot-id', index));
  return objectIdHex(seedOf('bot-id-bytes', index), REGISTERED_FROM + r.next() * REGISTERED_SPAN);
};

let byId: Map<string, number> | null = null;

/** Pool index of a bot id, or null when the id is not a bot's. */
export function botIndexOf(hex: string): number | null {
  if (!byId) byId = new Map(botPool().map((b) => [b.id, b.index]));
  return byId.get(hex) ?? null;
}

export const isBotIdHex = (hex: string) => botIndexOf(hex) !== null;

const LATIN_FIRST = [
  'ali',
  'reza',
  'mohammad',
  'amir',
  'hossein',
  'mahdi',
  'sara',
  'maryam',
  'zahra',
  'nima',
  'sina',
  'arash',
  'kian',
  'parsa',
  'pouya',
  'hamed',
  'saeed',
  'majid',
  'farhad',
  'behnam',
  'milad',
  'mehdi',
  'ehsan',
  'navid',
  'payam',
  'shahin',
  'babak',
  'kaveh',
  'armin',
  'elham',
  'niloofar',
  'fatemeh',
  'negar',
  'hadi',
  'yasin',
  'erfan',
  'aria',
  'danial',
  'soroush',
  'iman',
  'mobin',
  'amin',
  'javad',
  'vahid',
  'peyman',
  'roya',
  'mina',
  'shayan',
  'radin',
  'hesam',
];
const LATIN_SUFFIX = [
  '_fx',
  '.fx',
  '_trader',
  'trader',
  '_gold',
  'gold',
  '_xau',
  'fx',
  '.t',
  '_pa',
  '_ict',
  '_smc',
];
const CAP = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const FA_FIRST = [
  'رضا',
  'علی',
  'مهدی',
  'امیر',
  'سینا',
  'نیما',
  'حسین',
  'محمد',
  'سارا',
  'مریم',
  'آرش',
  'پارسا',
  'میلاد',
  'حامد',
  'سعید',
  'بهنام',
  'کیان',
  'فرهاد',
  'نگار',
  'الهام',
  'یاسین',
  'عرفان',
  'هادی',
];
const FA_SUFFIX = ['', ' تریدر', '_طلا', ' فارکس', ' ف', ' م', ' ر', '۹۲', '۷۵', ' اسکالپر'];
const HANDLES = [
  'XAU_Hunter',
  'GoldDigger',
  'PipMaster',
  'scalper_ir',
  'wolf_trader',
  'SmartMoney',
  'ICT_learner',
  'PriceAction',
  'candle_boy',
  'fx_girl',
  'BullRun',
  'bear.trap',
  'NoStopLoss',
  'trend_rider',
  'Liquidity',
  'OrderBlock',
  'tehran_fx',
  'shiraz.trader',
  'tabriz_gold',
  'mashhad_fx',
  'isfahan.fx',
  'karaj_trader',
  'Sniper_XAU',
  'DayTrader',
  'pip.hunter',
  'nasdaq_lover',
  'eurusd.only',
  'gold_only',
  'zero2hero',
  'patience',
  'risk1percent',
  'breakout_ir',
  'RSI_fan',
];

/** A plausible display name (3–20 letters, digits, spaces, _ . -), like real users pick. */
function makeName(seed: number): string {
  const r = botRng(seed);
  const kind = r.weighted([22, 38, 18, 14, 8]);
  if (kind === 0) return `Trader ${r.int(1000, 9999)}`; // never renamed: the default name
  if (kind === 1) {
    const first = r.pick(LATIN_FIRST);
    const base = r.chance(0.35) ? CAP(first) : first;
    const tail = r.weighted([40, 25, 20, 15]);
    if (tail === 0) return `${base}${r.pick(LATIN_SUFFIX)}`;
    if (tail === 1) return `${base}${r.int(60, 99)}`;
    if (tail === 2) return `${base}_${r.int(1360, 1384)}`;
    return `${base}.${r.pick(LATIN_FIRST).slice(0, r.int(1, 3))}`;
  }
  if (kind === 2) return `${r.pick(FA_FIRST)}${r.pick(FA_SUFFIX)}`.trim();
  if (kind === 3) {
    const h = r.pick(HANDLES);
    return r.chance(0.4) ? `${h}${r.int(1, 99)}` : h;
  }
  return `${CAP(r.pick(LATIN_FIRST))} ${CAP(r.pick(LATIN_FIRST)).slice(0, 1)}`;
}

let pool: readonly BotIdentity[] | null = null;

/** The fixed identity pool (built once, deterministic). */
export function botPool(): readonly BotIdentity[] {
  if (pool) return pool;
  const used = new Set<string>();
  const out: BotIdentity[] = [];
  for (let i = 0; i < BOT_POOL_SIZE; i++) {
    const seed = seedOf('bot-identity', i);
    let name = makeName(seed);
    for (let k = 1; used.has(name.toLowerCase()) || name.length > 20 || name.length < 3; k++)
      name = makeName(seedOf(seed, k));
    used.add(name.toLowerCase());
    const r = botRng(seedOf(seed, 'activity'));
    // Zipf-like: rank r gets ~1/r^0.9, ranks shuffled across the pool.
    const rank = 1 + Math.floor(r.next() * BOT_POOL_SIZE);
    const skill = r.next() ** 1.35;
    out.push({ index: i, id: botIdHex(i), name, seed, activity: 1 / rank ** 0.9, skill });
  }
  pool = out;
  return out;
}

export const botIdentity = (index: number): BotIdentity => botPool()[index % BOT_POOL_SIZE]!;

/**
 * Draws `count` distinct identities, weighted by activity, skipping `exclude` (identities already
 * in this or another running battle). `tilt` (−1…1) leans the draw toward weaker (< 0) or stronger
 * (> 0) traders, so the field matches the human who is in it.
 */
export function drawIdentities(
  seed: number,
  count: number,
  exclude: ReadonlySet<number> = new Set(),
  tilt = 0,
): BotIdentity[] {
  const r = botRng(seed);
  const all = botPool();
  const out: BotIdentity[] = [];
  const taken = new Set(exclude);
  const lean = all.map((b) => b.activity * Math.exp(3 * tilt * (b.skill - 0.4)));
  for (let guard = 0; out.length < count && guard < count * 50; guard++) {
    const weights = all.map((b, i) => (taken.has(b.index) ? 0 : lean[i]!));
    const i = r.weighted(weights);
    if (taken.has(i)) continue;
    taken.add(i);
    out.push(all[i]!);
  }
  return out;
}
