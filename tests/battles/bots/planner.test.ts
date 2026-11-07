import { describe, expect, it } from 'vitest';
import { ExecutionEngine, pnl, resimulate } from '@/lib/backtest';
import { planBot, humanLots, humanStop } from '@/lib/app/battle/bots/planner';
import { STYLES, moodOf, personaOf, type Persona } from '@/lib/app/battle/bots/persona';
import { BOT_POOL_SIZE } from '@/lib/app/battle/bots/identity';
import { Timeline } from '@/lib/app/battle/bots/timeline';
import { seedOf } from '@/lib/app/battle/bots/rng';
import { simBattle, playBot, type SimBattle } from './sim';

const personaWith = (style: Persona['style'], from = 0): Persona => {
  for (let i = from; i < BOT_POOL_SIZE; i++) if (personaOf(i).style === style) return personaOf(i);
  throw new Error(`no ${style}`);
};

const planFor = (b: SimBattle, persona: Persona, seed: number, bars = b.bars) =>
  planBot({
    cfg: b.cfg,
    rules: b.settings,
    history: b.history,
    bars,
    startT: b.marketStart,
    startBid: b.startBid,
    end: b.end,
    persona,
    seed,
  });

describe('bot planner', () => {
  it('is deterministic for a seed and differs across seeds', () => {
    const b = simBattle(11, { durationMin: 15, speed: 30 });
    const p = personaWith('scalper');
    expect(planFor(b, p, 5)).toEqual(planFor(b, p, 5));
    expect(planFor(b, p, 5).actions).not.toEqual(planFor(b, p, 6).actions);
  });

  it('never sees a candle before it closes (no look-ahead)', () => {
    // Planning on a prefix of the market must give exactly the same decisions up to the cut:
    // if any decision used a later candle, the two runs would differ.
    for (let k = 0; k < 24; k++) {
      const b = simBattle(100 + k, { durationMin: 15, speed: 30 });
      const persona = moodOf(personaOf((k * 37) % BOT_POOL_SIZE), k);
      const full = planFor(b, persona, k);
      const cut = Math.floor(b.bars.length * (0.3 + 0.02 * k));
      const cutT = b.bars[cut]!.time;
      const prefix = planFor(b, persona, k, b.bars.slice(0, cut));
      const before = (xs: typeof full.actions) => xs.filter((a) => a.t < cutT);
      expect(before(prefix.actions)).toEqual(before(full.actions));
    }
  });

  it('only logs actions the broker accepts at their market time', () => {
    for (let k = 0; k < 40; k++) {
      const b = simBattle(300 + k);
      const plan = planFor(b, moodOf(personaOf((k * 53) % BOT_POOL_SIZE), k), k);
      // Replay exactly like resimulate, but check every action.
      const eng = new ExecutionEngine(
        b.cfg,
        ExecutionEngine.initialState(b.cfg, b.marketStart, b.startBid),
      );
      let a = 0;
      for (const bar of b.bars) {
        if (bar.time >= Math.min(b.end, plan.leaveT ?? Infinity)) break;
        while (a < plan.actions.length && plan.actions[a]!.t <= bar.time) {
          eng.state.time = Math.max(eng.state.time, plan.actions[a]!.t);
          const res = eng.apply(plan.actions[a]!.a);
          expect(res.ok, JSON.stringify(plan.actions[a])).toBe(true);
          a += 1;
        }
        eng.processBar(bar);
        if (eng.state.status !== 'active') break;
      }
      if (eng.state.status === 'active')
        expect(a).toBe(
          plan.actions.filter((x) => x.t <= Math.min(b.end, plan.leaveT ?? Infinity)).length,
        );
    }
  });

  it('gets its P&L only from real price movement', () => {
    let checked = 0;
    for (let k = 0; k < 30; k++) {
      const b = simBattle(500 + k);
      const plan = planFor(b, moodOf(personaOf((k * 29) % BOT_POOL_SIZE), k), k);
      const eng = resimulate(
        b.cfg,
        ExecutionEngine.initialState(b.cfg, b.marketStart, b.startBid),
        plan.actions,
        b.bars,
        Math.min(b.end, plan.leaveT ?? Infinity),
      );
      const byTime = new Map(b.bars.map((x, i) => [x.time, i]));
      for (const t of eng.state.trades) {
        // Every fill and exit is a price the market actually traded in that minute (Bid ± spread).
        for (const ex of t.exits) {
          const i = byTime.get(ex.time);
          const bar = i !== undefined ? b.bars[i]! : null;
          const prev = b.bars.filter((x) => x.time < ex.time).pop() ?? null;
          const lo = Math.min(bar?.low ?? Infinity, prev?.close ?? Infinity) - 1e-9;
          const hi =
            Math.max(bar?.high ?? -Infinity, prev?.close ?? -Infinity) + b.cfg.spread + 1e-9;
          expect(ex.price).toBeGreaterThanOrEqual(lo);
          expect(ex.price).toBeLessThanOrEqual(hi);
          // And the money is exactly the broker's P&L of that move.
          expect(ex.pnl).toBeCloseTo(pnl(b.cfg, t.side, t.entryPrice, ex.price, ex.volume), 6);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('reproduces the same account as the canonical re-simulation at every cursor', () => {
    for (let k = 0; k < 20; k++) {
      const b = simBattle(700 + k);
      const plan = planFor(b, moodOf(personaOf((k * 71) % BOT_POOL_SIZE), k), k);
      const initial = ExecutionEngine.initialState(b.cfg, b.marketStart, b.startBid);
      const tl = new Timeline(
        b.cfg,
        initial,
        plan.actions,
        b.bars,
        b.end,
        plan.leaveT,
        b.settings.winCondition === 'profit-target',
      );
      const cursors = [b.marketStart, b.end, ...plan.actions.map((a) => a.t)];
      for (let j = 0; j < 25; j++)
        cursors.push(b.bars[(j * 97 + k) % b.bars.length]!.time + (j % 3) * 30_000);
      for (const c of cursors) {
        const stop = Math.min(c, plan.leaveT ?? Infinity, b.end);
        // Exactly the server's simulateParticipant: nothing is applied at the start cursor.
        const eng =
          stop <= b.marketStart
            ? new ExecutionEngine(b.cfg, structuredClone(initial))
            : resimulate(b.cfg, initial, plan.actions, b.bars, stop);
        if (plan.leaveT !== null && plan.leaveT <= c) eng.endSession();
        const s = eng.state;
        const eqv = s.status === 'active' ? eng.equity : s.balance;
        const pt = tl.at(c);
        expect(pt.balance).toBeCloseTo(s.balance, 2);
        expect(pt.equity).toBeCloseTo(eqv, 2);
        expect(pt.trades).toBe(s.trades.length);
        expect(pt.openPositions).toBe(s.positions.length);
        expect(pt.wins).toBe(s.trades.filter((t) => t.netPnl > 0).length);
        expect(pt.status === 'disqualified').toBe(
          s.status === 'failed' || s.status === 'stopped-out',
        );
      }
    }
  });

  it('sizes and places stops like people do', () => {
    const b = simBattle(42, { assets: ['XAUUSD'] });
    expect(humanLots(b.cfg, 1.37, false)).toBe(1.5); // rounded to a number people type
    expect(humanLots(b.cfg, 1.8, false)).toBe(2);
    expect(humanLots(b.cfg, 1.37, true)).toBe(1.37);
    expect(humanLots(b.cfg, 0.004, false)).toBe(0.01);
    expect(humanStop(b.cfg, 4.83, false)).toBeCloseTo(5, 6); // 48 pips → 50 pips on gold
    let round = 0;
    let all = 0;
    const nice = new Set([
      0.01, 0.02, 0.03, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 1, 1.2, 1.5,
      2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250,
      300, 500,
    ]);
    for (let k = 0; k < 60; k++) {
      const p = personaOf(k);
      const plan = planFor(simBattle(900 + k), p, k);
      for (const x of plan.actions)
        if (x.a.type === 'market' || x.a.type === 'pending') {
          all += 1;
          if (!p.riskCalc) expect(nice.has(x.a.volume)).toBe(true);
          if (nice.has(x.a.volume)) round += 1;
        }
    }
    expect(round / all).toBeGreaterThan(0.5);
  });

  it('covers every style and every style trades', () => {
    for (const style of STYLES) {
      const p = personaWith(style);
      let trades = 0;
      for (let k = 0; k < 12; k++)
        trades += playBot(simBattle(1200 + k, { durationMin: 15 }), p, seedOf(k, style)).trades;
      expect(trades, style).toBeGreaterThan(0);
    }
  });
});
