import { describe, expect, it } from 'vitest';
import {
  BOT_ELO_SCALE,
  BOT_NAME,
  BOT_WAIT_MS,
  botRng,
  botSkill,
  planBotTrades,
  scaleBotEloDelta,
} from '@/lib/battles';
import type { Candle } from '@/lib/core';

function bars(n: number, start = 1_700_000_000_000, step = 60_000): Candle[] {
  const out: Candle[] = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    // Gentle wave so SMA crosses fire.
    price += Math.sin(i / 7) * 0.4 + (i % 17 === 0 ? 1.2 : 0) - (i % 19 === 0 ? 1.1 : 0);
    const open = price;
    const close = price + Math.sin(i / 5) * 0.15;
    out.push({
      time: start + i * step,
      open,
      high: Math.max(open, close) + 0.2,
      low: Math.min(open, close) - 0.2,
      close,
      volume: 1,
    });
  }
  return out;
}

describe('ranked practice bot', () => {
  it('exposes wait and soft-elo constants', () => {
    expect(BOT_WAIT_MS).toBe(25_000);
    expect(BOT_ELO_SCALE).toBe(0.5);
    expect(BOT_NAME).toContain('ربات');
    expect(scaleBotEloDelta(17)).toBe(9);
    expect(scaleBotEloDelta(-10)).toBe(-5);
  });

  it('maps Elo into a bounded skill', () => {
    expect(botSkill(700)).toBeCloseTo(0.15);
    expect(botSkill(1000)).toBeCloseTo(0.25);
    expect(botSkill(1900)).toBeLessThanOrEqual(0.92);
  });

  it('is deterministic for a seed', () => {
    const series = bars(120);
    const input = {
      bars: series,
      startT: series[0]!.time,
      endT: series[series.length - 1]!.time,
      pipSize: 0.01,
      lotMin: 0.01,
      seed: 42,
      skill: 0.6,
    };
    const a = planBotTrades(input);
    const b = planBotTrades(input);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((s) => s.a.type === 'market' || s.a.type === 'close')).toBe(true);
  });

  it('trades less noisily at higher skill for the same seed family', () => {
    const series = bars(200);
    const base = {
      bars: series,
      startT: series[0]!.time,
      endT: series[series.length - 1]!.time,
      pipSize: 0.01,
      lotMin: 0.01,
      seed: 7,
    };
    const low = planBotTrades({ ...base, skill: 0.2 });
    const high = planBotTrades({ ...base, skill: 0.9 });
    expect(low.length).toBeGreaterThan(0);
    expect(high.length).toBeGreaterThan(0);
  });

  it('rng is stable', () => {
    const a = botRng(1);
    const b = botRng(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
