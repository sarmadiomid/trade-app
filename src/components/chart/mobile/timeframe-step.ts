import { TIMEFRAME_IDS, type TimeframeId } from '@/lib/core';

/** Vertical distance that advances one interval while dragging the timeframe control. */
export const TIMEFRAME_DRAG_PX = 28;

/**
 * How many intervals a vertical drag has crossed.
 * Dragging up (negative dy) moves to a higher timeframe.
 */
export function stepsFromDrag(dy: number, px = TIMEFRAME_DRAG_PX): number {
  if (px <= 0 || Math.abs(dy) < px) return 0;
  return -Math.trunc(dy / px);
}

/** The timeframe `steps` away from `current`. Stays inside the supported list. */
export function timeframeBySteps(current: TimeframeId, steps: number): TimeframeId {
  const index = TIMEFRAME_IDS.indexOf(current);
  const base = index < 0 ? 0 : index;
  const next = Math.max(0, Math.min(TIMEFRAME_IDS.length - 1, base + steps));
  return TIMEFRAME_IDS[next]!;
}

/** Neighbours shown beside the active interval. Missing at either end of the list. */
export function timeframeWindow(
  current: TimeframeId,
): readonly [TimeframeId | null, TimeframeId, TimeframeId | null] {
  const index = TIMEFRAME_IDS.indexOf(current);
  const i = index < 0 ? 0 : index;
  const id = TIMEFRAME_IDS[i] ?? current;
  return [
    i > 0 ? TIMEFRAME_IDS[i - 1]! : null,
    id,
    i < TIMEFRAME_IDS.length - 1 ? TIMEFRAME_IDS[i + 1]! : null,
  ];
}
