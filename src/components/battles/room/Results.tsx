'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { faNum } from '@/lib/locale/jalali';
import { rankFor, type BattleView, type FinalResult } from '@/lib/battles';
import { api } from '../../platform/api';
import { initials } from '../../platform/AppHeader';
import { Icon } from '../../ui/Icon';
import { RankEmblem } from '../RankEmblem';
import {
  battleTitle,
  compactMoney,
  faEndReason,
  faMessage,
  faReason,
  ordinal,
  pctClass,
  rankLabel,
  signed,
  signedPct,
} from '../format';

const STATUS_LABEL: Readonly<Record<FinalResult['status'], string>> = {
  active: 'تمام شد',
  target: 'به هدف رسید',
  disqualified: 'حذف',
  left: 'خارج شد',
};

const PODIUM = [
  { place: 2, height: 'h-24', color: '#c3ccd9' },
  { place: 1, height: 'h-32', color: '#f2c14e' },
  { place: 3, height: 'h-16', color: '#c8814f' },
];

/**
 * Results screen: the podium, the viewer's result (place, return, Elo change, XP) and the full
 * final standings. Shown as a page, or over the chart when a battle ends while trading.
 */
export function Results({
  view,
  meId,
  onClose,
}: {
  readonly view: BattleView;
  readonly meId: string;
  readonly onClose?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const results = view.results ?? [];
  const mine = results.find((r) => r.userId === meId) ?? null;
  const winner = results[0] ?? null;
  const ranked = view.mode === 'ranked';
  const recorded = results.some((r) => r.xp > 0);
  const byPlace = new Map<number, FinalResult>();
  results.forEach((r, i) => {
    if (i < 3 && !byPlace.has(i + 1)) byPlace.set(i + 1, r);
  });

  const rematch = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>('/api/battles', {
        method: 'POST',
        body: { settings: view.settings },
      });
      router.push(`/battle/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? faMessage(e.message) : faMessage('Could not create the battle'));
      setBusy(false);
    }
  };

  const promoted =
    mine && mine.eloBefore !== null && mine.eloAfter !== null
      ? rankFor(mine.eloAfter).min !== rankFor(mine.eloBefore).min
        ? mine.eloAfter > mine.eloBefore
          ? 'up'
          : 'down'
        : null
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6" data-testid="battle-results">
      <div className="text-center">
        <p className="text-[12px] font-semibold text-accent">نبرد تمام شد</p>
        <h1 className="mt-2 text-[26px] font-bold sm:text-[32px]">{battleTitle(view.settings.name)}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {view.endReason ? faEndReason(view.endReason) : 'نتیجه نهایی'} ·{' '}
          <bdi dir="ltr">{view.symbol}</bdi>
        </p>
      </div>

      <div className="mx-auto mt-8 grid max-w-xl grid-cols-3 items-end gap-3">
        {PODIUM.map((p) => {
          const r = byPlace.get(p.place);
          return (
            <div key={p.place} className="flex flex-col items-center">
              {r ? (
                <>
                  {p.place === 1 ? (
                    <span className="mb-1 text-[#f2c14e]">
                      <Icon name="crown" size={22} />
                    </span>
                  ) : null}
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-bold sm:h-14 sm:w-14"
                    style={{
                      background: `${p.color}26`,
                      color: p.color,
                      boxShadow: `0 0 0 2px ${p.color}66`,
                    }}
                  >
                    {initials(r.name)}
                  </span>
                  <span className="mt-2 max-w-full truncate text-[13px] font-semibold">{r.name}</span>
                  <span className={`text-[13px] font-bold tabular-nums ${pctClass(r.returnPct)}`}>
                    {signedPct(r.returnPct)}
                  </span>
                </>
              ) : (
                <span className="text-[12px] text-muted">—</span>
              )}
              <div
                className={`mt-2 flex w-full items-start justify-center rounded-t-xl ${p.height}`}
                style={{ background: `linear-gradient(180deg, ${p.color}40, ${p.color}10)` }}
              >
                <span className="mt-2 text-[20px] font-black" style={{ color: p.color }}>
                  {faNum(p.place)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {mine ? (
        <section
          className="mt-8 grid gap-3 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-4"
          data-testid="my-result"
        >
          <div>
            <div className="text-[11.5px] text-muted">جایگاه تو</div>
            <div className="mt-1 text-[26px] font-black">
              {ordinal(mine.place)}
              <span className="ms-1 text-[14px] font-medium text-muted">از {faNum(results.length)}</span>
            </div>
            <div
              className={`text-[12px] ${mine.status === 'disqualified' ? 'text-down' : 'text-muted'}`}
            >
              {mine.reason ? faReason(mine.reason) : STATUS_LABEL[mine.status]}
            </div>
          </div>
          <div>
            <div className="text-[11.5px] text-muted">بازده</div>
            <div className={`mt-1 text-[26px] font-black tabular-nums ${pctClass(mine.returnPct)}`}>
              {signedPct(mine.returnPct)}
            </div>
            <div className="text-[12px] text-muted">
              {compactMoney(Math.round(mine.balance))} · {faNum(mine.trades)} معامله · {faNum(mine.wins)}{' '}
              برد
            </div>
          </div>
          <div>
            <div className="text-[11.5px] text-muted">{ranked ? 'الو' : 'الو (آزاد)'}</div>
            {ranked && mine.eloBefore !== null && mine.eloAfter !== null ? (
              <>
                <div className="mt-1 flex items-center gap-2">
                  <RankEmblem elo={mine.eloAfter} size={30} />
                  <span className="text-[26px] font-black tabular-nums">{faNum(mine.eloAfter)}</span>
                  <span
                    className={`text-[14px] font-bold tabular-nums ${mine.eloAfter >= mine.eloBefore ? 'text-up' : 'text-down'}`}
                    data-testid="elo-change"
                  >
                    {signed(mine.eloAfter - mine.eloBefore)}
                  </span>
                </div>
                <div className="text-[12px] text-muted">
                  {promoted === 'up'
                    ? `ارتقا به ${rankLabel(mine.eloAfter)}`
                    : promoted === 'down'
                      ? `سقوط به ${rankLabel(mine.eloAfter)}`
                      : `${rankLabel(mine.eloAfter)} · قبلاً ${faNum(mine.eloBefore)}`}
                </div>
              </>
            ) : (
              <>
                <div className="mt-1 text-[26px] font-black text-muted">—</div>
                <div className="text-[12px] text-muted">
                  {ranked ? 'در حال ثبت…' : 'نبرد سفارشی الو را عوض نمی‌کند'}
                </div>
              </>
            )}
          </div>
          <div>
            <div className="text-[11.5px] text-muted">امتیاز ترکیبی</div>
            <div className="mt-1 text-[26px] font-black tabular-nums text-accent">
              {recorded ? `+${faNum(mine.xp)}` : '…'}
              <span className="ms-1 text-[14px] font-medium text-muted">امتیاز</span>
            </div>
            <div className="text-[12px] text-muted">برای حضور، رتبه و معاملات سودده</div>
          </div>
        </section>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-panel">
        <h2 className="border-b border-line px-5 py-3 text-[14px] font-semibold">
          رتبه‌بندی نهایی{winner ? ` · ${winner.name} برنده شد` : ''}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-start text-[11.5px] text-muted">
                <th className="px-5 py-2 font-medium">رتبه</th>
                <th className="px-3 py-2 font-medium">معامله‌گر</th>
                <th className="px-3 py-2 font-medium">نتیجه</th>
                <th className="px-3 py-2 text-end font-medium">بازده</th>
                <th className="px-3 py-2 text-end font-medium">موجودی</th>
                <th className="px-3 py-2 text-end font-medium">معاملات</th>
                {ranked ? <th className="px-3 py-2 text-end font-medium">الو</th> : null}
                <th className="px-5 py-2 text-end font-medium">امتیاز</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.userId}
                  className={`border-t border-line ${r.userId === meId ? 'bg-accent/10' : ''}`}
                >
                  <td className="px-5 py-2.5 font-bold tabular-nums">{faNum(r.place)}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <RankEmblem elo={r.eloAfter ?? r.elo} size={18} />
                      <span className="font-medium">{r.name}</span>
                      {r.userId === meId ? (
                        <span className="text-[10.5px] font-semibold text-accent">تو</span>
                      ) : null}
                    </span>
                  </td>
                  <td
                    className={`px-3 py-2.5 ${r.status === 'disqualified' ? 'text-down' : r.status === 'target' ? 'text-up' : 'text-muted'}`}
                  >
                    {r.status === 'disqualified'
                      ? r.reason
                        ? faReason(r.reason)
                        : 'حذف'
                      : STATUS_LABEL[r.status]}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-end font-semibold tabular-nums ${pctClass(r.returnPct)}`}
                  >
                    {signedPct(r.returnPct)}
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums">
                    {compactMoney(Math.round(r.balance))}
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums">
                    {faNum(r.trades)}
                    <span className="text-muted"> ({faNum(r.wins)} برد)</span>
                  </td>
                  {ranked ? (
                    <td
                      className={`px-3 py-2.5 text-end tabular-nums ${
                        r.eloAfter !== null && r.eloBefore !== null && r.eloAfter >= r.eloBefore
                          ? 'text-up'
                          : 'text-down'
                      }`}
                    >
                      {r.eloAfter !== null && r.eloBefore !== null
                        ? signed(r.eloAfter - r.eloBefore)
                        : '—'}
                    </td>
                  ) : null}
                  <td className="px-5 py-2.5 text-end tabular-nums text-accent">
                    {recorded ? `+${faNum(r.xp)}` : '…'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-[13px] hover:bg-hover"
          >
            <Icon name="chart" size={15} /> دیدن نمودار
          </button>
        ) : null}
        <Link
          href="/battle"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-[13px] hover:bg-hover"
        >
          <Icon name="chevronLeft" size={15} className="rtl:-scale-x-100" /> بازگشت به نبردها
        </Link>
        {ranked && view.format ? (
          <Link
            href={`/battle?tab=play&queue=${view.format}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-5 text-[13.5px] font-semibold text-accent-fg hover:brightness-110"
            data-testid="play-again"
          >
            <Icon name="bolt" size={15} /> بازی دوباره
          </Link>
        ) : view.isHost ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void rematch()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-5 text-[13.5px] font-semibold text-accent-fg hover:brightness-110 disabled:opacity-50"
          >
            <Icon name="rotate" size={15} /> {busy ? 'در حال ساخت…' : 'نبرد دوباره'}
          </button>
        ) : (
          <Link
            href="/battle?new=1"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-5 text-[13.5px] font-semibold text-accent-fg hover:brightness-110"
          >
            <Icon name="plus" size={15} /> نبرد تازه
          </Link>
        )}
      </div>
      {error ? <p className="mt-3 text-center text-[12.5px] text-down">{error}</p> : null}
    </div>
  );
}
