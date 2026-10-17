'use client';

import { WIN_CONDITIONS, type BattleView } from '@/lib/battles';
import { ASSET_COLORS, compactMoney } from '../format';

/** Every rule of a battle, as shown before joining and in the battle's sidebar. */
export function RulesList({ view }: { readonly view: BattleView }) {
  const s = view.settings;
  const rows: Array<[string, React.ReactNode]> = [
    ['Mode', view.mode === 'ranked' ? 'Ranked (affects Elo)' : 'Casual (no Elo)'],
    ['Battle type', WIN_CONDITIONS[s.winCondition].name],
    ['Win condition', WIN_CONDITIONS[s.winCondition].short],
    [
      'Market',
      view.symbol ? (
        <span className="font-semibold">{view.symbol}</span>
      ) : (
        <span className="flex flex-wrap justify-end gap-1">
          {s.assets.map((a) => (
            <span
              key={a}
              className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
              style={{
                background: `${ASSET_COLORS[a] ?? '#5b8cff'}22`,
                color: ASSET_COLORS[a] ?? '#5b8cff',
              }}
            >
              {a}
            </span>
          ))}
        </span>
      ),
    ],
    ['Starting balance', compactMoney(s.startingBalance)],
    ['Duration', `${s.durationMin} min`],
    ['Replay speed', `${s.speed}× (one 1m candle every ${60 / s.speed}s)`],
    ['Profit target', s.profitTargetPct === null ? 'Not set' : `${s.profitTargetPct}%`],
    ['Max drawdown', s.maxDrawdownPct === null ? 'Not set' : `${s.maxDrawdownPct}%`],
    [
      'Max daily drawdown',
      s.maxDailyDrawdownPct === null ? 'Not set' : `${s.maxDailyDrawdownPct}%`,
    ],
    ['Traders', `${view.standings.length} / ${s.maxParticipants}`],
    ['Late entries', s.allowLateJoin ? 'Allowed' : 'Not allowed'],
    ['Visibility', s.visibility === 'public' ? 'Public' : 'Private (battle ID)'],
  ];
  return (
    <dl className="divide-y divide-line text-[12.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-3 py-2">
          <dt className="shrink-0 text-muted">{k}</dt>
          <dd className="text-right">{v}</dd>
        </div>
      ))}
      {!view.symbol ? (
        <p className="py-2 text-[11.5px] text-muted">
          The market is drawn from the pool and revealed when the countdown starts. Breaking a
          drawdown rule disqualifies you.
        </p>
      ) : null}
    </dl>
  );
}
