'use client';

import type { Standing } from '@/lib/battles';
import { initials } from '../../platform/AppHeader';
import { RankEmblem } from '../RankEmblem';
import { compactMoney, pctClass, signedPct } from '../format';

const STATUS_TAG: Readonly<Record<Standing['status'], string | null>> = {
  active: null,
  target: 'Target hit',
  disqualified: 'Disqualified',
  left: 'Left',
};

/** Live leaderboard rows (sidebar, hold-Tab overlay, lobby). */
export function StandingsList({
  standings,
  meId,
  compact = false,
  showElo = false,
}: {
  readonly standings: readonly Standing[];
  readonly meId: string;
  readonly compact?: boolean;
  readonly showElo?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-1" data-testid="standings">
      {standings.map((s, i) => {
        const me = s.userId === meId;
        const tag = STATUS_TAG[s.status];
        const out = s.status === 'disqualified' || s.status === 'left';
        return (
          <li
            key={s.userId}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
              me ? 'bg-accent/12 ring-1 ring-accent/40' : 'bg-chart/50'
            } ${out ? 'opacity-60' : ''}`}
          >
            <span
              className={`w-5 shrink-0 text-center text-[13px] font-bold tabular-nums ${
                i === 0
                  ? 'text-[#f2c14e]'
                  : i === 1
                    ? 'text-[#c3ccd9]'
                    : i === 2
                      ? 'text-[#c8814f]'
                      : 'text-muted'
              }`}
            >
              {i + 1}
            </span>
            {compact ? null : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hover text-[10.5px] font-bold">
                {initials(s.name)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-medium">{s.name}</span>
                {me ? <span className="text-[10.5px] font-semibold text-accent">YOU</span> : null}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                {showElo ? (
                  <>
                    <RankEmblem elo={s.elo} size={13} />
                    {s.elo} ·{' '}
                  </>
                ) : null}
                {tag ? (
                  <span
                    className={s.status === 'target' ? 'text-up' : 'text-down'}
                    title={s.reason ?? undefined}
                  >
                    {tag}
                  </span>
                ) : (
                  <span>
                    {s.trades} trade{s.trades === 1 ? '' : 's'}
                    {s.openPositions > 0 ? ` · ${s.openPositions} open` : ''}
                  </span>
                )}
              </span>
            </span>
            <span className="text-right">
              <span className={`block text-[13px] font-bold tabular-nums ${pctClass(s.returnPct)}`}>
                {signedPct(s.returnPct)}
              </span>
              <span className="block text-[11px] tabular-nums text-muted">
                {compactMoney(Math.round(s.equity))}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
