import { describe, expect, it } from 'vitest';
import { ObjectId, type UpdateFilter } from 'mongodb';
import {
  DEFAULT_SETTINGS,
  START_ELO,
  elapsedMs,
  marketEnd,
  type BattleSettings,
} from '@/lib/battles';
import { worldSlot } from '@/lib/app/battle/bots/world';
import {
  botStanding,
  clockOf,
  evictBotFor,
  fillMeta,
  hasHuman,
  materializeWorld,
  onHumanJoined,
  pumpBattle,
  seatCursor,
  seatsTaken,
} from '@/server/battles/bot-room';
import { battleMarket } from '@/server/battles/market';
import { simulateParticipant } from '@/server/battles/simulate';
import type { BattleDoc, BattleParticipantDoc } from '@/server/db';

const MIN = 60_000;
const ctx = { market: battleMarket, busy: new Set<number>() };

/** Applies a Mongo update the way the server's commit would (the subset the pump uses). */
function apply(b: BattleDoc, u: UpdateFilter<BattleDoc>): BattleDoc {
  const next = { ...b } as Record<string, unknown>;
  for (const [k, v] of Object.entries((u.$set ?? {}) as Record<string, unknown>)) next[k] = v;
  const push = (u.$push ?? {}) as Record<string, { $each: unknown[]; $slice?: number }>;
  for (const [k, v] of Object.entries(push)) {
    const arr = [...((next[k] as unknown[]) ?? []), ...v.$each];
    next[k] = v.$slice ? arr.slice(v.$slice) : arr;
  }
  next.version = b.version + 1;
  return next as unknown as BattleDoc;
}

/** Pumps a battle from `from` to `to` in `step` increments, with the server's own transitions. */
function run(b: BattleDoc, from: number, to: number, step = 5_000): BattleDoc {
  for (let now = from; now <= to; now += step) {
    for (let guard = 0; guard < 10; guard++) {
      const u = pumpBattle(b, now, ctx);
      if (!u) break;
      b = apply(b, u);
    }
    if (b.status === 'countdown' && b.countdownEndsAt !== null && now >= b.countdownEndsAt)
      b = { ...b, status: 'live', startedAt: b.countdownEndsAt };
  }
  return b;
}

/** A world battle that starts, found by scanning the schedule. */
function worldBattle(state: 'standby' | 'live', offset = 0): { b: BattleDoc; now: number } {
  for (let slot = 60_000_000 + offset; slot < 60_000_000 + offset + 4000; slot++) {
    const spec = worldSlot(slot);
    const probe = materializeWorld(spec, spec.createdAt + 1000, { ...ctx, presence: 1 });
    if (!probe) continue;
    const late = materializeWorld(spec, spec.createdAt + 40 * MIN, { ...ctx, presence: 1 });
    for (let dt = 5_000; dt < 40 * MIN; dt += 15_000) {
      const now = spec.createdAt + dt;
      const b = materializeWorld(spec, now, { ...ctx, presence: 1 });
      if (b && b.status === state && b.participants.length >= 3) return { b, now };
    }
    void late;
  }
  throw new Error('no world battle found');
}

function human(b: BattleDoc, joinedAt: number): BattleParticipantDoc {
  return {
    userId: new ObjectId(),
    name: 'Real User',
    joinedAt,
    startT: b.marketStart,
    startBid: battleMarket.bidBefore(b.symbol, b.marketStart),
    elo: START_ELO,
    games: 0,
    actions: [],
    cursor: b.marketStart,
    leftT: null,
  };
}

describe('world battles', () => {
  it('materialise in a consistent past state', () => {
    for (let slot = 59_000_000; slot < 59_000_400; slot++) {
      const spec = worldSlot(slot);
      for (const dt of [10_000, 3 * MIN, 9 * MIN, 20 * MIN]) {
        const now = spec.createdAt + dt;
        const b = materializeWorld(spec, now, { ...ctx, presence: 1 });
        if (!b) continue;
        expect(b.createdAt).toBe(spec.createdAt);
        expect(b._id.toHexString()).toBe(spec.id);
        expect(b.participants.length).toBeLessThanOrEqual(b.settings.maxParticipants);
        expect(b.participants.every((p) => p.isBot && p.bot)).toBe(true);
        expect(b.hostId!.equals(b.participants[0]!.userId)).toBe(true);
        expect(b.chat.every((c) => c.at <= now)).toBe(true);
        expect(b.bots!.events.every((e) => e.at > now)).toBe(true);
        expect(new Set(b.participants.map((p) => p.userId.toHexString())).size).toBe(
          b.participants.length,
        );
        if (b.status === 'live') expect(b.startedAt!).toBeLessThanOrEqual(now);
        if (b.status === 'live')
          expect(now - b.startedAt!).toBeLessThan(b.settings.durationMin * MIN);
        expect(['standby', 'countdown', 'live']).toContain(b.status);
      }
    }
  });

  it('grow over time, then the bot host starts', () => {
    const { b, now } = worldBattle('standby');
    const start = b.participants.length;
    const after = run(b, now, now + 30 * MIN);
    expect(['countdown', 'live', 'cancelled']).toContain(after.status);
    if (after.status !== 'cancelled')
      expect(after.participants.length).toBeGreaterThanOrEqual(Math.min(2, start));
    // Nothing simulated: no human ever came.
    expect(after.participants.every((p) => p.actions.length === 0)).toBe(true);
  });

  it('start soon after a real user joins, and never close on them', () => {
    let checked = 0;
    for (let k = 0; k < 12; k++) {
      const { b, now } = worldBattle('standby', k * 997);
      const me = human(b, now);
      const parts = [...b.participants, me];
      const joined: BattleDoc = {
        ...b,
        participants: parts,
        bots: onHumanJoined(
          b.bots!,
          { ...b, participants: parts },
          now,
          parts.length >= b.settings.maxParticipants,
        ),
      };
      expect(joined.bots!.events.some((e) => e.kind === 'cancel')).toBe(false);
      expect(joined.bots!.startAt).not.toBeNull();
      expect(joined.bots!.startAt! - now).toBeLessThanOrEqual(90_000);
      const after = run(joined, now, now + 100_000, 2_000);
      expect(['countdown', 'live']).toContain(after.status);
      checked += 1;
    }
    expect(checked).toBe(12);
  });
});

describe('bots in a battle with a real user', () => {
  const live = () => {
    const { b, now } = worldBattle('live');
    const withMe: BattleDoc = { ...b, participants: [...b.participants, human(b, now)] };
    const planned = run(withMe, now, now);
    return { b: planned, now };
  };

  it('are planned only once a real user is in, and every plan is valid', () => {
    const { b: botOnly, now } = worldBattle('live');
    expect(hasHuman(botOnly)).toBe(false);
    const still = run(botOnly, now, now + MIN);
    expect(still.participants.every((p) => !p.bot!.planned)).toBe(true);

    const { b } = live();
    const bots = b.participants.filter((p) => p.bot);
    expect(bots.every((p) => p.bot!.planned)).toBe(true);
    expect(bots.reduce((n, p) => n + p.actions.length, 0)).toBeGreaterThan(0);
  });

  it('standings equal the canonical server simulation at every moment', () => {
    for (let k = 0; k < 4; k++) {
      const { b: base, now } = worldBattle('live', k * 1013);
      const b = run({ ...base, participants: [...base.participants, human(base, now)] }, now, now);
      const end = b.startedAt! + b.settings.durationMin * MIN;
      for (let t = now; t <= end; t += Math.max(5_000, Math.floor((end - now) / 30))) {
        for (const p of b.participants.filter((x) => x.bot)) {
          const cursor = seatCursor(b, p, t, battleMarket);
          const fast = botStanding(b, p, t, battleMarket);
          const leftNow = p.bot!.leaveT !== null && cursor >= p.bot!.leaveT;
          const canon = simulateParticipant(
            b,
            leftNow ? { ...p, leftT: p.bot!.leaveT } : p,
            cursor,
          ).standing;
          expect(fast.balance).toBeCloseTo(canon.balance, 2);
          expect(fast.equity).toBeCloseTo(canon.equity, 2);
          expect(fast.trades).toBe(canon.trades);
          expect(fast.wins).toBe(canon.wins);
          expect(fast.openPositions).toBe(canon.openPositions);
          expect(fast.status).toBe(canon.status);
          expect(fast.returnPct).toBeCloseTo(canon.returnPct, 6);
        }
      }
    }
  });

  it('step through the replay like people: monotonic, frozen while paused, mostly finishing', () => {
    const { b } = live();
    const end = marketEnd(clockOf(b));
    const dur = b.settings.durationMin * MIN;
    let finished = 0;
    for (const p of b.participants.filter((x) => x.bot)) {
      let prev = -Infinity;
      for (let t = b.startedAt!; t <= b.startedAt! + dur; t += 2_000) {
        const c = seatCursor(b, p, t, battleMarket);
        expect(c).toBeGreaterThanOrEqual(prev);
        expect(c).toBeLessThanOrEqual(end);
        prev = c;
      }
      if (seatCursor(b, p, b.startedAt! + dur, battleMarket) >= end) finished += 1;
      // A pause freezes everyone.
      const pausedAt = b.startedAt! + dur / 3;
      const paused = { ...b, status: 'paused' as const, pausedAt };
      expect(seatCursor(paused, p, pausedAt + 5 * MIN, battleMarket)).toBe(
        seatCursor(b, p, pausedAt, battleMarket),
      );
    }
    expect(finished).toBeGreaterThan(0);
    expect(elapsedMs(clockOf(b), b.startedAt! + dur)).toBe(dur);
  });

  it('forfeit when their replay reaches the planned market time', () => {
    for (let k = 0; k < 30; k++) {
      const { b: base, now } = worldBattle('live', k * 331);
      const b = run({ ...base, participants: [...base.participants, human(base, now)] }, now, now);
      const leaver = b.participants.find(
        (p) => p.bot?.leaveT !== null && p.bot?.leaveT !== undefined,
      );
      if (!leaver) continue;
      const end = b.startedAt! + b.settings.durationMin * MIN;
      const after = run(b, now, end, 5_000);
      const p = after.participants.find((x) => x.userId.equals(leaver.userId))!;
      if (seatCursor(after, p, end, battleMarket) >= leaver.bot!.leaveT!) {
        expect(p.leftT).toBe(leaver.bot!.leaveT);
        expect(after.chat.some((c) => c.text === `${p.name} left`)).toBe(true);
        return;
      }
    }
    throw new Error('no forfeit happened in 30 battles');
  });
});

describe('real users take priority', () => {
  it('a bot gives up its lobby seat (never the host)', () => {
    const { b, now } = worldBattle('standby');
    const full: BattleDoc = {
      ...b,
      settings: { ...b.settings, maxParticipants: b.participants.length },
    };
    const out = evictBotFor(full, now, battleMarket)!;
    expect(out.participants).toHaveLength(b.participants.length - 1);
    expect(out.participants.some((p) => p.userId.equals(b.hostId!))).toBe(true);
  });

  it('a bot forfeits mid-battle to free a seat', () => {
    const { b, now } = worldBattle('live');
    const out = evictBotFor(b, now, battleMarket)!;
    expect(seatsTaken({ participants: out.participants })).toBe(seatsTaken(b) - 1);
    const gone = out.participants.find(
      (p, i) => p.leftT !== null && b.participants[i]!.leftT === null,
    )!;
    expect(gone.bot!.leaveT).toBe(gone.leftT);
  });

  it('a user’s public lobby gets company, a private one never does', () => {
    const settings = (visibility: BattleSettings['visibility']): BattleSettings => ({
      ...DEFAULT_SETTINGS,
      name: 'x',
      visibility,
      maxParticipants: 8,
    });
    const id = new ObjectId();
    const pub = fillMeta({
      battleId: id,
      createdAt: 0,
      settings: settings('public'),
      presence: 1,
      busy: new Set(),
      tilt: 0,
    });
    expect(pub!.events.filter((e) => e.kind === 'join').length).toBeGreaterThan(0);
    expect(pub!.events.some((e) => e.kind === 'start' || e.kind === 'cancel')).toBe(false);
    expect(
      fillMeta({
        battleId: id,
        createdAt: 0,
        settings: settings('private'),
        presence: 1,
        busy: new Set(),
        tilt: 0,
      }),
    ).toBeNull();
    expect(
      fillMeta({
        battleId: id,
        createdAt: 0,
        settings: settings('public'),
        presence: 0,
        busy: new Set(),
        tilt: 0,
      }),
    ).toBeNull();
  });
});
