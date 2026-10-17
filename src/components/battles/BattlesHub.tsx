'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  RANKED_FORMATS,
  RANKS,
  WIN_CONDITIONS,
  levelFor,
  rankFor,
  rankProgress,
  type BattleProfile,
  type BattleSummary,
  type LeaderboardEntry,
  type QueueStatus,
  type RankedFormat,
} from '@/lib/battles';
import { useThemeCssVars } from '../hooks/useThemeCssVars';
import { AppHeader, initials } from '../platform/AppHeader';
import { api, type Me } from '../platform/api';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';
import { NewBattleDialog } from './NewBattleDialog';
import { RankEmblem } from './RankEmblem';
import {
  ASSET_COLORS,
  STATUS,
  ago,
  compactMoney,
  ordinal,
  pctClass,
  signed,
  signedPct,
  winConditionName,
} from './format';

type Tab = 'play' | 'browse' | 'mine' | 'leaderboard';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: IconName }> = [
  { id: 'play', label: 'Play', icon: 'bolt' },
  { id: 'browse', label: 'Browse', icon: 'globe' },
  { id: 'mine', label: 'My Battles', icon: 'list' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
];

/** `/battle`: the Battles home: play (ranked matchmaking, custom battles), browse, history, leaderboard. */
export default function BattlesHub({ user }: { readonly user: Me }) {
  useThemeCssVars();
  const router = useRouter();
  const params = useSearchParams();
  const initialTab = params.get('tab');
  const [tab, setTab] = useState<Tab>(
    initialTab === 'browse' || initialTab === 'mine' || initialTab === 'leaderboard'
      ? initialTab
      : 'play',
  );
  const [creating, setCreating] = useState(params.get('new') === '1');
  const [profile, setProfile] = useState<BattleProfile | null>(null);
  const [active, setActive] = useState<BattleSummary | null>(null);
  const [name, setName] = useState(user.name);
  const autoQueue = params.get('queue');

  const loadProfile = useCallback(() => {
    void api<{ profile: BattleProfile; active: BattleSummary | null }>('/api/battles/profile').then(
      (r) => {
        setProfile(r.profile);
        setActive(r.active);
        setName(r.profile.name);
      },
      () => {},
    );
  }, []);
  useEffect(loadProfile, [loadProfile]);

  const select = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    url.searchParams.delete('queue');
    url.searchParams.delete('new');
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="h-full overflow-y-auto bg-chart text-fg">
      <AppHeader user={{ ...user, name }} />
      <div className="pointer-events-none absolute inset-x-0 top-14 h-80 bg-[radial-gradient(50%_90%_at_15%_0%,rgba(41,98,255,0.20),transparent_70%),radial-gradient(30%_70%_at_85%_0%,rgba(255,92,122,0.10),transparent_70%)]" />
      <main className="relative mx-auto max-w-[1400px] px-4 pb-16 pt-7 sm:px-6">
        <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-accent">
              Battles
            </p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">
              Trade head-to-head
            </h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted">
              Every trader gets the same historical market, revealed candle by candle in real time.
              Out-trade them on return, win ranked battles and climb from Rookie to Master.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <JoinById />
            <button
              type="button"
              onClick={() => setCreating(true)}
              data-testid="new-battle"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-[13.5px] font-semibold text-accent-fg shadow-[0_10px_30px_-12px_rgba(41,98,255,0.9)] transition hover:brightness-110"
            >
              <Icon name="plus" size={16} /> New Battle
            </button>
          </div>
        </section>

        {active ? (
          <Link
            href={`/battle/${active.id}`}
            className="mt-6 flex items-center gap-3 rounded-xl border border-up/40 bg-up/10 px-4 py-3 text-[13.5px] transition hover:bg-up/15"
          >
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-up" />
            <span className="flex-1">
              <span className="font-semibold">Battle in progress:</span> {active.name}
            </span>
            <span className="font-semibold text-up">Rejoin →</span>
          </Link>
        ) : null}

        <div
          role="tablist"
          aria-label="Battles"
          className="mt-7 flex gap-1 overflow-x-auto border-b border-line"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => select(t.id)}
              data-testid={`tab-${t.id}`}
              className={`-mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-[13.5px] font-medium transition ${
                tab === t.id
                  ? 'border-accent text-fg'
                  : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              <Icon name={t.icon} size={15} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            {tab === 'play' ? (
              <PlayTab
                profile={profile}
                autoQueue={autoQueue}
                onCustom={() => setCreating(true)}
                onBrowse={() => select('browse')}
                onMatched={(id) => router.push(`/battle/${id}`)}
              />
            ) : null}
            {tab === 'browse' ? <BrowseTab onCreate={() => setCreating(true)} /> : null}
            {tab === 'mine' ? <MineTab /> : null}
            {tab === 'leaderboard' ? <LeaderboardTab /> : null}
          </div>
          <ProfilePanel profile={profile} onRenamed={loadProfile} />
        </div>
      </main>
      {creating ? (
        <NewBattleDialog
          hostName={name}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`/battle/${id}`)}
        />
      ) : null}
    </div>
  );
}

function JoinById() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>('/api/battles/join-code', {
        method: 'POST',
        body: { code },
      });
      router.push(`/battle/${r.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join');
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="relative flex items-center">
      <input
        value={code}
        onChange={(e) => {
          setCode(e.target.value.toUpperCase());
          setError(null);
        }}
        placeholder="Battle ID"
        aria-label="Battle ID"
        maxLength={8}
        data-testid="join-code"
        className={`h-10 w-36 rounded-l-lg border bg-panel px-3 font-mono text-[13px] uppercase tracking-widest outline-none focus:border-accent ${
          error ? 'border-down' : 'border-line'
        }`}
      />
      <button
        type="submit"
        disabled={busy || !code.trim()}
        className="h-10 rounded-r-lg border border-l-0 border-line bg-panel px-3 text-[13px] font-medium hover:bg-hover disabled:opacity-50"
      >
        {busy ? '…' : 'Join'}
      </button>
      {error ? (
        <span className="absolute left-0 top-11 whitespace-nowrap text-[11.5px] text-down">
          {error}
        </span>
      ) : null}
    </form>
  );
}

// ---- Play ----------------------------------------------------------------------------------

function PlayTab({
  profile,
  autoQueue,
  onCustom,
  onBrowse,
  onMatched,
}: {
  readonly profile: BattleProfile | null;
  readonly autoQueue: string | null;
  readonly onCustom: () => void;
  readonly onBrowse: () => void;
  readonly onMatched: (battleId: string) => void;
}) {
  const [queue, setQueue] = useState<QueueStatus>({ status: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const join = useCallback(async (format: RankedFormat['id']) => {
    setError(null);
    try {
      setQueue(await api<QueueStatus>('/api/battles/queue', { method: 'POST', body: { format } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start matchmaking');
    }
  }, []);

  // Resume a search in progress (or start the one asked for by "Play again").
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void api<QueueStatus>('/api/battles/queue').then(
      (s) => {
        if (s.status !== 'idle') setQueue(s);
        else if (autoQueue && RANKED_FORMATS.some((f) => f.id === autoQueue))
          void join(autoQueue as RankedFormat['id']);
      },
      () => {},
    );
  }, [autoQueue, join]);

  useEffect(() => {
    if (queue.status === 'matched') {
      const id = queue.battleId;
      const t = window.setTimeout(() => {
        void api('/api/battles/queue?ack=1').catch(() => {});
        onMatched(id);
      }, 1200);
      return () => window.clearTimeout(t);
    }
    if (queue.status !== 'searching') return;
    const t = window.setInterval(() => {
      void api<QueueStatus>('/api/battles/queue').then(setQueue, () => {});
    }, 1500);
    return () => window.clearInterval(t);
  }, [queue, onMatched]);

  const cancel = async () => {
    try {
      setQueue(await api<QueueStatus>('/api/battles/queue', { method: 'DELETE' }));
    } catch {
      setQueue({ status: 'idle' });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle
          icon="bolt"
          title="Ranked"
          text="Matchmaking pairs you with a trader of similar Elo. Ranked results move your rating."
        />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {RANKED_FORMATS.map((f) => (
            <RankedCard
              key={f.id}
              format={f}
              searching={queue.status === 'searching' && queue.format === f.id}
              disabled={queue.status !== 'idle'}
              onFind={() => void join(f.id)}
            />
          ))}
        </div>
        {error ? <p className="mt-2 text-[12.5px] text-down">{error}</p> : null}
      </section>

      <section>
        <SectionTitle
          icon="users"
          title="Casual"
          text="Custom battles with your own rules. No Elo at stake."
        />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ActionCard
            icon="swords"
            title="Create a custom battle"
            text="Pick the battle type, up to five assets, the balance, the timer and the drawdown rules. Invite friends with the battle ID."
            cta="New Battle"
            onClick={onCustom}
            testId="custom-battle"
          />
          <ActionCard
            icon="globe"
            title="Join a public lobby"
            text="Browse open battles in Standby or already in progress (when they accept late entries)."
            cta="Browse battles"
            onClick={onBrowse}
          />
        </div>
      </section>

      <section>
        <SectionTitle icon="info" title="How battles work" />
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            [
              'Join or create',
              'Queue for a ranked match, join a lobby, or host a custom battle and share its ID.',
            ],
            [
              'Trade the same candles',
              'When the countdown ends, everyone gets the same market, revealed candle by candle on a shared clock. Market, limit and stop orders with SL/TP.',
            ],
            [
              'Win and rank up',
              'Highest return or first to the profit target wins. Break a drawdown rule and you are disqualified. Elo and Composite Score update at the end.',
            ],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-xl border border-line bg-panel p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-[12px] font-bold text-accent">
                {i + 1}
              </span>
              <h3 className="mt-2 text-[14px] font-semibold">{t}</h3>
              <p className="mt-1 text-[12.5px] leading-5 text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {queue.status !== 'idle' ? (
        <MatchmakingOverlay queue={queue} profile={profile} onCancel={() => void cancel()} />
      ) : null}
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  text,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly text?: string;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-[16px] font-semibold">
        <Icon name={icon} size={16} /> {title}
      </h2>
      {text ? <p className="mt-0.5 text-[13px] text-muted">{text}</p> : null}
    </div>
  );
}

function RankedCard({
  format,
  searching,
  disabled,
  onFind,
}: {
  readonly format: RankedFormat;
  readonly searching: boolean;
  readonly disabled: boolean;
  readonly onFind: () => void;
}) {
  const s = format.settings;
  const chips = [
    '1v1',
    `${s.durationMin} min`,
    WIN_CONDITIONS[s.winCondition].name,
    compactMoney(s.startingBalance),
    s.profitTargetPct ? `Target +${s.profitTargetPct}%` : null,
    s.maxDrawdownPct ? `Max DD ${s.maxDrawdownPct}%` : null,
  ].filter(Boolean) as string[];
  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5 transition hover:border-accent/50"
      data-testid={`ranked-${format.id}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-accent/15 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-bold">{format.name}</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {format.id === 'duel'
              ? 'The classic: ten minutes, the best return wins.'
              : 'Fast and sharp: first to close at +2% takes it.'}
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Icon name={format.id === 'duel' ? 'swords' : 'target'} size={19} />
        </span>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c}
            className="rounded-md bg-hover px-2 py-1 text-[11.5px] font-medium text-fg/90"
          >
            {c}
          </span>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onFind}
        data-testid={`find-${format.id}`}
        className="relative mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[13.5px] font-semibold text-accent-fg transition hover:brightness-110 disabled:opacity-50"
      >
        <Icon name="bolt" size={16} /> {searching ? 'Searching…' : 'Find match'}
      </button>
    </article>
  );
}

function ActionCard({
  icon,
  title,
  text,
  cta,
  onClick,
  testId,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly text: string;
  readonly cta: string;
  readonly onClick: () => void;
  readonly testId?: string;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-panel p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-hover text-fg">
        <Icon name={icon} size={19} />
      </span>
      <h3 className="mt-3 text-[15px] font-semibold">{title}</h3>
      <p className="mt-1 flex-1 text-[12.5px] leading-5 text-muted">{text}</p>
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line text-[13px] font-medium hover:bg-hover"
      >
        {cta} <Icon name="chevronRight" size={15} />
      </button>
    </article>
  );
}

function MatchmakingOverlay({
  queue,
  profile,
  onCancel,
}: {
  readonly queue: QueueStatus;
  readonly profile: BattleProfile | null;
  readonly onCancel: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);
  const matched = queue.status === 'matched';
  const format =
    queue.status === 'searching' ? RANKED_FORMATS.find((f) => f.id === queue.format) : null;
  const waited =
    queue.status === 'searching' ? Math.max(0, Math.floor((now - queue.since) / 1000)) : 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Matchmaking"
      data-testid="matchmaking"
    >
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 text-center shadow-2xl">
        <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
          {!matched ? (
            <>
              <span className="absolute inset-0 animate-ping rounded-full border border-accent/40 [animation-duration:2s]" />
              <span className="absolute inset-4 animate-ping rounded-full border border-accent/30 [animation-delay:0.5s] [animation-duration:2s]" />
            </>
          ) : (
            <span className="absolute inset-0 rounded-full bg-up/15" />
          )}
          <RankEmblem elo={profile?.elo ?? 1000} size={72} />
        </div>
        <h2 className="mt-4 text-[18px] font-bold">
          {matched ? 'Opponent found!' : 'Finding an opponent'}
        </h2>
        {matched ? (
          <p className="mt-1 text-[13px] text-muted">Loading the battle…</p>
        ) : queue.status === 'searching' ? (
          <>
            <p className="mt-1 text-[13px] text-muted">
              {format?.name ?? 'Ranked'} · {format?.summary}
            </p>
            <p className="mt-4 font-mono text-[28px] font-bold tabular-nums">
              {Math.floor(waited / 60)}:{String(waited % 60).padStart(2, '0')}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              Elo range ±{queue.range} · {queue.searching} trader{queue.searching === 1 ? '' : 's'}{' '}
              searching
            </p>
            <button
              type="button"
              onClick={onCancel}
              data-testid="cancel-search"
              className="mt-5 inline-flex h-9 items-center rounded-lg border border-line px-4 text-[13px] hover:bg-hover"
            >
              Cancel
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ---- Browse --------------------------------------------------------------------------------

function useList(tab: 'browse' | 'mine') {
  const [list, setList] = useState<BattleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    void api<{ battles: BattleSummary[] }>(`/api/battles?tab=${tab}`).then(
      (r) => {
        setList(r.battles);
        setError(null);
      },
      (e: unknown) => setError(e instanceof Error ? e.message : 'Could not load battles'),
    );
  }, [tab]);
  useEffect(() => {
    load();
    const t = window.setInterval(load, 5000);
    return () => window.clearInterval(t);
  }, [load]);
  return { list, error, reload: load };
}

function BrowseTab({ onCreate }: { readonly onCreate: () => void }) {
  const { list, error, reload } = useList('browse');
  const [filter, setFilter] = useState<'all' | 'standby' | 'live'>('all');
  const shown = (list ?? []).filter(
    (b) =>
      filter === 'all' ||
      (filter === 'standby'
        ? b.status === 'standby' || b.status === 'countdown'
        : b.status === 'live' || b.status === 'paused'),
  );
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'All'],
            ['standby', 'Standby'],
            ['live', 'In Progress'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`h-8 rounded-full px-3 text-[12.5px] font-medium transition ${
              filter === id ? 'bg-accent/15 text-accent' : 'bg-panel text-muted hover:text-fg'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={reload}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12.5px] text-muted hover:bg-hover hover:text-fg"
        >
          <Icon name="rotate" size={14} /> Refresh
        </button>
      </div>
      {error ? <p className="mt-3 text-[13px] text-down">{error}</p> : null}
      {list === null ? (
        <ListSkeleton />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="swords"
          title="No public battles right now"
          text="Create one and share the battle ID, or queue for a ranked match."
          cta="New Battle"
          onClick={onCreate}
        />
      ) : (
        <ul className="mt-3 flex flex-col gap-2" data-testid="browse-list">
          {shown.map((b) => (
            <BattleRow key={b.id} b={b} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BattleRow({ b }: { readonly b: BattleSummary }) {
  const [label, cls] = STATUS[b.status];
  const full = b.participants >= b.maxParticipants;
  const canJoin = !b.joined && !full && (b.status === 'standby' || b.allowLateJoin);
  return (
    <li>
      <Link
        href={`/battle/${b.id}`}
        className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 transition hover:border-accent/40 sm:flex-row sm:items-center"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[14.5px] font-semibold">{b.name}</span>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>
              {label}
            </span>
            <span className="rounded bg-hover px-1.5 py-0.5 text-[11px] font-medium text-muted">
              {winConditionName(b.winCondition)}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span>Host {b.hostName ?? '—'}</span>
            <span>{compactMoney(b.startingBalance)}</span>
            <span>{b.durationMin} min</span>
            {b.profitTargetPct ? <span>Target +{b.profitTargetPct}%</span> : null}
            <span className="flex items-center gap-1">
              {b.assets.map((a) => (
                <span
                  key={a}
                  className="h-2 w-2 rounded-full"
                  style={{ background: ASSET_COLORS[a] ?? '#5b8cff' }}
                  title={a}
                />
              ))}
              <span className="ml-0.5">{b.assets.join(' · ')}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="flex items-center gap-1.5 text-[12.5px] tabular-nums text-muted"
            title="Traders"
          >
            <Icon name="users" size={15} /> {b.participants}/{b.maxParticipants}
          </span>
          <span
            className={`inline-flex h-9 min-w-24 items-center justify-center rounded-lg px-4 text-[13px] font-semibold ${
              canJoin ? 'bg-accent text-accent-fg' : 'border border-line'
            }`}
          >
            {b.joined ? 'Open' : canJoin ? 'Join' : full ? 'Full' : 'View'}
          </span>
        </div>
      </Link>
    </li>
  );
}

// ---- My battles ----------------------------------------------------------------------------

function MineTab() {
  const { list, error } = useList('mine');
  const [now] = useState(() => Date.now());
  return (
    <section>
      {error ? <p className="text-[13px] text-down">{error}</p> : null}
      {list === null ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <EmptyState
          icon="list"
          title="No battles yet"
          text="Battles you create or join show up here with your results."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[640px] text-[13px]" data-testid="my-battles">
            <thead>
              <tr className="text-left text-[11.5px] text-muted">
                <th className="px-4 py-2.5 font-medium">Battle</th>
                <th className="px-3 py-2.5 font-medium">Mode</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 text-right font-medium">Place</th>
                <th className="px-3 py-2.5 text-right font-medium">Return</th>
                <th className="px-3 py-2.5 text-right font-medium">Elo</th>
                <th className="px-4 py-2.5 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => {
                const [label, cls] = STATUS[b.status];
                return (
                  <tr key={b.id} className="border-t border-line hover:bg-hover/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/battle/${b.id}`} className="font-medium hover:text-accent">
                        {b.name}
                      </Link>
                      <div className="text-[11.5px] text-muted">
                        {winConditionName(b.winCondition)} · {b.participants} traders
                        {b.winnerName ? ` · winner ${b.winnerName}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${b.mode === 'ranked' ? 'bg-accent/15 text-accent' : 'bg-hover text-muted'}`}
                      >
                        {b.mode === 'ranked' ? 'Ranked' : 'Casual'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                      {b.myPlace ? `${ordinal(b.myPlace)}/${b.participants}` : '—'}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-semibold tabular-nums ${b.myReturn === null ? 'text-muted' : pctClass(b.myReturn)}`}
                    >
                      {b.myReturn === null ? '—' : signedPct(b.myReturn)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right tabular-nums ${b.myEloChange === null ? 'text-muted' : b.myEloChange >= 0 ? 'text-up' : 'text-down'}`}
                    >
                      {b.myEloChange === null ? '—' : signed(b.myEloChange)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted">{ago(b.createdAt, now)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---- Leaderboard ---------------------------------------------------------------------------

function LeaderboardTab() {
  const [sort, setSort] = useState<'elo' | 'xp'>('elo');
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api<{ entries: LeaderboardEntry[] }>(`/api/battles/leaderboard?sort=${sort}`).then(
      (r) => !cancelled && setEntries(r.entries),
      () => !cancelled && setEntries([]),
    );
    return () => {
      cancelled = true;
    };
  }, [sort]);
  return (
    <section>
      <div className="flex items-center gap-2">
        {(
          [
            ['elo', 'Elo'],
            ['xp', 'Composite Score'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={sort === id}
            onClick={() => {
              setEntries(null);
              setSort(id);
            }}
            className={`h-8 rounded-full px-3 text-[12.5px] font-medium transition ${
              sort === id ? 'bg-accent/15 text-accent' : 'bg-panel text-muted hover:text-fg'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-muted">
          {sort === 'elo'
            ? 'Ranked rating, updated after every ranked battle'
            : 'XP earned in every battle, win or lose'}
        </span>
      </div>
      {entries === null ? (
        <ListSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState
          icon="trophy"
          title="The leaderboard is empty"
          text={
            sort === 'elo'
              ? 'Win a ranked battle to take the first spot.'
              : 'Finish a battle to earn Composite Score.'
          }
        />
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[560px] text-[13px]" data-testid="leaderboard">
            <thead>
              <tr className="text-left text-[11.5px] text-muted">
                <th className="w-14 px-4 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">Trader</th>
                <th className="px-3 py-2.5 font-medium">Rank</th>
                <th className="px-3 py-2.5 text-right font-medium">Elo</th>
                <th className="px-3 py-2.5 text-right font-medium">Ranked W/L</th>
                <th className="px-4 py-2.5 text-right font-medium">XP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const rank = rankFor(e.elo);
                return (
                  <tr
                    key={e.userId}
                    className={`border-t border-line ${e.isMe ? 'bg-accent/10' : ''}`}
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${
                          e.place === 1
                            ? 'bg-[#f2c14e]/20 text-[#f2c14e]'
                            : e.place === 2
                              ? 'bg-[#c3ccd9]/20 text-[#c3ccd9]'
                              : e.place === 3
                                ? 'bg-[#c8814f]/20 text-[#c8814f]'
                                : 'text-muted'
                        }`}
                      >
                        {e.place}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-hover text-[10.5px] font-bold">
                          {initials(e.name)}
                        </span>
                        <span className="font-medium">{e.name}</span>
                        {e.isMe ? (
                          <span className="text-[10.5px] font-semibold text-accent">YOU</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <RankEmblem elo={e.elo} size={20} />
                        <span className="font-medium" style={{ color: rank.color }}>
                          {rank.name}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{e.elo}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                      {e.rankedWins}/{e.rankedGames - e.rankedWins}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {e.xp.toLocaleString('en-US')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-5 rounded-xl border border-line bg-panel p-4">
        <h3 className="text-[13px] font-semibold">Ranks</h3>
        <ol className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {RANKS.map((r) => (
            <li key={r.id} className="flex flex-col items-center gap-1 text-center">
              <RankEmblem elo={r.min} size={34} />
              <span className="text-[11.5px] font-semibold" style={{ color: r.color }}>
                {r.name}
              </span>
              <span className="text-[10.5px] tabular-nums text-muted">
                {r.min === 0 ? '<1100' : `${r.min}+`}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---- Profile -------------------------------------------------------------------------------

function ProfilePanel({
  profile,
  onRenamed,
}: {
  readonly profile: BattleProfile | null;
  readonly onRenamed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!profile) {
    return (
      <aside className="h-fit rounded-2xl border border-line bg-panel p-5">
        <div className="h-48 animate-pulse rounded-lg bg-hover/60" />
      </aside>
    );
  }
  const rank = rankFor(profile.elo);
  const { next, progress } = rankProgress(profile.elo);
  const lvl = levelFor(profile.xp);
  const winRate =
    profile.rankedGames > 0
      ? `${((profile.rankedWins / profile.rankedGames) * 100).toFixed(0)}%`
      : '—';
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/api/battles/profile', { method: 'PATCH', body: { name } });
      setEditing(false);
      setError(null);
      onRenamed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  };
  const stats: Array<[string, ReactNode]> = [
    ['Battles', profile.battles],
    ['Wins', profile.wins],
    ['Podiums', profile.podiums],
    ['Ranked win rate', winRate],
    ['Best streak', profile.bestStreak],
    [
      'Trade win rate',
      profile.trades > 0 ? `${((profile.winningTrades / profile.trades) * 100).toFixed(0)}%` : '—',
    ],
    [
      'Avg return',
      profile.avgReturn === null ? (
        '—'
      ) : (
        <span className={pctClass(profile.avgReturn)}>{signedPct(profile.avgReturn)}</span>
      ),
    ],
    [
      'Best return',
      profile.bestReturn === null ? (
        '—'
      ) : (
        <span className={pctClass(profile.bestReturn)}>{signedPct(profile.bestReturn)}</span>
      ),
    ],
  ];
  return (
    <aside
      className="relative h-fit overflow-hidden rounded-2xl border border-line bg-panel lg:sticky lg:top-20"
      data-testid="profile-panel"
    >
      <div
        className="absolute inset-x-0 top-0 h-32"
        style={{
          background: `radial-gradient(80% 100% at 50% 0%, ${rank.color}40, transparent 70%)`,
        }}
      />
      <div className="relative p-5">
        <div className="flex flex-col items-center text-center">
          <RankEmblem elo={profile.elo} size={84} />
          {editing ? (
            <form onSubmit={save} className="mt-3 flex w-full items-center gap-1.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoFocus
                aria-label="Display name"
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-chart px-3 text-[13px] outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-accent px-3 text-[13px] font-semibold text-accent-fg"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-9 rounded-lg border border-line px-2 text-[13px]"
                aria-label="Cancel"
              >
                <Icon name="close" size={14} />
              </button>
            </form>
          ) : (
            <div className="mt-3 flex items-center gap-1.5">
              <span className="text-[17px] font-bold">{profile.name}</span>
              <button
                type="button"
                onClick={() => {
                  setName(profile.name);
                  setEditing(true);
                }}
                aria-label="Edit display name"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
              >
                <Icon name="edit" size={14} />
              </button>
            </div>
          )}
          {error ? <p className="mt-1 text-[11.5px] text-down">{error}</p> : null}
          <p className="mt-1 text-[13px]">
            <span className="font-semibold" style={{ color: rank.color }}>
              {rank.name}
            </span>{' '}
            · <span className="font-semibold tabular-nums">{profile.elo}</span>{' '}
            <span className="text-muted">Elo</span>
            {profile.globalRank ? (
              <span className="text-muted"> · #{profile.globalRank}</span>
            ) : null}
          </p>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-[11.5px] text-muted">
            <span>Peak {profile.peakElo}</span>
            <span>{next ? `${next.min - profile.elo} to ${next.name}` : 'Top rank'}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress * 100}%`, background: rank.color }}
            />
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-2">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg bg-chart/60 px-3 py-2">
              <dt className="text-[11px] text-muted">{k}</dt>
              <dd className="text-[14px] font-bold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 rounded-lg border border-line p-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium">Composite Score · Lv {lvl.level}</span>
            <span className="tabular-nums text-muted">{profile.xp.toLocaleString('en-US')} XP</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(lvl.into / lvl.needed) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {lvl.needed - lvl.into} XP to level {lvl.level + 1}
          </p>
        </div>
      </div>
    </aside>
  );
}

// ---- shared --------------------------------------------------------------------------------

function ListSkeleton() {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[74px] animate-pulse rounded-xl bg-panel" />
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
  cta,
  onClick,
}: {
  readonly icon: IconName;
  readonly title: string;
  readonly text: string;
  readonly cta?: string;
  readonly onClick?: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Icon name={icon} size={20} />
      </span>
      <h3 className="mt-1 text-[15px] font-semibold">{title}</h3>
      <p className="max-w-sm text-[13px] text-muted">{text}</p>
      {cta && onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-fg hover:brightness-110"
        >
          <Icon name="plus" size={15} /> {cta}
        </button>
      ) : null}
    </div>
  );
}
