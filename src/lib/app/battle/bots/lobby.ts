import { line } from './chat';
import { drawIdentities } from './identity';
import { personaOf } from './persona';
import { botRng, clamp, seedOf, type BotRng } from './rng';

/** One scheduled lobby event (wall-clock `at`, or battle time `atElapsed` once it runs). */
export type LobbyEvent =
  | { readonly kind: 'join'; readonly at: number; readonly index: number }
  | { readonly kind: 'leave'; readonly at: number; readonly index: number }
  | { readonly kind: 'chat'; readonly at: number; readonly index: number; readonly text: string }
  | { readonly kind: 'start'; readonly at: number }
  | { readonly kind: 'cancel'; readonly at: number };

/** A bot joining a battle in progress (allowLateJoin), at battle time `atElapsed`. */
export interface LateJoin {
  readonly atElapsed: number;
  readonly index: number;
}

export interface LobbyPlanInput {
  readonly seed: number;
  readonly createdAt: number;
  readonly maxParticipants: number;
  /** Bot host (world battles), or null when a real user hosts. */
  readonly hostIndex: number | null;
  /** Seats already taken when the plan starts (host included). */
  readonly seated: number;
  readonly appeal: number;
  /** 0–1.2 platform activity at creation (diurnal). */
  readonly activity: number;
  /** 0–1 bot presence (config × phase-out). */
  readonly presence: number;
  readonly allowLateJoin: boolean;
  readonly durationMs: number;
  /** Identities that must not be drawn (busy elsewhere or already seated). */
  readonly exclude: ReadonlySet<number>;
  /** Field lean toward weaker / stronger traders (−1…1). */
  readonly tilt: number;
}

export interface LobbyPlan {
  /** Wall-clock events, in order. */
  readonly events: readonly LobbyEvent[];
  readonly late: readonly LateJoin[];
  /** When the bot host starts the countdown (world battles), or null. */
  readonly startAt: number | null;
  /** When the bot host closes the lobby, or null. */
  readonly cancelAt: number | null;
}

const SEC = 1000;
const MIN = 60 * SEC;
const STEP = 5 * SEC;

/**
 * How a lobby fills up. Arrivals are a Poisson process whose rate follows the hour, the battle's
 * appeal and social proof (an empty lobby attracts fewer joins than one with a few traders), and
 * fades as the lobby gets older. People who wait too long leave. A bot host starts once enough
 * traders are in, or when their patience runs out, and closes a lobby nobody joined.
 */
export function planLobby(input: LobbyPlanInput): LobbyPlan {
  const r = botRng(input.seed);
  const hosted = input.hostIndex !== null;
  const max = input.maxParticipants;
  const events: LobbyEvent[] = [];
  const pool = drawIdentities(
    seedOf(input.seed, 'pool'),
    Math.min(40, max * 3),
    input.exclude,
    input.tilt,
  );
  let next = 0;
  // A human host is never crowded out: bots leave the last seat (and more) to real users.
  // (Duels and 3-seat lobbies may fill: a real user who wants in takes a bot's seat.)
  const fillCap = hosted
    ? max
    : Math.max(
        input.seated,
        Math.min(
          max <= 3 ? max : max - 1,
          Math.round(
            input.seated + (max - 1) * r.range(0.35, 0.85) * input.presence + r.range(-0.4, 0.6),
          ),
        ),
      );
  const threshold = hosted
    ? r.chance(0.2)
      ? max
      : clamp([2, 3, 4, 5, 6][r.weighted([12, 22, 24, 20, 14])]!, 2, max)
    : max;
  // Hosts in a small community wait a while for people before starting.
  const minWait = r.range(60, 240) * SEC;
  const patience = r.range(5, 14) * MIN;
  const horizon = hosted ? patience + 2 * MIN : 30 * MIN;
  const base = (hosted ? 0.95 : 0.75) * input.activity * input.appeal * input.presence;

  const seated: { index: number; leaveAt: number }[] = [];
  let count = input.seated;
  let startAt: number | null = null;
  let cancelAt: number | null = null;
  let fullAt: number | null = null;
  let hostTalked = false;

  if (hosted && r.chance(personaOf(input.hostIndex!).chattiness * 0.6))
    events.push({
      kind: 'chat',
      at: input.createdAt + r.range(3, 25) * SEC,
      index: input.hostIndex!,
      text: line(r, r.chance(0.6) ? 'hello' : 'luck'),
    });

  for (let t = input.createdAt + STEP; t <= input.createdAt + horizon; t += STEP) {
    const age = t - input.createdAt;
    // Arrivals.
    const room = (hosted ? max : fillCap) - count;
    if (room > 0 && next < pool.length) {
      const social = 0.55 + 0.22 * Math.min(4, count);
      const fresh = Math.exp(-age / (7 * MIN)) + 0.25;
      const crowd = room === 1 ? 0.6 : 1;
      const lambda = base * social * fresh * crowd; // per minute
      if (r.chance(1 - Math.exp(-lambda * (STEP / MIN)))) {
        const who = pool[next++]!;
        const at = t - Math.floor(r.next() * STEP);
        events.push({ kind: 'join', at, index: who.index });
        count += 1;
        // People wait longer in a real host's lobby they chose than in a stranger's.
        seated.push({
          index: who.index,
          leaveAt: at + (hosted ? 2 * MIN + r.exp(7 * MIN) : 3 * MIN + r.exp(12 * MIN)),
        });
        const p = personaOf(who.index);
        if (r.chance(p.chattiness * 0.55))
          events.push({
            kind: 'chat',
            at: at + r.range(2, 15) * SEC,
            index: who.index,
            text: line(r, r.chance(0.65) ? 'hello' : 'luck'),
          });
        if (count >= max && fullAt === null) fullAt = at;
      }
    }
    // Leaving a lobby that is taking too long.
    for (let k = seated.length - 1; k >= 0; k--) {
      const s = seated[k]!;
      if (s.leaveAt > t) continue;
      seated.splice(k, 1);
      if (personaOf(s.index).chattiness > 0.35 && r.chance(0.4))
        events.push({
          kind: 'chat',
          at: s.leaveAt - r.range(5, 30) * SEC,
          index: s.index,
          text: line(r, 'impatient'),
        });
      events.push({ kind: 'leave', at: s.leaveAt, index: s.index });
      count -= 1;
      if (count < max) fullAt = null;
    }
    if (!hosted) continue;
    // The bot host decides.
    if (
      !hostTalked &&
      age > 3 * MIN &&
      count < threshold &&
      r.chance(personaOf(input.hostIndex!).chattiness * 0.5)
    ) {
      hostTalked = true;
      events.push({ kind: 'chat', at: t, index: input.hostIndex!, text: line(r, 'hostWait') });
    }
    const full = fullAt !== null && t - fullAt >= r.range(5, 20) * SEC;
    if (full || (count >= threshold && age >= minWait) || (age >= patience && count >= 2)) {
      startAt = t;
      break;
    }
    if (age >= patience && count < 2) {
      cancelAt = t;
      break;
    }
  }
  if (hosted && startAt === null && cancelAt === null) cancelAt = input.createdAt + horizon;
  const end = startAt ?? cancelAt ?? Infinity;
  // Everything after the host's decision is dropped; nobody leaves after the start.
  const kept = events.filter((e) => e.at < end);
  if (startAt !== null) kept.push({ kind: 'start', at: startAt });
  if (cancelAt !== null) kept.push({ kind: 'cancel', at: cancelAt });
  kept.sort((a, b) => a.at - b.at);
  const late =
    hosted && startAt !== null && input.allowLateJoin
      ? lateJoins(r, input, pool.slice(next), max - count)
      : [];
  return { events: kept, late, startAt, cancelAt };
}

/** A few traders arrive after the start (when late entries are allowed). */
export function lateJoins(
  r: BotRng,
  input: Pick<LobbyPlanInput, 'durationMs'>,
  pool: readonly { index: number }[],
  room: number,
): LateJoin[] {
  const out: LateJoin[] = [];
  let n = Math.min(room, pool.length, r.weighted([55, 30, 12, 3]));
  let i = 0;
  while (n-- > 0)
    out.push({
      atElapsed: Math.floor(r.range(0.05, 0.4) * input.durationMs),
      index: pool[i++]!.index,
    });
  return out.sort((a, b) => a.atElapsed - b.atElapsed);
}

/**
 * How a bot host reacts to a real user joining their lobby: start soon, but give a nearly
 * empty lobby a minute for a few more people (and start almost at once when it is full).
 */
export function hostReaction(r: BotRng, now: number, seats: number, max: number): number {
  if (seats >= max) return now + r.range(4, 12) * SEC;
  if (max >= 4 && seats / max < 0.4) return now + r.range(35, 90) * SEC;
  return now + r.range(18, 55) * SEC;
}
