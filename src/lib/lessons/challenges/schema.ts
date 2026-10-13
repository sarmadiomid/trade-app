import { z } from 'zod';
import type { LessonChallenge } from './types';

const finite = z.number().refine(Number.isFinite, 'must be finite');

const point = z.object({ time: finite, price: finite });
const zone = z.object({ from: finite, to: finite, top: finite, bottom: finite });

export const challengeSchema = z.object({
  id: z.string().min(1),
  at: finite.min(0),
  kind: z.enum(['candles', 'points', 'zones']),
  prompt: z.string(),
  explanation: z.string().default(''),
  label: z.string().default(''),
  rule: z
    .enum([
      'doji',
      'hammer',
      'shooting-star',
      'bullish-engulfing',
      'bearish-engulfing',
      'inside-bar',
      'bullish',
      'bearish',
    ])
    .nullable()
    .default(null),
  region: z.object({ from: finite, to: finite }).nullable().default(null),
  hideFuture: z.boolean().default(false),
  tolerance: z.object({
    bars: finite.min(0),
    price: finite.min(0),
    overlap: finite.min(0).max(1),
  }),
  pass: finite.min(0).max(1),
  answer: z.object({
    candles: z.array(finite),
    points: z.array(point),
    zones: z.array(zone),
  }),
});

export function parseChallenges(raw: unknown): LessonChallenge[] {
  return z.array(challengeSchema).parse(raw) as LessonChallenge[];
}
