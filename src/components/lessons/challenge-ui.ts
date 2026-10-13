import { useEffect, useState } from 'react';
import type { ChallengeBoard } from '@/lib/app';
import type { ChallengeKind, ChallengeResult } from '@/lib/lessons';

export const KIND_LABELS: Record<ChallengeKind, string> = {
  candles: 'Select candles',
  points: 'Mark points',
  zones: 'Draw zones',
};

export const KIND_HINTS: Record<ChallengeKind, string> = {
  candles: 'Click candles to select them, click again to unselect. Drag to pan.',
  points:
    'Click to place a mark (snaps to highs and lows), click a mark to remove it. Drag to pan.',
  zones: 'Drag to draw a zone, click a zone to remove it. Scroll to zoom.',
};

export const NOUNS: Record<ChallengeKind, [string, string]> = {
  candles: ['candle', 'candles'],
  points: ['mark', 'marks'],
  zones: ['zone', 'zones'],
};

export function countLabel(kind: ChallengeKind, n: number): string {
  return `${n} ${NOUNS[kind][n === 1 ? 0 : 1]}`;
}

export function resultSummary(r: ChallengeResult): string {
  const parts = [`${r.hits} of ${r.hits + r.misses} found`];
  if (r.extras > 0) parts.push(`${r.extras} wrong`);
  if (r.misses > 0) parts.push(`${r.misses} missed`);
  return parts.join(' · ');
}

/** Re-renders whenever the board's marks, region, mode or tool change. */
export function useBoardVersion(board: ChallengeBoard | null): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!board) return;
    return board.events.on('changed', () => setVersion((v) => v + 1));
  }, [board]);
  return version;
}
