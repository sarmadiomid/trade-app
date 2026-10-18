'use client';

import { useId } from 'react';
import { faNum } from '@/lib/locale/jalali';
import { RANKS, rankFor } from '@/lib/battles';
import { RANK_FA } from './format';

/** Shield emblem of a rank tier (Rookie → Master): colour of the tier, chevrons for its level. */
export function RankEmblem({ elo, size = 40 }: { readonly elo: number; readonly size?: number }) {
  const id = useId().replace(/:/g, '');
  const rank = rankFor(elo);
  const level = RANKS.indexOf(rank);
  const chevrons = level === RANKS.length - 1 ? 0 : (level % 3) + 1;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`رتبه ${RANK_FA[rank.id] ?? rank.name}`}
      className="shrink-0"
    >
      <defs>
        <linearGradient id={`rk-f-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={rank.color} stopOpacity="0.95" />
          <stop offset="1" stopColor={rank.color} stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`rk-s-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor={rank.color} />
        </linearGradient>
      </defs>
      <path
        d="M24 3.5l17 7.2v11.6c0 10.6-7.2 18.8-17 21.9C14.2 41.1 7 32.9 7 22.3V10.7z"
        fill={`url(#rk-f-${id})`}
        stroke={`url(#rk-s-${id})`}
        strokeWidth="1.6"
      />
      <path
        d="M24 8.6l12.4 5.3v8.6c0 7.8-5.2 14-12.4 16.5-7.2-2.5-12.4-8.7-12.4-16.5v-8.6z"
        fill="#0b1020"
        fillOpacity="0.35"
      />
      {level === RANKS.length - 1 ? (
        <path
          d="M15.5 27l2-10 4 4.5L24 15l2.5 6.5 4-4.5 2 10z"
          fill="#fff"
          stroke="#fff"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      ) : (
        Array.from({ length: chevrons }, (_, i) => (
          <path
            key={i}
            d={`M16.5 ${18 + i * 5.5}L24 ${23.5 + i * 5.5}l7.5-5.5`}
            fill="none"
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))
      )}
    </svg>
  );
}

/** Emblem, rank name and Elo in one line. */
export function RankLabel({ elo, size = 22 }: { readonly elo: number; readonly size?: number }) {
  const rank = rankFor(elo);
  return (
    <span className="inline-flex items-center gap-1.5">
      <RankEmblem elo={elo} size={size} />
      <span className="text-[12px] font-semibold" style={{ color: rank.color }}>
        {RANK_FA[rank.id] ?? rank.name}
      </span>
      <span className="text-[12px] tabular-nums text-muted">{faNum(elo)}</span>
    </span>
  );
}
