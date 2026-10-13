import { lastLessOrEqual, type SeriesData } from '@/lib/core';
import { regionIndices } from './patterns';
import type {
  ChallengeMarks,
  ChallengeResult,
  ChartPoint,
  ChartZone,
  Graded,
  LessonChallenge,
  TimeRange,
} from './types';

/** Bar index of a bar time (the bar at or before it; 0 before the data). */
function indexOf(d: SeriesData, time: number): number {
  return Math.max(0, lastLessOrEqual(d.time, d.length, time));
}

/** High–low span of the bars in `region` (never 0). */
export function regionPriceSpan(d: SeriesData, region: TimeRange | null): number {
  const [from, to] = regionIndices(d, region);
  let hi = -Infinity;
  let lo = Infinity;
  for (let i = Math.max(0, from); i <= to; i++) {
    hi = Math.max(hi, d.high[i]!);
    lo = Math.min(lo, d.low[i]!);
  }
  const span = hi - lo;
  return Number.isFinite(span) && span > 0 ? span : 1;
}

/**
 * Pairs answers with marks greedily, best pair first. `cost` returns null when the two do not
 * match at all. Returns, per answer, the index of its mark (or -1), and the unmatched marks.
 */
function matchGreedy<A, M>(
  answers: readonly A[],
  marks: readonly M[],
  cost: (a: A, m: M) => number | null,
): { answerToMark: number[]; markMatched: boolean[] } {
  const pairs: Array<{ a: number; m: number; c: number }> = [];
  answers.forEach((a, ai) =>
    marks.forEach((m, mi) => {
      const c = cost(a, m);
      if (c !== null) pairs.push({ a: ai, m: mi, c });
    }),
  );
  pairs.sort((x, y) => x.c - y.c || x.a - y.a || x.m - y.m);
  const answerToMark = answers.map(() => -1);
  const markMatched = marks.map(() => false);
  for (const p of pairs) {
    if (answerToMark[p.a] !== -1 || markMatched[p.m]) continue;
    answerToMark[p.a] = p.m;
    markMatched[p.m] = true;
  }
  return { answerToMark, markMatched };
}

function finish(
  ch: LessonChallenge,
  hits: number,
  misses: number,
  extras: number,
  graded: Pick<ChallengeResult, 'candles' | 'points' | 'zones'>,
): ChallengeResult {
  const denom = hits + misses + extras;
  const score = denom === 0 ? 1 : hits / denom;
  return { score, passed: score >= ch.pass - 1e-9, hits, misses, extras, ...graded };
}

function gradeCandles(ch: LessonChallenge, marks: ChallengeMarks): ChallengeResult {
  const answer = new Set(ch.answer.candles);
  const picked = new Set(marks.candles);
  const candles: Graded<number>[] = [];
  let hits = 0;
  let extras = 0;
  for (const t of picked) {
    if (answer.has(t)) hits++;
    else extras++;
    candles.push({ status: answer.has(t) ? 'hit' : 'extra', value: t });
  }
  let misses = 0;
  for (const t of answer) {
    if (picked.has(t)) continue;
    misses++;
    candles.push({ status: 'miss', value: t });
  }
  return finish(ch, hits, misses, extras, { candles, points: [], zones: [] });
}

function gradePoints(ch: LessonChallenge, marks: ChallengeMarks, d: SeriesData): ChallengeResult {
  const priceTol = Math.max(1e-12, ch.tolerance.price * regionPriceSpan(d, ch.region));
  const barTol = Math.max(0, Math.round(ch.tolerance.bars));
  const { answerToMark, markMatched } = matchGreedy<ChartPoint, ChartPoint>(
    ch.answer.points,
    marks.points,
    (a, m) => {
      const db = Math.abs(indexOf(d, a.time) - indexOf(d, m.time));
      const dp = Math.abs(a.price - m.price);
      if (db > barTol || dp > priceTol) return null;
      return db / (barTol + 1) + dp / priceTol;
    },
  );
  const points: Graded<ChartPoint>[] = marks.points.map((p, i) => ({
    status: markMatched[i] ? 'hit' : 'extra',
    value: p,
  }));
  ch.answer.points.forEach((p, i) => {
    if (answerToMark[i] === -1) points.push({ status: 'miss', value: p });
  });
  const hits = markMatched.filter(Boolean).length;
  return finish(ch, hits, ch.answer.points.length - hits, marks.points.length - hits, {
    candles: [],
    points,
    zones: [],
  });
}

/** Intersection over union in (bar index, price) space. */
export function zoneOverlap(d: SeriesData, a: ChartZone, b: ChartZone): number {
  const a0 = indexOf(d, a.from);
  const a1 = indexOf(d, a.to) + 1;
  const b0 = indexOf(d, b.from);
  const b1 = indexOf(d, b.to) + 1;
  const iw = Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  const ih = Math.max(0, Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom));
  const inter = iw * ih;
  const union = (a1 - a0) * (a.top - a.bottom) + (b1 - b0) * (b.top - b.bottom) - inter;
  return union > 0 ? inter / union : 0;
}

function gradeZones(ch: LessonChallenge, marks: ChallengeMarks, d: SeriesData): ChallengeResult {
  const min = Math.max(0.01, ch.tolerance.overlap);
  const { answerToMark, markMatched } = matchGreedy<ChartZone, ChartZone>(
    ch.answer.zones,
    marks.zones,
    (a, m) => {
      const iou = zoneOverlap(d, a, m);
      return iou >= min ? 1 - iou : null;
    },
  );
  const zones: Graded<ChartZone>[] = marks.zones.map((z, i) => ({
    status: markMatched[i] ? 'hit' : 'extra',
    value: z,
  }));
  ch.answer.zones.forEach((z, i) => {
    if (answerToMark[i] === -1) zones.push({ status: 'miss', value: z });
  });
  const hits = markMatched.filter(Boolean).length;
  return finish(ch, hits, ch.answer.zones.length - hits, marks.zones.length - hits, {
    candles: [],
    points: [],
    zones,
  });
}

/** Grades what the student marked against the challenge's answer key. */
export function gradeChallenge(
  ch: LessonChallenge,
  marks: ChallengeMarks,
  data: SeriesData,
): ChallengeResult {
  switch (ch.kind) {
    case 'candles':
      return gradeCandles(ch, marks);
    case 'points':
      return gradePoints(ch, marks, data);
    case 'zones':
      return gradeZones(ch, marks, data);
  }
}

/** Number of answer marks for the challenge's kind. */
export function answerCount(ch: Pick<LessonChallenge, 'kind' | 'answer'>): number {
  return marksCount(ch.kind, ch.answer);
}

export function marksCount(kind: LessonChallenge['kind'], marks: ChallengeMarks): number {
  return kind === 'candles'
    ? marks.candles.length
    : kind === 'points'
      ? marks.points.length
      : marks.zones.length;
}
