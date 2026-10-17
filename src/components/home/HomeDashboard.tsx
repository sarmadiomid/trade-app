'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { browserBacktestServices } from '@/lib/app';
import type { SessionSummary } from '@/lib/backtest';
import {
  levelFor,
  rankFor,
  rankProgress,
  type BattleProfile,
  type BattleSummary,
} from '@/lib/battles';
import { RankEmblem } from '../battles/RankEmblem';
import {
  ASSET_COLORS,
  STATUS,
  compactMoney,
  pctClass,
  signedPct,
  winConditionName,
} from '../battles/format';
import { useThemeCssVars } from '../hooks/useThemeCssVars';
import { AppHeader } from '../platform/AppHeader';
import { api, type Me } from '../platform/api';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';

type Loaded<T> = T | null | 'error';

/** `/home`: the signed-in dashboard and the entry point to Chart, Backtest and Battles. */
export function HomeDashboard({ user }: { readonly user: Me }) {
  useThemeCssVars();
  const [profile, setProfile] =
    useState<Loaded<{ profile: BattleProfile; active: BattleSummary | null }>>(null);
  const [lobbies, setLobbies] = useState<Loaded<BattleSummary[]>>(null);
  const [sessions, setSessions] = useState<Loaded<SessionSummary[]>>(null);

  useEffect(() => {
    void api<{ profile: BattleProfile; active: BattleSummary | null }>('/api/battles/profile').then(
      setProfile,
      () => setProfile('error'),
    );
    void api<{ battles: BattleSummary[] }>('/api/battles?tab=browse').then(
      (r) => setLobbies(r.battles),
      () => setLobbies('error'),
    );
    void browserBacktestServices()
      .repo.list()
      .then(
        (list) => setSessions([...list].sort((a, b) => b.updatedAt - a.updatedAt)),
        () => setSessions('error'),
      );
  }, []);

  const prof = profile && profile !== 'error' ? profile.profile : null;
  const active = profile && profile !== 'error' ? profile.active : null;
  const sessionList = sessions && sessions !== 'error' ? sessions : [];
  const inProgress = sessionList.filter((s) => s.status === 'in-progress').length;
  const lobbyList = lobbies && lobbies !== 'error' ? lobbies : [];

  return (
    <div className="h-full overflow-y-auto bg-chart text-fg">
      <AppHeader user={user} />
      <div className="pointer-events-none absolute inset-x-0 top-14 h-[420px] bg-[radial-gradient(60%_80%_at_20%_0%,rgba(41,98,255,0.18),transparent_70%),radial-gradient(40%_60%_at_90%_10%,rgba(56,211,255,0.08),transparent_70%)]" />
      <main className="relative mx-auto max-w-[1400px] px-4 pb-16 pt-8 sm:px-6">
        {/* Greeting */}
        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="animate-pop">
            <p className="text-[13px] font-medium text-muted">Welcome back,</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">
              {user.name}
            </h1>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-muted">
              Chart the markets, test a strategy on history, or battle other traders on the same
              candles.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label="Rating" value={prof ? String(prof.elo) : '—'}>
              {prof ? <RankEmblem elo={prof.elo} size={22} /> : null}
            </Stat>
            <Stat
              label="Composite"
              value={prof ? `Lv ${levelFor(prof.xp).level}` : '—'}
              sub={prof ? `${prof.xp.toLocaleString('en-US')} XP` : undefined}
            />
            <Stat
              label="Backtests"
              value={sessions === null ? '—' : String(sessionList.length)}
              sub={sessions === null ? undefined : `${inProgress} in progress`}
            />
          </dl>
        </section>

        {active ? <ActiveBattleBanner battle={active} /> : null}

        {/* Entry points */}
        <section aria-label="Sections" className="mt-8 grid gap-4 md:grid-cols-3">
          <EntryCard
            href="/chart"
            icon="chart"
            eyebrow="Analysis"
            title="Chart"
            text="A full charting workspace: 20+ chart types, drawing tools, bar replay and themes, saved to your account."
            cta="Open chart"
            art={<ChartArt />}
            meta={[
              ['Timeframes', '11'],
              ['Drawing tools', '20+'],
            ]}
          />
          <EntryCard
            href="/backtest"
            icon="replay"
            eyebrow="Practice"
            title="Backtest"
            text="Replay any date range candle by candle, trade it with a virtual account and review the analytics."
            cta={inProgress > 0 ? 'Continue backtesting' : 'Start a session'}
            art={<BacktestArt />}
            meta={[
              ['Sessions', sessions === null ? '—' : String(sessionList.length)],
              ['In progress', sessions === null ? '—' : String(inProgress)],
            ]}
          />
          <EntryCard
            href="/battle"
            icon="swords"
            eyebrow="Compete"
            title="Battles"
            badge="New"
            highlight
            text="Trade the same historical market head-to-head in real time. Ranked matches move your Elo from Rookie to Master."
            cta="Enter Battles"
            art={<BattleArt />}
            meta={[
              ['Rank', prof ? rankFor(prof.elo).name : '—'],
              ['Open lobbies', lobbies === null ? '—' : String(lobbyList.length)],
            ]}
          />
        </section>

        {/* Activity */}
        <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Panel
              title="Continue backtesting"
              action={
                <Link
                  href="/backtest"
                  className="text-[12.5px] font-medium text-accent hover:underline"
                >
                  All sessions
                </Link>
              }
            >
              {sessions === null ? (
                <Skeleton rows={3} />
              ) : sessionList.length === 0 ? (
                <Empty
                  icon="replay"
                  text="No backtesting sessions yet. Pick an asset and a date range to replay."
                  href="/backtest"
                  cta="Create a session"
                />
              ) : (
                <ul className="divide-y divide-line">
                  {sessionList.slice(0, 4).map((s) => (
                    <SessionRow key={s.id} s={s} />
                  ))}
                </ul>
              )}
            </Panel>
            <Panel
              title="Open battles"
              action={
                <Link
                  href="/battle?tab=browse"
                  className="text-[12.5px] font-medium text-accent hover:underline"
                >
                  Browse all
                </Link>
              }
            >
              {lobbies === null ? (
                <Skeleton rows={3} />
              ) : lobbyList.length === 0 ? (
                <Empty
                  icon="swords"
                  text="No public battles are open right now. Create one and invite other traders."
                  href="/battle?new=1"
                  cta="New battle"
                />
              ) : (
                <ul className="divide-y divide-line">
                  {lobbyList.slice(0, 5).map((b) => (
                    <LobbyRow key={b.id} b={b} />
                  ))}
                </ul>
              )}
            </Panel>
          </div>
          <ProfileCard profile={prof} failed={profile === 'error'} />
        </section>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  children,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub?: string | undefined;
  readonly children?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-panel/70 px-3 py-2.5 sm:min-w-36 sm:px-4">
      <dt className="truncate text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-1.5">
        {children}
        <span className="text-[18px] font-bold tabular-nums leading-none">{value}</span>
      </dd>
      {sub ? <dd className="mt-1 truncate text-[11.5px] text-muted">{sub}</dd> : null}
    </div>
  );
}

function ActiveBattleBanner({ battle }: { readonly battle: BattleSummary }) {
  const [label, cls] = STATUS[battle.status];
  return (
    <Link
      href={`/battle/${battle.id}`}
      className="group mt-6 flex items-center gap-3 rounded-xl border border-up/40 bg-up/10 px-4 py-3 transition hover:bg-up/15"
      data-testid="active-battle"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-up" />
      </span>
      <span className="min-w-0 flex-1 text-[13.5px]">
        <span className="font-semibold">You are in a battle:</span>{' '}
        <span className="truncate">{battle.name}</span>{' '}
        <span className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-up">
        Rejoin <Icon name="chevronRight" size={15} />
      </span>
    </Link>
  );
}

function EntryCard({
  href,
  icon,
  eyebrow,
  title,
  text,
  cta,
  art,
  meta,
  badge,
  highlight = false,
}: {
  readonly href: string;
  readonly icon: IconName;
  readonly eyebrow: string;
  readonly title: string;
  readonly text: string;
  readonly cta: string;
  readonly art: ReactNode;
  readonly meta: ReadonlyArray<readonly [string, string]>;
  readonly badge?: string;
  readonly highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      data-testid={`entry-${title.toLowerCase()}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-panel transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-24px_rgba(41,98,255,0.55)] ${
        highlight ? 'border-accent/50' : 'border-line hover:border-accent/40'
      }`}
    >
      <div className="relative h-36 overflow-hidden border-b border-line bg-[linear-gradient(180deg,rgba(41,98,255,0.10),transparent)]">
        {art}
        {badge ? (
          <span className="absolute right-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-accent-fg">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wider text-accent">
          <Icon name={icon} size={14} />
          {eyebrow}
        </div>
        <h2 className="mt-1.5 text-[19px] font-bold tracking-tight">{title}</h2>
        <p className="mt-1.5 flex-1 text-[13px] leading-6 text-muted">{text}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3">
          {meta.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] text-muted">{k}</dt>
              <dd className="text-[13.5px] font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <span
          className={`mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition ${
            highlight
              ? 'bg-accent text-accent-fg group-hover:brightness-110'
              : 'border border-line group-hover:bg-hover'
          }`}
        >
          {cta}
          <Icon name="chevronRight" size={15} />
        </span>
      </div>
    </Link>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  readonly title: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel">
      <header className="flex h-12 items-center justify-between border-b border-line px-4">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {action}
      </header>
      <div className="px-2 py-1">{children}</div>
    </section>
  );
}

function Skeleton({ rows }: { readonly rows: number }) {
  return (
    <div className="flex flex-col gap-2 p-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg bg-hover/60" />
      ))}
    </div>
  );
}

function Empty({
  icon,
  text,
  href,
  cta,
}: {
  readonly icon: IconName;
  readonly text: string;
  readonly href: string;
  readonly cta: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Icon name={icon} size={18} />
      </span>
      <p className="max-w-sm text-[13px] text-muted">{text}</p>
      <Link
        href={href}
        className="inline-flex h-8 items-center gap-1 rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg hover:brightness-110"
      >
        <Icon name="plus" size={15} /> {cta}
      </Link>
    </div>
  );
}

function SessionRow({ s }: { readonly s: SessionSummary }) {
  const pnl = s.balance - s.startingBalance;
  const ret = (pnl / s.startingBalance) * 100;
  const progress = Math.max(
    0,
    Math.min(1, (s.cursor - s.startDate) / (s.endDate + 86_400_000 - s.startDate)),
  );
  return (
    <li>
      <Link
        href={`/backtest/${s.id}`}
        className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-hover"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
          style={{
            background: `${ASSET_COLORS[s.symbol] ?? '#5b8cff'}22`,
            color: ASSET_COLORS[s.symbol] ?? '#5b8cff',
          }}
        >
          {s.symbol.slice(0, 3)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium">{s.name}</span>
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1 w-24 overflow-hidden rounded-full bg-line">
              <span className="block h-full bg-accent" style={{ width: `${progress * 100}%` }} />
            </span>
            <span className="text-[11.5px] text-muted">
              {s.symbol} · {s.trades} trades
            </span>
          </span>
        </span>
        <span className="text-right">
          <span className={`block text-[13px] font-semibold tabular-nums ${pctClass(ret)}`}>
            {signedPct(ret)}
          </span>
          <span className="block text-[11.5px] text-muted">
            {s.status === 'in-progress'
              ? 'In progress'
              : s.status === 'completed'
                ? 'Completed'
                : 'Failed'}
          </span>
        </span>
      </Link>
    </li>
  );
}

function LobbyRow({ b }: { readonly b: BattleSummary }) {
  const [label, cls] = STATUS[b.status];
  return (
    <li>
      <Link
        href={`/battle/${b.id}`}
        className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-hover"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon name="swords" size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-medium">{b.name}</span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-medium ${cls}`}>
              {label}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[11.5px] text-muted">
            {winConditionName(b.winCondition)} · {compactMoney(b.startingBalance)} · {b.durationMin}{' '}
            min · {b.assets.join(', ')}
          </span>
        </span>
        <span className="flex items-center gap-1 text-[12px] tabular-nums text-muted">
          <Icon name="users" size={14} />
          {b.participants}/{b.maxParticipants}
        </span>
      </Link>
    </li>
  );
}

function ProfileCard({
  profile,
  failed,
}: {
  readonly profile: BattleProfile | null;
  readonly failed: boolean;
}) {
  if (!profile) {
    return (
      <aside className="rounded-2xl border border-line bg-panel p-5">
        {failed ? (
          <p className="text-[13px] text-muted">Your battle profile could not be loaded.</p>
        ) : (
          <Skeleton rows={4} />
        )}
      </aside>
    );
  }
  const rank = rankFor(profile.elo);
  const { next, progress } = rankProgress(profile.elo);
  const lvl = levelFor(profile.xp);
  const winRate = profile.rankedGames > 0 ? (profile.rankedWins / profile.rankedGames) * 100 : null;
  return (
    <aside
      className="relative overflow-hidden rounded-2xl border border-line bg-panel"
      data-testid="home-profile"
    >
      <div
        className="absolute inset-x-0 top-0 h-28 opacity-40"
        style={{
          background: `radial-gradient(80% 100% at 50% 0%, ${rank.color}55, transparent 70%)`,
        }}
      />
      <div className="relative p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">Battle profile</h2>
          {profile.globalRank ? (
            <span className="rounded-full bg-hover px-2 py-0.5 text-[11.5px] font-medium tabular-nums text-muted">
              #{profile.globalRank} global
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <RankEmblem elo={profile.elo} size={64} />
          <div className="min-w-0">
            <div className="text-[18px] font-bold" style={{ color: rank.color }}>
              {rank.name}
            </div>
            <div className="text-[13px] text-muted">
              <span className="font-semibold tabular-nums text-fg">{profile.elo}</span> Elo · peak{' '}
              {profile.peakElo}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-[11.5px] text-muted">
            <span>{rank.name}</span>
            <span>{next ? `${next.name} at ${next.min}` : 'Top rank'}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress * 100}%`, background: rank.color }}
            />
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            ['Ranked', String(profile.rankedGames)],
            ['Win rate', winRate === null ? '—' : `${winRate.toFixed(0)}%`],
            ['Streak', String(profile.winStreak)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-chart/60 py-2">
              <dt className="text-[11px] text-muted">{k}</dt>
              <dd className="text-[15px] font-bold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 rounded-lg border border-line p-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium">Composite Score · Level {lvl.level}</span>
            <span className="tabular-nums text-muted">
              {lvl.into}/{lvl.needed} XP
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(lvl.into / lvl.needed) * 100}%` }}
            />
          </div>
        </div>
        <Link
          href="/battle?tab=play"
          className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-[13.5px] font-semibold text-accent-fg transition hover:brightness-110"
        >
          <Icon name="bolt" size={16} /> Find a ranked match
        </Link>
      </div>
    </aside>
  );
}

/* ---- card illustrations (decorative) ---- */

function ChartArt() {
  const candles = [
    [10, 62, 48, 70, 40],
    [26, 50, 58, 64, 44],
    [42, 56, 38, 60, 30],
    [58, 40, 46, 52, 34],
    [74, 46, 30, 50, 24],
    [90, 32, 40, 46, 26],
    [106, 40, 26, 44, 20],
    [122, 28, 34, 40, 22],
    [138, 34, 20, 38, 14],
    [154, 22, 28, 32, 16],
    [170, 28, 14, 30, 10],
  ];
  return (
    <svg
      viewBox="0 0 190 90"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-x-6 bottom-3 top-5 h-[calc(100%-2rem)] w-[calc(100%-3rem)]"
      aria-hidden="true"
    >
      <path d="M0 70 L190 10" stroke="var(--tc-accent)" strokeOpacity=".35" strokeDasharray="3 4" />
      {candles.map(([x, o, c, h, l]) => {
        const up = c! < o!;
        const color = up ? 'var(--tc-up)' : 'var(--tc-down)';
        return (
          <g key={x}>
            <line x1={x} x2={x} y1={l} y2={h} stroke={color} />
            <rect
              x={x! - 4}
              y={Math.min(o!, c!)}
              width="8"
              height={Math.max(2, Math.abs(o! - c!))}
              rx="1"
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}

function BacktestArt() {
  return (
    <svg
      viewBox="0 0 190 90"
      className="absolute inset-x-6 bottom-3 top-5 h-[calc(100%-2rem)] w-[calc(100%-3rem)]"
      aria-hidden="true"
    >
      <rect x="96" y="12" width="94" height="22" fill="var(--tc-up)" opacity=".14" />
      <rect x="96" y="34" width="94" height="12" fill="var(--tc-down)" opacity=".14" />
      <line
        x1="96"
        x2="190"
        y1="34"
        y2="34"
        stroke="var(--tc-text)"
        strokeOpacity=".5"
        strokeDasharray="3 3"
      />
      <path
        d="M0 64 L16 58 L30 66 L46 52 L60 56 L76 44 L96 40"
        stroke="var(--tc-accent)"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M96 40 L112 46 L128 36 L146 40 L164 26 L190 22"
        stroke="var(--tc-muted)"
        strokeOpacity=".35"
        strokeWidth="2.2"
        fill="none"
        strokeDasharray="2 4"
      />
      <line x1="96" x2="96" y1="0" y2="90" stroke="#38d3ff" strokeWidth="1.5" />
      <g transform="translate(64 70)">
        <rect width="64" height="16" rx="8" fill="var(--tc-panel)" stroke="var(--tc-border)" />
        <path d="M14 4l6 4-6 4z" fill="var(--tc-text)" />
        <path d="M28 4v8M32 4v8" stroke="var(--tc-text)" strokeWidth="1.6" />
        <path
          d="M42 4l5 4-5 4zM48 4v8"
          fill="var(--tc-text)"
          stroke="var(--tc-text)"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}

function BattleArt() {
  return (
    <svg
      viewBox="0 0 190 90"
      className="absolute inset-x-6 bottom-3 top-5 h-[calc(100%-2rem)] w-[calc(100%-3rem)]"
      aria-hidden="true"
    >
      <path
        d="M0 60 C 30 52, 50 66, 80 48 S 130 30, 190 22"
        stroke="var(--tc-accent)"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M0 62 C 30 64, 60 50, 90 58 S 140 50, 190 44"
        stroke="#ff5c7a"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="190" cy="22" r="0" />
      <g transform="translate(78 14)">
        <rect width="34" height="20" rx="10" fill="var(--tc-panel)" stroke="var(--tc-border)" />
        <text
          x="17"
          y="14"
          textAnchor="middle"
          fontSize="10"
          fontWeight="800"
          fill="var(--tc-text)"
        >
          VS
        </text>
      </g>
      <g transform="translate(6 70)">
        <rect width="58" height="16" rx="8" fill="var(--tc-accent)" fillOpacity=".18" />
        <text
          x="29"
          y="11.5"
          textAnchor="middle"
          fontSize="9"
          fontWeight="700"
          fill="var(--tc-accent)"
        >
          +2.41%
        </text>
      </g>
      <g transform="translate(126 70)">
        <rect width="58" height="16" rx="8" fill="#ff5c7a" fillOpacity=".18" />
        <text x="29" y="11.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#ff5c7a">
          +0.87%
        </text>
      </g>
    </svg>
  );
}
