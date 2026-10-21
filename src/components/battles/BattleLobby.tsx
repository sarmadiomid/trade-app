'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  RANKS,
  START_ELO,
  rankFor,
  rankProgress,
  type BattleProfile,
  type BattleSummary,
} from '@/lib/battles';
import { faNum } from '@/lib/locale/jalali';
import { initials } from '../platform/AppHeader';
import { api } from '../platform/api';
import { Icon } from '../ui/Icon';
import { ASSET_COLORS, RANK_FA, STATUS, ago, battleTitle, faMessage, minutes } from './format';

type Sub = 'all' | 'mine' | 'help';
type Filter = 'all' | 'standby' | 'live';

const card = 'rounded-2xl border border-line bg-panel';

/** Battles home: Elo, open lobbies and the player rail, in the reference layout. */
export function BattleLobby({
  profile,
  onCreate,
  onRanked,
}: {
  readonly profile: BattleProfile | null;
  readonly onCreate: () => void;
  readonly onRanked: () => void;
}) {
  const router = useRouter();
  const [sub, setSub] = useState<Sub>('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [browse, setBrowse] = useState<BattleSummary[] | null>(null);
  const [mine, setMine] = useState<BattleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancel = false;
    const load = () => {
      void api<{ battles: BattleSummary[] }>('/api/battles?tab=browse').then(
        (r) => {
          if (cancel) return;
          setBrowse(r.battles);
          setError(null);
          setNow(Date.now());
        },
        (e: unknown) => {
          if (!cancel)
            setError(
              e instanceof Error ? faMessage(e.message) : faMessage('Could not load battles'),
            );
        },
      );
      void api<{ battles: BattleSummary[] }>('/api/battles?tab=mine').then(
        (r) => !cancel && setMine(r.battles),
        () => !cancel && setMine([]),
      );
    };
    load();
    const t = window.setInterval(load, 5000);
    return () => {
      cancel = true;
      window.clearInterval(t);
    };
  }, [tick]);

  const source = sub === 'mine' ? mine : browse;
  const shown = (source ?? []).filter((b) => {
    if (filter === 'standby' && b.status !== 'standby' && b.status !== 'countdown') return false;
    if (filter === 'live' && b.status !== 'live' && b.status !== 'paused') return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      (b.hostName ?? '').toLowerCase().includes(q) ||
      b.assets.some((a) => a.toLowerCase().includes(q))
    );
  });

  const joinRandom = () => {
    const open = (browse ?? []).filter(
      (b) =>
        !b.joined &&
        b.participants < b.maxParticipants &&
        (b.status === 'standby' || b.allowLateJoin),
    );
    const pick = open[Math.floor(Math.random() * open.length)];
    if (!pick) {
      setNote('الان نبرد آزادی برای پیوستن نیست.');
      return;
    }
    setNote(null);
    router.push(`/battle/${pick.id}`);
  };

  const elo = profile?.elo ?? START_ELO;
  const rank = rankFor(elo);
  const { next, progress } = rankProgress(elo);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <section className={`${card} px-5 py-4`}>
          <p className="flex items-center gap-1 text-[12px] text-muted">
            امتیاز الو
            <span title="امتیاز نبردهای رتبه‌ای. نبرد آزاد آن را عوض نمی‌کند.">
              <Icon name="info" size={13} />
            </span>
          </p>
          <p className="mt-1 text-[40px] font-bold leading-none tabular-nums">{faNum(elo)}</p>
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-fg/80"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted">
              <span>
                {faNum(rank.min)} · {RANK_FA[rank.id] ?? rank.name}
              </span>
              <span>
                {next
                  ? `${RANK_FA[next.id] ?? next.name} · ${faNum(next.min - 1)}`
                  : 'بالاترین رده'}
              </span>
            </div>
          </div>
        </section>

        <section className={`${card} mt-3 grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-4`}>
          <Mini k="تغییر خالص" v={signedElo((profile?.elo ?? START_ELO) - START_ELO)} />
          <Mini k="اوج" v={faNum(profile?.peakElo ?? START_ELO)} />
          <Mini
            k="بهترین بازده"
            v={
              profile?.bestReturn === null || profile?.bestReturn === undefined
                ? '—'
                : `${faNum(profile.bestReturn, 1)}٪`
            }
          />
          <Mini k="برد پیاپی" v={faNum(profile?.winStreak ?? 0)} />
        </section>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCreate}
            data-testid="new-battle"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-fg"
          >
            <Icon name="plus" size={15} /> نبرد تازه
          </button>
          <button
            type="button"
            onClick={joinRandom}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-medium"
          >
            <Icon name="shuffle" size={15} /> پیوستن تصادفی
          </button>
          <div className="flex-1" />
          <IconBtn label="تازه‌سازی" onClick={() => setTick((n) => n + 1)}>
            <Icon name="rotate" size={16} />
          </IconBtn>
          <IconBtn label="جستجو" pressed={searching} onClick={() => setSearching((v) => !v)}>
            <Icon name="search" size={16} />
          </IconBtn>
          <div className="relative">
            <IconBtn label="فیلتر" pressed={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
              <Icon name="settings" size={16} />
            </IconBtn>
            {filtersOpen ? (
              <div className="absolute end-0 z-20 mt-1 w-36 rounded-xl border border-line bg-panel p-1 shadow-2xl">
                {(
                  [
                    ['all', 'همه'],
                    ['standby', 'در انتظار'],
                    ['live', 'در جریان'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setFilter(id);
                      setFiltersOpen(false);
                    }}
                    className={`block w-full rounded-lg px-3 py-1.5 text-start text-[13px] ${
                      filter === id ? 'bg-hover' : 'hover:bg-hover'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {searching ? (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی نبرد، میزبان یا نماد"
            className="mt-2 h-10 w-full rounded-xl border border-line bg-panel px-3 text-[13px] outline-none focus:border-accent"
          />
        ) : null}
        {note ? <p className="mt-2 text-[12px] text-muted">{note}</p> : null}

        <div className="mt-4 flex gap-4 border-b border-line text-[13px]">
          {(
            [
              ['all', 'همه نبردها'],
              ['mine', 'نبردهای من'],
              ['help', 'نبرد چطور کار می‌کند؟'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSub(id)}
              className={`-mb-px border-b-2 pb-2 ${
                sub === id ? 'border-fg font-semibold' : 'border-transparent text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {sub === 'help' ? (
          <Help />
        ) : error ? (
          <p className="mt-4 text-[13px] text-down">{error}</p>
        ) : source === null ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-panel" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <p className="text-[14px] font-semibold">نبردی با این فیلتر نیست</p>
            <button
              type="button"
              onClick={onCreate}
              className="mt-3 text-[13px] font-semibold text-accent"
            >
              نبرد تازه
            </button>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2" data-testid="browse-list">
            {shown.map((b) => (
              <BattleCard key={b.id} battle={b} now={now ?? b.createdAt} />
            ))}
          </ul>
        )}
      </div>

      <aside className="flex flex-col gap-3">
        <PlayerCard profile={profile} onRanked={onRanked} />
        <RankCard elo={elo} />
      </aside>
    </div>
  );
}

function BattleCard({ battle, now }: { readonly battle: BattleSummary; readonly now: number }) {
  const [label, cls] = STATUS[battle.status];
  return (
    <li>
      <Link
        href={`/battle/${battle.id}`}
        className={`${card} flex h-full flex-col p-4 transition hover:border-accent/40`}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-[15px] font-bold">{battleTitle(battle.name)}</h3>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
            {label}
          </span>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3 text-[12.5px] text-muted">
          <div className="flex flex-col gap-1.5">
            <p className="text-fg/80">
              {battle.winCondition === 'profit-target' ? 'هدف سود' : 'زمان‌دار'}
            </p>
            <p className="flex items-center gap-1.5">
              <Icon name="clock" size={13} /> حد زمان: {minutes(battle.durationMin)}
            </p>
            <p className="flex items-center gap-1.5">
              <Icon name="chevronDown" size={13} /> سقف افت:{' '}
              {battle.maxDrawdownPct === null ? '—' : `${faNum(battle.maxDrawdownPct)}٪`}
            </p>
            <p className="flex items-center gap-1.5">
              <Icon name="chevronDown" size={13} /> سقف روزانه:{' '}
              {battle.maxDailyDrawdownPct === null ? '—' : `${faNum(battle.maxDailyDrawdownPct)}٪`}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1">
              <Icon name="chart" size={13} />
              {battle.assets.map((a) => (
                <span
                  key={a}
                  dir="ltr"
                  className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                  style={{
                    background: `${ASSET_COLORS[a] ?? '#5b8cff'}22`,
                    color: ASSET_COLORS[a] ?? '#8eb6ff',
                  }}
                >
                  {a}
                </span>
              ))}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Icon name="users" size={14} />
            {faNum(battle.participants)}/{faNum(battle.maxParticipants)}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-[12px] text-muted">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hover text-[10px] font-bold text-fg">
            {initials(battle.hostName ?? '؟')}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {battle.hostName ?? 'بدون میزبان'} · شروع: {ago(battle.createdAt, now)}
          </span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line">
            <Icon name="chevronLeft" size={14} />
          </span>
        </div>
      </Link>
    </li>
  );
}

function PlayerCard({
  profile,
  onRanked,
}: {
  readonly profile: BattleProfile | null;
  readonly onRanked: () => void;
}) {
  const elo = profile?.elo ?? START_ELO;
  const rank = rankFor(elo);
  return (
    <section className={`${card} relative p-4`}>
      <button
        type="button"
        aria-label="نبرد رتبه‌ای"
        onClick={onRanked}
        className="absolute end-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-fg"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l12-7z" fill="currentColor" />
        </svg>
      </button>
      <div className="flex items-center gap-3 pe-10">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-hover text-[16px] font-bold">
          {initials(profile?.name ?? '…')}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{profile?.name ?? '…'}</p>
          <p className="text-[12px] text-muted">
            {RANK_FA[rank.id] ?? rank.name} · الو {faNum(elo)}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 text-center">
        <Stat k="برد" v={faNum(profile?.wins ?? 0)} />
        <Stat k="نبرد" v={faNum(profile?.battles ?? 0)} />
        <Stat k="پیاپی" v={faNum(profile?.winStreak ?? 0)} />
      </dl>
    </section>
  );
}

function RankCard({ elo }: { readonly elo: number }) {
  const current = rankFor(elo).id;
  return (
    <section className={`${card} p-4`}>
      <h3 className="text-[14px] font-semibold">رده‌ها</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {RANKS.map((r, i) => (
          <li key={r.id} className="flex items-center gap-2 text-[13px]">
            <span className="w-14 text-[12px] text-muted">{faNum(i + 1)}</span>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
            <span className={r.id === current ? 'font-semibold' : 'text-muted'}>
              {RANK_FA[r.id] ?? r.name}
            </span>
            <span className="ms-auto text-[12px] tabular-nums text-muted">{faNum(r.min)}+</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Help() {
  const steps = [
    ['بپیوند یا بساز', 'نبرد تازه بساز، تصادفی بپیوند، یا برای نبرد رتبه‌ای صف بکش.'],
    ['همان کندل‌ها را معامله کن', 'همه یک بازار را می‌بینند و کندل‌به‌کندل جلو می‌روند.'],
    [
      'ببر و رتبه بگیر',
      'بیشترین بازده، یا رسیدن به هدف سود، برنده است. نبرد رتبه‌ای امتیاز الو را عوض می‌کند.',
    ],
  ];
  return (
    <ol className="mt-4 grid gap-3 md:grid-cols-3">
      {steps.map(([t, d], i) => (
        <li key={t} className={`${card} p-4`}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-[12px] font-bold text-accent">
            {faNum(i + 1)}
          </span>
          <h3 className="mt-2 text-[14px] font-semibold">{t}</h3>
          <p className="mt-1 text-[12.5px] leading-6 text-muted">{d}</p>
        </li>
      ))}
    </ol>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{k}</dt>
      <dd className="mt-1 text-[16px] font-semibold tabular-nums">{v}</dd>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{k}</dt>
      <dd className="mt-0.5 text-[16px] font-bold tabular-nums">{v}</dd>
    </div>
  );
}

function IconBtn({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-line ${
        pressed ? 'bg-hover text-fg' : 'text-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}

function signedElo(n: number): string {
  if (n > 0) return `+${faNum(n)}`;
  if (n < 0) return `−${faNum(Math.abs(n))}`;
  return faNum(0);
}
