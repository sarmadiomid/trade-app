import { describe, expect, it } from 'vitest';
import { simBattle, playField, quantile, type SimResult } from './sim';

/**
 * Large-scale simulation: hundreds of battles with realistic settings, each with a full field of
 * bots trading the real seeded market on the real broker. The outcomes are not scripted, so
 * these bands check that behaviour produces a believable spread of results.
 */
interface Field {
  readonly winCondition: 'time-trial' | 'profit-target';
  readonly results: readonly SimResult[];
}

const fields: Field[] = [];
for (let i = 0; i < 140; i++) {
  const b = simBattle(10_000 + i * 13);
  fields.push({
    winCondition: b.settings.winCondition,
    results: playField(b, Math.min(b.settings.maxParticipants, 8), 50_000 + i),
  });
}
const all = fields.flatMap((f) => f.results);
const rets = all.map((r) => r.returnPct);
const share = (pred: (r: SimResult) => boolean) => all.filter(pred).length / all.length;

describe('outcome distribution of a bot field', () => {
  it('has enough samples', () => {
    expect(all.length).toBeGreaterThan(700);
  });

  it('centres near break-even with fat, slightly negative tails (costs and blow-ups)', () => {
    const p10 = quantile(rets, 0.1);
    const p50 = quantile(rets, 0.5);
    const p90 = quantile(rets, 0.9);
    expect(p50).toBeGreaterThan(-0.8);
    expect(p50).toBeLessThan(0.4);
    expect(p10).toBeLessThan(-1.2);
    expect(p10).toBeGreaterThan(-6.5);
    expect(p90).toBeGreaterThan(0.8);
    expect(p90).toBeLessThan(5.5);
    // Nobody sits at exactly 0.00% all battle (the old bots' tell).
    expect(share((r) => Math.abs(r.returnPct) < 0.01)).toBeLessThan(0.15);
  });

  it('has a realistic mix of activity, disqualifications and forfeits', () => {
    const trades = all.map((r) => r.trades);
    expect(quantile(trades, 0.5)).toBeGreaterThanOrEqual(2);
    expect(quantile(trades, 0.5)).toBeLessThanOrEqual(8);
    expect(quantile(trades, 0.9)).toBeGreaterThanOrEqual(6);
    expect(share((r) => r.trades === 0)).toBeGreaterThan(0.01);
    expect(share((r) => r.trades === 0)).toBeLessThan(0.14);
    expect(share((r) => r.status === 'disqualified')).toBeGreaterThan(0.015);
    expect(share((r) => r.status === 'disqualified')).toBeLessThan(0.14);
    expect(share((r) => r.status === 'left')).toBeGreaterThan(0.005);
    expect(share((r) => r.status === 'left')).toBeLessThan(0.1);
    const won = all.reduce((n, r) => n + r.wins, 0);
    const total = all.reduce((n, r) => n + r.trades, 0);
    expect(won / total).toBeGreaterThan(0.33);
    expect(won / total).toBeLessThan(0.58);
  });

  it('produces winners a human can beat, but not trivially', () => {
    const winners = fields
      .filter((f) => f.winCondition === 'time-trial')
      .map((f) => Math.max(...f.results.map((r) => r.returnPct)));
    expect(quantile(winners, 0.5)).toBeGreaterThan(0.6);
    expect(quantile(winners, 0.5)).toBeLessThan(5);
    // Spread within a battle: a real field is not bunched up.
    const spreads = fields.map((f) => {
      const r = f.results.map((x) => x.returnPct);
      return Math.max(...r) - Math.min(...r);
    });
    expect(quantile(spreads, 0.5)).toBeGreaterThan(1.5);
  });

  it('reaches profit targets in some battles, not all', () => {
    const pt = fields.filter((f) => f.winCondition === 'profit-target');
    expect(pt.length).toBeGreaterThan(15);
    const hit = pt.filter((f) => f.results.some((r) => r.status === 'target')).length / pt.length;
    expect(hit).toBeGreaterThan(0.25);
    expect(hit).toBeLessThan(0.9);
  });

  it('lets skill show: careful traders blow up less and swing less', () => {
    const skilled = all.filter((r) => r.persona.skill > 0.6);
    const novice = all.filter((r) => r.persona.skill < 0.25);
    expect(skilled.length).toBeGreaterThan(40);
    expect(novice.length).toBeGreaterThan(40);
    const dq = (xs: SimResult[]) =>
      xs.filter((r) => r.status === 'disqualified').length / xs.length;
    expect(dq(skilled)).toBeLessThan(dq(novice));
    const spread = (xs: SimResult[]) =>
      quantile(
        xs.map((r) => r.returnPct),
        0.9,
      ) -
      quantile(
        xs.map((r) => r.returnPct),
        0.1,
      );
    expect(spread(skilled)).toBeLessThan(spread(novice));
  });

  it('keeps styles distinct (scalpers trade far more than swing traders)', () => {
    const median = (style: string) =>
      quantile(
        all.filter((r) => r.persona.style === style).map((r) => r.trades),
        0.5,
      );
    expect(median('scalper')).toBeGreaterThan(median('swing'));
    expect(median('scalper')).toBeGreaterThan(median('idle'));
  });
});
