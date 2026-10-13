'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  EMPTY_JOURNAL_ENTRY,
  TRADING_SESSIONS,
  excursionR,
  outcomeOf,
  plannedRR,
  rMultiple,
  tradingSessionOf,
  type JournalEntry,
  type Trade,
} from '@/lib/backtest';
import { useThemeCssVars } from '../hooks/useThemeCssVars';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import {
  duration,
  EXIT_REASON_LABEL,
  lots,
  num,
  pnlClass,
  signedMoney,
  utcDateTime,
} from './format';
import { useStoredSession } from './useStoredSession';

const sel = 'h-8 rounded-md border border-line bg-panel px-2 text-[13px]';

/** `/backtest/[id]/journal`: every trade of the session, with notes, tags and screenshots. */
export default function JournalView({ id }: { readonly id: string }) {
  useThemeCssVars();
  const { state, update } = useStoredSession(id);
  const [q, setQ] = useState('');
  const [side, setSide] = useState('');
  const [outcome, setOutcome] = useState('');
  const [tag, setTag] = useState('');
  const [tsession, setTsession] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const ready = state.status === 'ready' ? state : null;
  const journal = useMemo(() => ready?.session.journal ?? {}, [ready]);
  const allTags = useMemo(
    () => [...new Set(Object.values(journal).flatMap((j) => j.tags))].sort(),
    [journal],
  );
  const trades = useMemo(() => {
    if (!ready) return [];
    const needle = q.trim().toLowerCase();
    return [...ready.session.account.trades].reverse().filter((t) => {
      const j = journal[t.id] ?? EMPTY_JOURNAL_ENTRY;
      if (side && t.side !== side) return false;
      if (outcome && outcomeOf(t) !== outcome) return false;
      if (tag && !j.tags.includes(tag)) return false;
      if (tsession && tradingSessionOf(t.entryTime) !== tsession) return false;
      if (needle && !`${j.notes} ${j.tags.join(' ')} #${t.id}`.toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [ready, journal, q, side, outcome, tag, tsession]);

  if (state.status === 'loading')
    return (
      <div className="flex h-full items-center justify-center bg-chart text-muted">Loading…</div>
    );
  if (!ready)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-chart text-fg">
        <p className="text-muted">This session does not exist.</p>
        <Link href="/backtest" className="text-accent">
          Back to sessions
        </Link>
      </div>
    );
  const p = ready.spec.pricePrecision;
  const current = trades.find((t) => t.id === selected) ?? null;
  const open = ready.session.account.positions;

  return (
    <div className="flex h-full flex-col bg-chart text-fg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-5">
        <Link
          href="/backtest"
          className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"
        >
          <Icon name="chevronLeft" size={16} /> Sessions
        </Link>
        <h1 className="truncate text-[15px] font-semibold">
          {ready.session.settings.name} · Journal
        </h1>
        <div className="flex-1" />
        <Link
          href={`/backtest/${id}/analytics`}
          className="inline-flex h-8 items-center rounded-md border border-line px-3 text-[13px] hover:bg-hover"
        >
          Analytics
        </Link>
        <Link
          href={`/backtest/${id}`}
          className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg"
        >
          Open chart
        </Link>
      </header>
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-5 py-2 text-[13px]">
        <input
          aria-label="Search notes and tags"
          placeholder="Search words, tags or phrases…"
          className={`${sel} w-64`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Side"
          className={sel}
          value={side}
          onChange={(e) => setSide(e.target.value)}
        >
          <option value="">All sides</option>
          <option value="buy">Long</option>
          <option value="sell">Short</option>
        </select>
        <select
          aria-label="Outcome"
          className={sel}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          <option value="">All outcomes</option>
          <option value="win">Wins</option>
          <option value="loss">Losses</option>
          <option value="breakeven">Break even</option>
        </select>
        <select
          aria-label="Tag"
          className={sel}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="Trading session"
          className={sel}
          value={tsession}
          onChange={(e) => setTsession(e.target.value)}
        >
          <option value="">All trading sessions</option>
          {TRADING_SESSIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="text-muted">
          {trades.length} trades{open.length ? ` · ${open.length} open` : ''}
        </span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          <table className="w-full text-[12.5px]" data-testid="journal-table">
            <thead className="sticky top-0 bg-panel text-muted">
              <tr>
                {[
                  '#',
                  'Closed',
                  'Side',
                  'Volume',
                  'Entry',
                  'Exit',
                  'P&L',
                  'R',
                  'Duration',
                  'Exit',
                  'Session',
                  'Tags',
                  'Notes',
                ].map((h, i) => (
                  <th
                    key={`${h}${i}`}
                    className="whitespace-nowrap px-2 py-2 text-left font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const j = journal[t.id] ?? EMPTY_JOURNAL_ENTRY;
                const r = rMultiple(ready.cfg, t);
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t.id)}
                    className={`cursor-pointer border-t border-line/60 hover:bg-hover/50 ${selected === t.id ? 'bg-hover' : ''}`}
                  >
                    <td className="px-2 py-1.5">{t.id}</td>
                    <td className="whitespace-nowrap px-2">{utcDateTime(t.closeTime)}</td>
                    <td
                      className={`px-2 font-semibold ${t.side === 'buy' ? 'text-accent' : 'text-down'}`}
                    >
                      {t.side.toUpperCase()}
                    </td>
                    <td className="px-2 tabular-nums">{lots(t.initialVolume)}</td>
                    <td className="px-2 tabular-nums">{num(t.entryPrice, p)}</td>
                    <td className="px-2 tabular-nums">{num(t.closePrice, p)}</td>
                    <td className={`px-2 font-semibold tabular-nums ${pnlClass(t.netPnl)}`}>
                      {signedMoney(t.netPnl)}
                    </td>
                    <td className="px-2 tabular-nums">{r === null ? '—' : `${r.toFixed(2)}R`}</td>
                    <td className="whitespace-nowrap px-2">
                      {duration(t.closeTime - t.entryTime)}
                    </td>
                    <td className="px-2">{EXIT_REASON_LABEL[t.closeReason]}</td>
                    <td className="px-2">
                      {TRADING_SESSIONS.find((s) => s.id === tradingSessionOf(t.entryTime))?.label}
                    </td>
                    <td className="px-2">
                      {j.tags.map((x) => (
                        <span
                          key={x}
                          className="mr-1 rounded bg-accent/15 px-1 text-[11px] text-accent"
                        >
                          {x}
                        </span>
                      ))}
                    </td>
                    <td className="max-w-56 truncate px-2 text-muted">{j.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {trades.length === 0 ? (
            <p className="p-8 text-center text-muted">
              No trades match. Every trade you close in the session is journaled automatically.
            </p>
          ) : null}
        </div>
        {current ? (
          <TradeDetail
            key={current.id}
            trade={current}
            entry={journal[current.id] ?? EMPTY_JOURNAL_ENTRY}
            precision={p}
            rr={plannedRR(current)}
            r={rMultiple(ready.cfg, current)}
            loadShot={(sid) => ready.services.repo.loadScreenshot(sid)}
            onClose={() => setSelected(null)}
            onSave={async (patch, shot) => {
              if (shot) {
                const sid = `${id}-${current.id}-${shot.length}-${(ready.session.journal[current.id]?.screenshots.length ?? 0) + 1}`;
                await ready.services.repo.saveScreenshot(sid, shot);
                patch = {
                  ...patch,
                  screenshots: [
                    ...(patch.screenshots ?? journal[current.id]?.screenshots ?? []),
                    sid,
                  ],
                };
              }
              await update((s) => {
                s.journal[current.id] = {
                  ...(s.journal[current.id] ?? EMPTY_JOURNAL_ENTRY),
                  ...patch,
                };
              });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function TradeDetail({
  trade: t,
  entry,
  precision,
  rr,
  r,
  loadShot,
  onSave,
  onClose,
}: {
  readonly trade: Trade;
  readonly entry: JournalEntry;
  readonly precision: number;
  readonly rr: number | null;
  readonly r: number | null;
  readonly loadShot: (id: string) => Promise<string | null>;
  readonly onSave: (patch: Partial<JournalEntry>, screenshot?: string) => Promise<void>;
  readonly onClose: () => void;
}) {
  const [notes, setNotes] = useState(entry.notes);
  const [tagText, setTagText] = useState('');
  const [shots, setShots] = useState<Array<{ id: string; url: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      entry.screenshots.map(async (id) => ({ id, url: (await loadShot(id)) ?? '' })),
    ).then((list) => !cancelled && setShots(list.filter((s) => s.url)));
    return () => {
      cancelled = true;
    };
  }, [entry.screenshots, loadShot]);
  const exc = excursionR(t);
  const row = (k: string, v: React.ReactNode) => (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </>
  );
  const addTag = () => {
    const v = tagText.trim();
    if (!v || entry.tags.includes(v)) return;
    setTagText('');
    void onSave({ tags: [...entry.tags, v] });
  };
  return (
    <aside
      className="flex w-96 shrink-0 flex-col overflow-y-auto border-l border-line bg-panel p-4 text-[12.5px]"
      aria-label={`Trade ${t.id}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">
          Trade #{t.id} ·{' '}
          <span className={t.side === 'buy' ? 'text-accent' : 'text-down'}>
            {t.side === 'buy' ? 'Long' : 'Short'}
          </span>
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-hover"
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        {row('Net P&L', <span className={pnlClass(t.netPnl)}>{signedMoney(t.netPnl)}</span>)}
        {row('Gross / fees', `${signedMoney(t.grossPnl)} / ${signedMoney(-t.commission)}`)}
        {row('R multiple', r === null ? '—' : `${r.toFixed(2)}R`)}
        {row('Planned R:R', rr === null ? '—' : `1 : ${rr.toFixed(2)}`)}
        {row('Entry', `${num(t.entryPrice, precision)} · ${t.entryKind}`)}
        {row('Opened', utcDateTime(t.entryTime))}
        {row('Exit (avg)', num(t.closePrice, precision))}
        {row('Closed', utcDateTime(t.closeTime))}
        {row('Duration', duration(t.closeTime - t.entryTime))}
        {row('Size', `${lots(t.initialVolume)} lots`)}
        {row('Initial SL / TP', `${num(t.initialSl, precision)} / ${num(t.initialTp, precision)}`)}
        {row('MAE / MFE', exc ? `${exc.mae.toFixed(2)}R / ${exc.mfe.toFixed(2)}R` : '—')}
      </dl>
      <h3 className="mb-1 mt-3 font-semibold">Exits</h3>
      {t.exits.map((x, i) => (
        <div key={i} className="flex justify-between border-t border-line/60 py-0.5 tabular-nums">
          <span>
            {EXIT_REASON_LABEL[x.reason]} · {lots(x.volume)} @ {num(x.price, precision)}
          </span>
          <span className={pnlClass(x.pnl)}>{signedMoney(x.pnl - x.commission)}</span>
        </div>
      ))}
      <h3 className="mb-1 mt-3 font-semibold">Confidence</h3>
      <div className="flex gap-1" role="radiogroup" aria-label="Confidence">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={entry.confidence === n}
            aria-label={`${n} of 5`}
            onClick={() => void onSave({ confidence: entry.confidence === n ? null : n })}
            className={(entry.confidence ?? 0) >= n ? 'text-[#f7a600]' : 'text-muted'}
          >
            <Icon name="star" size={18} />
          </button>
        ))}
      </div>
      <h3 className="mb-1 mt-3 font-semibold">Tags</h3>
      <div className="flex flex-wrap gap-1">
        {entry.tags.map((x) => (
          <span
            key={x}
            className="inline-flex items-center gap-1 rounded bg-accent/15 px-1.5 py-0.5 text-accent"
          >
            {x}
            <button
              type="button"
              aria-label={`Remove tag ${x}`}
              onClick={() => void onSave({ tags: entry.tags.filter((y) => y !== x) })}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        <input
          aria-label="New tag"
          placeholder="Add a tag (e.g. A+ setup)"
          className={`${sel} flex-1`}
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
        />
        <Button onClick={addTag}>Add</Button>
      </div>
      <h3 className="mb-1 mt-3 font-semibold">Notes</h3>
      <textarea
        aria-label="Notes"
        className="min-h-28 w-full rounded-md border border-line bg-chart p-2 text-fg outline-none focus:border-accent"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== entry.notes && void onSave({ notes })}
        placeholder="Why you took it, how you managed it, what you learned…"
      />
      <h3 className="mb-1 mt-3 font-semibold">Screenshots</h3>
      <div className="grid grid-cols-2 gap-2">
        {shots.map((s) => (
          <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
            {/* Data-URL screenshots from storage: next/image cannot optimise them. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.url}
              alt={`Screenshot of trade ${t.id}`}
              className="rounded border border-line"
            />
          </a>
        ))}
      </div>
      <label className="mt-2 inline-flex h-8 cursor-pointer items-center gap-1.5 self-start rounded-md border border-line px-3 hover:bg-hover">
        <Icon name="camera" size={15} /> Add image
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () =>
              typeof reader.result === 'string' && void onSave({}, reader.result);
            reader.readAsDataURL(file);
          }}
        />
      </label>
      <p className="mt-1 text-[11px] text-muted">
        In the session, “📷” in the History tab captures the chart.
      </p>
    </aside>
  );
}
