/**
 * Interactive checkpoints inside a lesson: at `at` the player pauses and the student answers on
 * the chart (select candles, mark points, draw zones). Everything is in chart coordinates (bar
 * time, price), so answers and grading do not depend on zoom or screen size.
 */
export type ChallengeKind = 'candles' | 'points' | 'zones';

export type CandleRuleId =
  | 'doji'
  | 'hammer'
  | 'shooting-star'
  | 'bullish-engulfing'
  | 'bearish-engulfing'
  | 'inside-bar'
  | 'bullish'
  | 'bearish';

/** Inclusive range of bar times. */
export interface TimeRange {
  readonly from: number;
  readonly to: number;
}

export interface ChartPoint {
  /** Bar time. */
  readonly time: number;
  readonly price: number;
}

/** Rectangle over whole bars: `from`/`to` are inclusive bar times, `top` >= `bottom`. */
export interface ChartZone {
  readonly from: number;
  readonly to: number;
  readonly top: number;
  readonly bottom: number;
}

/** What someone put on the chart. Only the list matching the challenge kind is used. */
export interface ChallengeMarks {
  /** Bar times. */
  readonly candles: readonly number[];
  readonly points: readonly ChartPoint[];
  readonly zones: readonly ChartZone[];
}

export interface ChallengeTolerance {
  /** Points: a mark counts within this many bars of the answer. */
  readonly bars: number;
  /** Points: price distance allowed, as a fraction of the region's high–low range. */
  readonly price: number;
  /** Zones: minimum overlap (intersection over union, 0..1). */
  readonly overlap: number;
}

export interface LessonChallenge {
  readonly id: string;
  /** Lesson time (ms) at which playback stops for this challenge. */
  readonly at: number;
  readonly kind: ChallengeKind;
  readonly prompt: string;
  /** Shown after validating (why the answer is what it is). */
  readonly explanation: string;
  /** Text drawn next to point marks, e.g. "BOS". */
  readonly label: string;
  /** Candles: the rule the answer was generated from, if any (informational). */
  readonly rule: CandleRuleId | null;
  /** Only bars inside count; the rest of the chart is dimmed. Null: the whole chart. */
  readonly region: TimeRange | null;
  /** Hide bars after the region while answering (no peeking at what happened next). */
  readonly hideFuture: boolean;
  readonly tolerance: ChallengeTolerance;
  /** Score (0..1) needed to pass. */
  readonly pass: number;
  readonly answer: ChallengeMarks;
}

export type MarkStatus = 'hit' | 'miss' | 'extra';

export interface Graded<T> {
  readonly status: MarkStatus;
  readonly value: T;
}

export interface ChallengeResult {
  /** hits / (answers + extras), 1 when there is nothing to find and nothing was marked. */
  readonly score: number;
  readonly passed: boolean;
  readonly hits: number;
  readonly misses: number;
  readonly extras: number;
  /** Student marks as hit/extra plus missed answers, for feedback on the chart. */
  readonly candles: readonly Graded<number>[];
  readonly points: readonly Graded<ChartPoint>[];
  readonly zones: readonly Graded<ChartZone>[];
}

export const EMPTY_MARKS: ChallengeMarks = { candles: [], points: [], zones: [] };

export const DEFAULT_TOLERANCE: ChallengeTolerance = { bars: 1, price: 0.03, overlap: 0.5 };
