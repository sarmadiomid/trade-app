import type { PlanEventKind } from './planner';
import type { Persona } from './persona';
import type { BotRng } from './rng';

/**
 * What traders say. Short, informal Persian (with the usual Finglish), sparse: most traders
 * never type anything, and nobody narrates their trades.
 */
const LINES = {
  hello: ['سلام', 'سلام به همه', 'slm', 'سلام بچه‌ها', 'درود', 'hi', 'سلام سلام'],
  luck: ['gl', 'موفق باشید', 'بزن بریم', 'gl all', 'موفق باشین همگی', 'سود باشه'],
  hostWait: [
    'یکی دو نفر دیگه بیان شروع می‌کنم',
    'چند دقیقه دیگه شروع می‌کنیم',
    'منتظر بقیه‌ایم',
    'یه کم صبر کنید',
  ],
  impatient: ['شروع کنیم؟', 'کی شروع میشه؟', 'بزن دیگه', 'start?', 'شروع کن داداش'],
  stopped: ['استاپمو زد 😑', 'اه', 'عجب فیکی', 'استاپ خوردم', 'این چه حرکتی بود', '😐', 'ای بابا'],
  bigwin: ['👌', 'خوب بود', 'تی‌پی خورد 😎', 'یس', 'nice', '🔥'],
  dq: ['حذف شدم 😂', 'دراودان رو رد کردم', 'تموم شد برام', 'رفتم که رفتم', '💀'],
  leave: ['من رفتم', 'بای', 'امروز روز من نیست', 'بعدا میام'],
  target: ['تارگت 🎯', 'رسیدم', 'yes'],
  end: ['gg', 'GG', 'gg wp', 'تبریک به نفر اول', 'خسته نباشید', 'دفعه بعد 💪', 'خوب بود بچه‌ها'],
  reply: ['سلام', 'سلام 👋', 'درود', 'slm', 'سلام خوش اومدی', 'سلااام'],
} as const;

export type ChatTopic = keyof typeof LINES;

export function line(r: BotRng, topic: ChatTopic): string {
  return r.pick(LINES[topic]);
}

/** Chance a trader says something about an event of their own battle. */
const EVENT_CHANCE: Partial<Record<PlanEventKind, number>> = {
  stopped: 0.22,
  bigwin: 0.15,
  dq: 0.45,
  leave: 0.4,
  target: 0.35,
};

/** A line for an event, or null when they stay silent (most of the time). */
export function eventLine(r: BotRng, persona: Persona, kind: PlanEventKind): string | null {
  const p = (EVENT_CHANCE[kind] ?? 0) * Math.min(1, persona.chattiness * 2.2);
  if (!r.chance(p)) return null;
  return line(r, kind as ChatTopic);
}

const GREETING = /^(سلا+م|slm|salam|hi|hello|hey|درود)(?=$|[\s!.,،؟?\u{1F300}-\u{1FAFF}])/iu;

/** True when a chat message is a plain greeting (the only thing bots ever reply to). */
export const isGreeting = (text: string) => GREETING.test(text.trim());
