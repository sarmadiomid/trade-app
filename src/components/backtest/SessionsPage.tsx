'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { browserBacktestServices } from '@/lib/app';
import type { SessionSettings, SessionSummary } from '@/lib/backtest';
import { useThemeCssVars } from '../hooks/useThemeCssVars';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { CreateSessionDialog } from './CreateSessionDialog';
import { money, pnlClass, signedMoney, utcDate, utcDateTime } from './format';

const STATUS = {
  'in-progress': ['In progress', 'bg-accent/15 text-accent'],
  completed: ['Completed', 'bg-up/15 text-up'],
  failed: ['Failed', 'bg-down/15 text-down'],
} as const;

/** `/backtest`: every session as a card, and "New session". */
export default function SessionsPage() {
  const services = browserBacktestServices();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [creating, setCreating] = useState<{ initial?: SessionSettings } | null>(null);
  const [deleting, setDeleting] = useState<SessionSummary | null>(null);
  useThemeCssVars();

  const refresh = useCallback(() => {
    void services.repo.list().then(setSessions);
  }, [services]);
  useEffect(refresh, [refresh]);

  const duplicate = async (id: string) => {
    const s = await services.repo.load(id);
    if (s) setCreating({ initial: s.settings });
  };

  return (
    <div className="min-h-full bg-chart text-fg">
      <header className="flex h-14 items-center gap-3 border-b border-line bg-panel px-5">
        <Link href="/" className="text-[15px] font-semibold">
          Backtesting
        </Link>
        <span className="text-[13px] text-muted">
          Replay the market candle by candle and trade it
        </span>
        <div className="flex-1" />
        <Link href="/chart" className="text-[13px] text-muted hover:text-fg">
          Chart
        </Link>
        <Button variant="primary" onClick={() => setCreating({})} data-testid="new-session">
          <Icon name="plus" size={16} /> New session
        </Button>
      </header>
      <main className="mx-auto max-w-6xl p-5">
        {sessions === null ? (
          <div className="flex h-60 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <Icon name="replay" size={36} />
            <h1 className="text-lg font-semibold">No sessions yet</h1>
            <p className="max-w-md text-[13px] text-muted">
              A session replays a date range of the market with a virtual account. Pick an asset, a
              starting balance and the dates to test.
            </p>
            <Button variant="primary" onClick={() => setCreating({})}>
              <Icon name="plus" size={16} /> Create your first session
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => {
              const pnl = s.balance - s.startingBalance;
              const progress = Math.max(
                0,
                Math.min(1, (s.cursor - s.startDate) / (s.endDate + 86_400_000 - s.startDate)),
              );
              const [label, cls] = STATUS[s.status];
              return (
                <article
                  key={s.id}
                  className="flex flex-col rounded-xl border border-line bg-panel p-4"
                  data-testid="session-card"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-[15px] font-semibold" title={s.name}>
                        {s.name}
                      </h2>
                      <p className="text-[12px] text-muted">
                        {s.symbol} · {s.type === 'prop' ? 'Prop Firm Session' : 'Backtesting'}
                        {s.strategyTag ? ` · ${s.strategyTag}` : ''}
                      </p>
                    </div>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
                      {label}
                    </span>
                  </div>
                  <p className="mt-3 text-[12px] text-muted">
                    {utcDate(s.startDate)} → {utcDate(s.endDate)}
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[11.5px] text-muted">
                    Replay at {utcDateTime(s.cursor)} UTC
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                    <div>
                      <dt className="text-muted">Balance</dt>
                      <dd className="font-semibold tabular-nums">{money(s.balance)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">P&L</dt>
                      <dd className={`font-semibold tabular-nums ${pnlClass(pnl)}`}>
                        {signedMoney(pnl)} ({((pnl / s.startingBalance) * 100).toFixed(2)}%)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Trades</dt>
                      <dd className="font-semibold tabular-nums">{s.trades}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Link
                      href={`/backtest/${s.id}`}
                      className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg hover:brightness-110"
                      data-testid="open-session"
                    >
                      {s.status === 'in-progress' ? 'Continue' : 'Open'}
                    </Link>
                    <Link
                      href={`/backtest/${s.id}/analytics`}
                      className="inline-flex h-8 items-center rounded-md border border-line px-3 text-[13px] hover:bg-hover"
                    >
                      Analytics
                    </Link>
                    <Link
                      href={`/backtest/${s.id}/journal`}
                      className="inline-flex h-8 items-center rounded-md border border-line px-3 text-[13px] hover:bg-hover"
                    >
                      Journal
                    </Link>
                    <div className="flex-1" />
                    <button
                      type="button"
                      title="Duplicate"
                      aria-label={`Duplicate ${s.name}`}
                      onClick={() => void duplicate(s.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
                    >
                      <Icon name="clone" size={16} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      aria-label={`Delete ${s.name}`}
                      onClick={() => setDeleting(s)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-down"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      {creating ? (
        <CreateSessionDialog
          services={services}
          initial={creating.initial}
          onClose={() => setCreating(null)}
          onCreated={(id) => router.push(`/backtest/${id}`)}
        />
      ) : null}
      {deleting ? (
        <Dialog
          title="Delete session?"
          onClose={() => setDeleting(null)}
          width={420}
          footer={
            <>
              <div className="flex-1" />
              <Button onClick={() => setDeleting(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const id = deleting.id;
                  setDeleting(null);
                  void services.repo.remove(id).then(refresh);
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <p className="p-5 text-[13px]">
            “{deleting.name}” and its {deleting.trades} trades, journal and screenshots will be
            deleted. This cannot be undone.
          </p>
        </Dialog>
      ) : null}
    </div>
  );
}
