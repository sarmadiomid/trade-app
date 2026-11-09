import { describe, expect, it } from 'vitest';
import { ObjectId } from 'mongodb';
import { worldSlot } from '@/lib/app/battle/bots/world';
import { botLobbyDue, materializeWorld, pumpBattle } from '@/server/battles/bot-room';
import { battleMarket } from '@/server/battles/market';
import { battleNeedsRefresh, battleView } from '@/server/battles/views';
import type { BattleDoc } from '@/server/db';

const ctx = { market: battleMarket, busy: new Set<number>(), presence: 1 };

function find(status: BattleDoc['status']): { b: BattleDoc; now: number } {
  for (let slot = 61_000_000; slot < 61_004_000; slot++) {
    const spec = worldSlot(slot);
    for (let dt = 60_000; dt < 30 * 60_000; dt += 30_000) {
      const now = spec.createdAt + dt;
      const b = materializeWorld(spec, now, ctx);
      if (b && b.status === status && b.participants.length >= 3) return { b, now };
    }
  }
  throw new Error(`no ${status} battle`);
}

describe('what an outsider sees of a public battle', () => {
  it('shows every trader in a lobby before joining (bots included)', () => {
    const { b, now } = find('standby');
    const v = battleView(b, new ObjectId(), now);
    expect(v.standings.map((s) => s.name)).toEqual(b.participants.map((p) => p.name));
    expect(v.host?.name).toBe(b.participants[0]!.name);
    expect(v.joinBlocked).toBeNull();
    expect(JSON.stringify(v)).not.toMatch(/"isBot"|"bots"|"planned"/);
  });

  it('shows who is playing a running battle, but not their results', () => {
    const { b, now } = find('live');
    const v = battleView(b, new ObjectId(), now);
    expect(v.standings.length).toBe(b.participants.filter((p) => p.leftT === null).length);
    for (const s of v.standings) {
      expect(s.returnPct).toBe(0);
      expect(s.trades).toBe(0);
      expect(s.equity).toBe(b.settings.startingBalance);
    }
  });

  it('keeps a private battle hidden until you are in it', () => {
    const { b, now } = find('standby');
    const v = battleView(
      { ...b, settings: { ...b.settings, visibility: 'private' } },
      new ObjectId(),
      now,
    );
    expect(v.standings).toHaveLength(0);
    expect(v.host).toBeNull();
    expect(v.code).toBe('');
  });
});

describe('hub refresh of bot lobbies', () => {
  it('marks standby stale when bot start/cancel is due, and pump advances it', () => {
    const { b, now } = find('standby');
    // Fresh materialization has only future events — not due yet.
    expect(botLobbyDue(b, now)).toBe(false);
    expect(battleNeedsRefresh(b, now)).toBe(false);

    const dueAt = now - 1_000;
    const withDue: BattleDoc = {
      ...b,
      bots: {
        ...b.bots!,
        events: [{ kind: 'cancel', at: dueAt }],
        startAt: null,
      },
    };
    expect(botLobbyDue(withDue, now)).toBe(true);
    expect(battleNeedsRefresh(withDue, now)).toBe(true);

    const u = pumpBattle(withDue, now, { market: battleMarket, busy: new Set() });
    expect(u).not.toBeNull();
    expect((u!.$set as { status?: string }).status).toBe('cancelled');
  });

  it('marks standby stale when startAt is due', () => {
    const { b, now } = find('standby');
    const withStart: BattleDoc = {
      ...b,
      bots: { ...b.bots!, events: [], startAt: now - 500 },
    };
    expect(botLobbyDue(withStart, now)).toBe(true);
    expect(battleNeedsRefresh(withStart, now)).toBe(true);
  });
});
