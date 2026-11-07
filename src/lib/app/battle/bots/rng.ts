import { createRng, hashString } from '@/lib/core';

/** Seeded random source with the helpers bot behaviour needs. Deterministic for a seed. */
export interface BotRng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(list: readonly T[]): T;
  /** Index drawn with the given (unnormalised) weights. */
  weighted(weights: readonly number[]): number;
  /** Standard normal. */
  gauss(): number;
  /** Log-normal with the given median and log-space sigma. */
  logNormal(median: number, sigma: number): number;
  /** Exponential with the given mean. */
  exp(mean: number): number;
}

export function botRng(seed: number): BotRng {
  const r = createRng(seed >>> 0);
  const next = r.next;
  let spare: number | null = null;
  const gauss = (): number => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    while (u <= 1e-12) u = next();
    const v = next();
    const m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)]!,
    weighted: (weights) => {
      let total = 0;
      for (const w of weights) total += Math.max(0, w);
      let x = next() * total;
      for (let i = 0; i < weights.length; i++) {
        x -= Math.max(0, weights[i]!);
        if (x < 0) return i;
      }
      return weights.length - 1;
    },
    gauss,
    logNormal: (median, sigma) => median * Math.exp(sigma * gauss()),
    exp: (mean) => -mean * Math.log(1 - next()),
  };
}

/** Mixes several values (numbers or strings) into one 32-bit seed. */
export function seedOf(...parts: ReadonlyArray<number | string>): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    const v = typeof p === 'number' ? (p | 0) ^ Math.floor(p / 4294967296) : hashString(p);
    h = Math.imul(h ^ v, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
