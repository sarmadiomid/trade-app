import { describe, expect, it } from 'vitest';
import { ObjectId } from 'mongodb';
import { validateBattleSettings } from '@/lib/battles';
import { planLobby, type LobbyPlan } from '@/lib/app/battle/bots/lobby';
import {
  BOT_POOL_SIZE,
  botIndexOf,
  botPool,
  drawIdentities,
  isBotIdHex,
} from '@/lib/app/battle/bots/identity';
import { personaOf } from '@/lib/app/battle/bots/persona';
import { botRng, seedOf } from '@/lib/app/battle/bots/rng';
import {
  activityAt,
  extraBattle,
  openLobbyFloor,
  presetSettings,
  slotChance,
  worldSlot,
  WORLD_SLOT_MS,
} from '@/lib/app/battle/bots/world';
import { botConfigFromEnv, botPresence, DEFAULT_BOT_CONFIG } from '@/lib/app/battle/bots/config';
import { isGreeting } from '@/lib/app/battle/bots/chat';
import { quantile } from './sim';

const MIN = 60_000;
const tehran = (h: number) => Date.UTC(2026, 10, 9, h, 0) - 3.5 * 60 * MIN; // a Monday

const worldLobby = (seed: number, max: number, activity = 0.9): LobbyPlan =>
  planLobby({
    seed,
    createdAt: 0,
    maxParticipants: max,
    hostIndex: seed % BOT_POOL_SIZE,
    seated: 1,
    appeal: 1,
    activity,
    presence: 1,
    allowLateJoin: true,
    durationMs: 15 * MIN,
    exclude: new Set([seed % BOT_POOL_SIZE]),
    tilt: 0,
  });

const seatsAt = (plan: LobbyPlan, t: number) =>
  1 +
  plan.events.filter((e) => e.kind === 'join' && e.at <= t).length -
  plan.events.filter((e) => e.kind === 'leave' && e.at <= t).length;

describe('bot identities', () => {
  it('look like real users and are identifiable only through the registry', () => {
    const pool = botPool();
    expect(pool).toHaveLength(BOT_POOL_SIZE);
    const names = new Set(pool.map((b) => b.name.toLowerCase()));
    expect(names.size).toBe(BOT_POOL_SIZE);
    const NAME_RE = /^[\p{L}\p{N} _.\-]{3,20}$/u;
    for (const b of pool) {
      expect(b.name).toMatch(NAME_RE);
      expect(ObjectId.isValid(b.id)).toBe(true);
      // Registered in 2025–26, like any account.
      const ts = parseInt(b.id.slice(0, 8), 16) * 1000;
      expect(ts).toBeGreaterThan(Date.UTC(2025, 0, 1));
      expect(ts).toBeLessThan(Date.UTC(2027, 0, 1));
      expect(botIndexOf(b.id)).toBe(b.index);
    }
    expect(isBotIdHex(new ObjectId().toHexString())).toBe(false);
    // Many people never rename: about a fifth keep the default "Trader 1234".
    const defaults = pool.filter((b) => /^Trader \d{4}$/.test(b.name)).length / pool.length;
    expect(defaults).toBeGreaterThan(0.12);
    expect(defaults).toBeLessThan(0.32);
    // No old-style "Trader48219" names.
    expect(pool.some((b) => /^Trader\d{5}$/.test(b.name))).toBe(false);
  });

  it('has a few regulars and a long tail', () => {
    const counts = new Map<number, number>();
    for (let k = 0; k < 400; k++)
      for (const id of drawIdentities(seedOf('draw', k), 6))
        counts.set(id.index, (counts.get(id.index) ?? 0) + 1);
    const sorted = [...counts.values()].sort((a, b) => b - a);
    expect(sorted[0]!).toBeGreaterThan(sorted[Math.floor(sorted.length / 2)]! * 4);
    expect(counts.size).toBeGreaterThan(150);
  });

  it('draws a softer field for newcomers and a sharper one for regulars', () => {
    const avg = (tilt: number) => {
      let s = 0;
      let n = 0;
      for (let k = 0; k < 200; k++)
        for (const id of drawIdentities(seedOf('tilt', k), 6, new Set(), tilt)) {
          s += id.skill;
          n += 1;
        }
      return s / n;
    };
    expect(avg(-0.4)).toBeLessThan(avg(0));
    expect(avg(0.45)).toBeGreaterThan(avg(0));
  });

  it('never seats the same trader twice or a busy one', () => {
    const busy = new Set([1, 2, 3, 4, 5]);
    for (let k = 0; k < 100; k++) {
      const ids = drawIdentities(seedOf('busy', k), 12, busy).map((i) => i.index);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.some((i) => busy.has(i))).toBe(false);
    }
  });
});

describe('lobby fill', () => {
  it('fills like a real lobby: bursty joins, most start within minutes, some never do', () => {
    const startDelays: number[] = [];
    const sizes: number[] = [];
    let cancelled = 0;
    for (let k = 0; k < 400; k++) {
      const max = [2, 4, 6, 8, 10, 15, 20][k % 7]!;
      const plan = worldLobby(seedOf('fill', k), max);
      const joins = plan.events.filter((e) => e.kind === 'join').map((e) => e.at);
      for (let j = 1; j < joins.length; j++)
        expect(joins[j]!).toBeGreaterThanOrEqual(joins[j - 1]!);
      if (plan.startAt !== null) {
        startDelays.push(plan.startAt / MIN);
        sizes.push(seatsAt(plan, plan.startAt));
        expect(seatsAt(plan, plan.startAt)).toBeGreaterThanOrEqual(2);
        expect(seatsAt(plan, plan.startAt)).toBeLessThanOrEqual(max);
      } else {
        expect(plan.cancelAt).not.toBeNull();
        cancelled += 1;
      }
      // Never more traders than seats at any moment.
      for (const e of plan.events) expect(seatsAt(plan, e.at)).toBeLessThanOrEqual(max);
    }
    expect(quantile(startDelays, 0.5)).toBeGreaterThan(1);
    expect(quantile(startDelays, 0.5)).toBeLessThan(8);
    expect(quantile(startDelays, 0.9)).toBeLessThan(16);
    // Real lobbies rarely fill to 20, and usually start with a handful.
    expect(quantile(sizes, 0.5)).toBeGreaterThanOrEqual(2);
    expect(quantile(sizes, 0.5)).toBeLessThanOrEqual(6);
    expect(cancelled / 400).toBeGreaterThan(0.01);
    expect(cancelled / 400).toBeLessThan(0.3);
  });

  it('fills slower at night than in the evening', () => {
    const joinsWithin5 = (activity: number) => {
      let n = 0;
      for (let k = 0; k < 200; k++)
        n += worldLobby(seedOf('night', k), 10, activity).events.filter(
          (e) => e.kind === 'join' && e.at <= 5 * MIN,
        ).length;
      return n;
    };
    expect(joinsWithin5(0.15)).toBeLessThan(joinsWithin5(1) * 0.5);
  });

  it('never crowds a real host out: bots leave seats for real users', () => {
    for (let k = 0; k < 300; k++) {
      const max = [4, 5, 6, 8, 10, 20][k % 6]!;
      const plan = planLobby({
        seed: seedOf('human', k),
        createdAt: 0,
        maxParticipants: max,
        hostIndex: null,
        seated: 1,
        appeal: 1,
        activity: 1,
        presence: 1,
        allowLateJoin: true,
        durationMs: 15 * MIN,
        exclude: new Set(),
        tilt: 0,
      });
      expect(plan.startAt).toBeNull(); // the user decides when to start
      expect(plan.cancelAt).toBeNull();
      for (const e of plan.events) expect(seatsAt(plan, e.at)).toBeLessThanOrEqual(max - 1);
    }
  });

  it('brings nobody when presence is zero (phase-out)', () => {
    const plan = planLobby({
      seed: 1,
      createdAt: 0,
      maxParticipants: 10,
      hostIndex: null,
      seated: 1,
      appeal: 1,
      activity: 1,
      presence: 0,
      allowLateJoin: true,
      durationMs: 15 * MIN,
      exclude: new Set(),
      tilt: 0,
    });
    expect(plan.events.filter((e) => e.kind === 'join')).toHaveLength(0);
  });

  it('chats rarely', () => {
    let joins = 0;
    let chats = 0;
    for (let k = 0; k < 200; k++) {
      const plan = worldLobby(seedOf('chat', k), 10);
      joins += plan.events.filter((e) => e.kind === 'join').length;
      chats += plan.events.filter((e) => e.kind === 'chat').length;
    }
    expect(chats / joins).toBeGreaterThan(0.03);
    expect(chats / joins).toBeLessThan(0.45);
  });

  it('answers only plain greetings', () => {
    expect(isGreeting('سلام')).toBe(true);
    expect(isGreeting('سلام به همه')).toBe(true);
    expect(isGreeting('slm')).toBe(true);
    expect(isGreeting('Hi!')).toBe(true);
    expect(isGreeting('سلامتی')).toBe(false);
    expect(isGreeting('چرا طلا ریخت؟')).toBe(false);
    expect(isGreeting('history')).toBe(false);
  });
});

describe('world schedule', () => {
  it('follows Tehran time: busy evenings, quiet before dawn', () => {
    expect(activityAt(tehran(21))).toBeGreaterThan(0.9);
    expect(activityAt(tehran(4))).toBeLessThan(0.2);
    expect(activityAt(tehran(13))).toBeGreaterThan(activityAt(tehran(4)));
    expect(slotChance(activityAt(tehran(21)), 1)).toBeGreaterThan(
      slotChance(activityAt(tehran(4)), 1) * 4,
    );
    expect(slotChance(1, 0)).toBe(0);
  });

  it('keeps a believable number of battles open (steady state)', () => {
    // Expected open battles = arrivals per minute × average visible life.
    const perMinute = (a: number) => slotChance(a, 1) * (MIN / WORLD_SLOT_MS);
    expect(perMinute(1) * 19).toBeGreaterThan(8);
    expect(perMinute(1) * 19).toBeLessThan(16);
    expect(perMinute(0.12) * 19).toBeLessThan(3);
  });

  it('creates battles a real host would, always valid', () => {
    const r = botRng(7);
    const createdAt = Date.UTC(2026, 10, 8);
    const assets = new Map<string, number>();
    const dayCounts = new Map<number, number>();
    let duels = 0;
    for (let k = 0; k < 2000; k++) {
      const { settings } = presetSettings(r, createdAt);
      expect(validateBattleSettings(settings)).toBeNull();
      expect(settings.visibility).toBe('public');
      expect([20, 30]).toContain(settings.durationMin);
      expect(settings.speed).toBe(1440);
      expect(settings.historyStart).not.toBeNull();
      expect(settings.historyEnd).not.toBeNull();
      const days =
        (settings.historyEnd! - settings.historyStart!) / (24 * 60 * 60 * 1000) + 1;
      expect(days).toBe(settings.durationMin);
      expect(settings.historyEnd!).toBeLessThanOrEqual(createdAt);
      expect(settings.historyStart!).toBeGreaterThanOrEqual(
        createdAt - 2 * 365 * 24 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000,
      );
      dayCounts.set(days, (dayCounts.get(days) ?? 0) + 1);
      if (settings.winCondition === 'profit-target') expect(settings.allowLateJoin).toBe(false);
      for (const a of settings.assets) assets.set(a, (assets.get(a) ?? 0) + 1);
      if (settings.maxParticipants === 2) duels += 1;
    }
    // Iranian traders love gold.
    expect(assets.get('XAUUSD')!).toBeGreaterThan(assets.get('EURUSD')! * 2);
    expect(duels / 2000).toBeGreaterThan(0.05);
    expect(dayCounts.get(20)!).toBeGreaterThan(700);
    expect(dayCounts.get(30)!).toBeGreaterThan(700);
  });

  it('keeps a joinable lobby open at normal hours, not before dawn', () => {
    expect(openLobbyFloor(activityAt(tehran(21)), 1)).toBe(2);
    expect(openLobbyFloor(activityAt(tehran(13)), 1)).toBe(1);
    expect(openLobbyFloor(activityAt(tehran(4)), 1)).toBe(0);
    expect(openLobbyFloor(1, 0.2)).toBe(0); // phased out
    const extra = extraBattle(99, 1_800_000_000_000);
    expect(validateBattleSettings(extra.settings)).toBeNull();
    expect(parseInt(extra.id.slice(0, 8), 16)).toBe(1_800_000_000);
  });

  it('is deterministic per slot with ordinary-looking battle ids', () => {
    expect(worldSlot(123_456)).toEqual(worldSlot(123_456));
    const a = worldSlot(123_456);
    expect(ObjectId.isValid(a.id)).toBe(true);
    expect(parseInt(a.id.slice(0, 8), 16)).toBe(Math.floor(a.createdAt / 1000));
    expect(a.createdAt).toBeGreaterThanOrEqual(123_456 * WORLD_SLOT_MS);
    expect(a.createdAt).toBeLessThan(123_457 * WORLD_SLOT_MS);
  });
});

describe('bot config', () => {
  it('reads the environment and phases bots out as real activity grows', () => {
    expect(botConfigFromEnv({})).toEqual(DEFAULT_BOT_CONFIG);
    const c = botConfigFromEnv({
      BATTLE_BOTS_LEVEL: '0.5',
      BATTLE_BOTS_PHASE_OUT: '20',
      BATTLE_BOTS_FILL: 'off',
    });
    expect(c.level).toBe(0.5);
    expect(c.fill).toBe(false);
    expect(botPresence(c, 0)).toBe(0.5);
    expect(botPresence(c, 10)).toBeCloseTo(0.25);
    expect(botPresence(c, 20)).toBe(0);
    expect(botPresence(c, 500)).toBe(0);
    expect(botPresence(botConfigFromEnv({ BATTLE_BOTS: 'off' }), 0)).toBe(0);
    expect(botConfigFromEnv({ BATTLE_BOTS_LEVEL: '7' }).level).toBe(1);
  });

  it('gives every persona sane traits', () => {
    for (let i = 0; i < BOT_POOL_SIZE; i++) {
      const p = personaOf(i);
      expect(p.riskPct).toBeGreaterThan(0);
      expect(p.riskPct).toBeLessThanOrEqual(10);
      expect(p.useSl).toBeGreaterThan(0);
      expect(p.useSl).toBeLessThanOrEqual(1);
      expect(p.cooldown).toBeGreaterThan(0);
      expect(p.stepRate).toBeGreaterThan(0);
    }
  });
});
