'use client';

import { useMemo } from 'react';
import { faNum } from '@/lib/locale/jalali';
import type { Standing } from '@/lib/battles';
import { initials } from '../../platform/AppHeader';
import { RankEmblem } from '../RankEmblem';
import { compactMoney, pctClass, signedPct } from '../format';

const STATUS_TAG: Readonly<Record<Standing['status'], string | null>> = {
  active: null,
  target: 'به هدف رسید',
  disqualified: 'حذف',
  left: 'خارج شد',
};

const PLACE_TONE = [
  'bg-[#f2c14e]/15 text-[#f2c14e] ring-[#f2c14e]/45',
  'bg-[#c3ccd9]/12 text-[#d5dde8] ring-[#c3ccd9]/40',
  'bg-[#c8814f]/15 text-[#e09a68] ring-[#c8814f]/45',
] as const;

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
  const spread = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of standings) {
      if (s.returnPct < min) min = s.returnPct;
      if (s.returnPct > max) max = s.returnPct;
    }
    return { min: Number.isFinite(min) ? min : 0, span: max - min };
  }, [standings]);

  if (standings.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-[12.5px] text-fg/75" data-testid="standings">
        هنوز کسی در جدول نیست.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-1.5" data-testid="standings">
      {standings.map((s, i) => {
        const me = s.userId === meId;
        const tag = STATUS_TAG[s.status];
        const width =
          spread.span < 0.01 ? 100 : Math.max(6, ((s.returnPct - spread.min) / spread.span) * 100);
        return (
          <li
            key={s.userId}
            aria-current={me ? 'true' : undefined}
            className={`rounded-xl px-2 py-2 ring-1 ring-inset transition-colors duration-150 ${
              me ? 'bg-accent/12 ring-accent/40' : 'bg-chart/55 ring-line/80 hover:bg-hover/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] font-bold tabular-nums ring-1 ring-inset ${
                  PLACE_TONE[i] ?? 'bg-panel text-fg/70 ring-line'
                }`}
              >
                {faNum(i + 1)}
              </span>
              {compact ? null : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hover text-[11px] font-bold text-fg">
                  {initials(s.name)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold" title={s.name}>
                    {s.name}
                  </span>
                  {me ? (
                    <span className="shrink-0 rounded bg-accent/15 px-1 py-0.5 text-[10px] font-semibold text-accent">
                      تو
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg/75">
                  {showElo ? (
                    <>
                      <RankEmblem elo={s.elo} size={13} />
                      <span className="tabular-nums">{faNum(s.elo)}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  ) : null}
                  {tag ? (
                    <span
                      className={
                        s.status === 'target' ? 'font-medium text-up' : 'font-medium text-down'
                      }
                      title={s.reason ?? undefined}
                    >
                      {tag}
                    </span>
                  ) : (
                    <span>
                      {s.trades === 1 ? 'یک معامله' : `${faNum(s.trades)} معامله`}
                      {s.openPositions > 0 ? ` · ${faNum(s.openPositions)} باز` : ''}
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-end">
                <span
                  className={`block text-[13px] font-bold tabular-nums ${pctClass(s.returnPct)}`}
                >
                  {signedPct(s.returnPct)}
                </span>
                <span className="mt-0.5 block text-[11px] tabular-nums text-fg/70">
                  {compactMoney(Math.round(s.equity))}
                </span>
              </span>
            </div>
            {compact ? null : (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-line/80" aria-hidden="true">
                <div
                  className={`h-full rounded-full ${
                    spread.span < 0.01 ? 'bg-fg/25' : s.returnPct >= 0 ? 'bg-up' : 'bg-down'
                  }`}
                  style={{ width: `${width}%` }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
