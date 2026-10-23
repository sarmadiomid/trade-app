'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  RANKED_FORMATS,
  RANKS,
  levelFor,
  rankFor,
  rankProgress,
  type BattleProfile,
  type BattleSummary,
  type LeaderboardEntry,
  type QueueStatus,
  type RankedFormat,
} from '@/lib/battles';
import { faNum } from '@/lib/locale/jalali';
import { HomeShell, ShellMenuButton, ShellTools } from '../home/HomeShell';
import { initials } from '../platform/AppHeader';
import { api, type Me } from '../platform/api';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';
import { BattleLobby } from './BattleLobby';
import { NewBattleDialog } from './NewBattleDialog';
import { RankEmblem } from './RankEmblem';
import {
  RANK_FA,
  STATUS,
  WIN_FA,
  ago,
  battleTitle,
  clockFa,
  compactMoney,
  faMessage,
  minutes,
  ordinal,
  pctClass,
  rankLabel,
  signed,
  signedPct,
  traders,
  winConditionName,
} from './format';

type Tab = 'battles' | 'profile' | 'history' | 'ranked' | 'tournaments';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'battles', label: 'نبردها' },
  { id: 'profile', label: 'پروفایل' },
  { id: 'history', label: 'تاریخچه' },
  { id: 'ranked', label: 'رتبه‌ای' },
  { id: 'tournaments', label: 'تورنمنت' },
];

function readTab(raw: string | null): Tab {
  if (raw === 'profile' || raw === 'leaderboard') return 'profile';
  if (raw === 'history' || raw === 'mine') return 'history';
  if (raw === 'ranked' || raw === 'play') return 'ranked';
  if (raw === 'tournaments') return 'tournaments';
  return 'battles';
}

/** `/battle`: the Battles home: play (ranked matchmaking, custom battles), browse, history, leaderboard. */
export default function BattlesHub({ user }: { readonly user: Me }) {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(readTab(params.get('tab')));
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
    <HomeShell
      user={{ ...user, name }}
      notices={active ? 1 : 0}
      noticeMenu={
        active ? (
          <Link
            href={`/battle/${active.id}`}
            className="rounded-lg px-2 py-2 text-[13px] hover:bg-[var(--h-chip)]"
          >
            در نبرد هستید: {battleTitle(active.name)}
          </Link>
        ) : null
      }
    >
      <div className="flex items-center gap-2 px-4 pt-4 sm:px-6">
        <ShellMenuButton />
        <div className="ms-auto">
          <ShellTools />
        </div>
      </div>
      <main className="relative mx-auto min-h-0 w-full max-w-[1400px] flex-1 overflow-y-auto px-4 pb-16 pt-3 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="نبردها" className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => select(t.id)}
                data-testid={`tab-${t.id}`}
                className={`inline-flex h-11 shrink-0 items-center border-b-2 px-3 text-[14px] font-medium transition ${
                  tab === t.id
                    ? 'border-[var(--h-text)] text-[var(--h-text)]'
                    : 'border-transparent text-[var(--h-muted)] hover:text-[var(--h-text)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <JoinById />
        </div>

        {active ? (
          <Link
            href={`/battle/${active.id}`}
            className="mb-4 flex items-center gap-3 rounded-xl border border-up/40 bg-up/10 px-4 py-3 text-[13.5px] transition hover:bg-up/15"
          >
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-up" />
            <span className="flex-1">
              <span className="font-semibold">نبرد در جریان است:</span> {battleTitle(active.name)}
            </span>
            <span className="font-semibold text-up">بازگشت</span>
          </Link>
        ) : null}

        {tab === 'battles' ? (
          <BattleLobby
            profile={profile}
            onCreate={() => setCreating(true)}
            onRanked={() => select('ranked')}
          />
        ) : null}
        {tab === 'profile' ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <LeaderboardTab />
            <ProfilePanel profile={profile} onRenamed={loadProfile} />
          </div>
        ) : null}
        {tab === 'history' ? <MineTab /> : null}
        {tab === 'ranked' ? (
          <PlayTab
            profile={profile}
            autoQueue={autoQueue}
            onCustom={() => setCreating(true)}
            onBrowse={() => select('battles')}
            onMatched={(id) => router.push(`/battle/${id}`)}
          />
        ) : null}
        {tab === 'tournaments' ? (
          <EmptyState
            icon="trophy"
            title="تورنمنت باز نیست"
            text="مسابقه‌های فصلی هنوز شروع نشده‌اند. تا آن زمان در نبردهای آزاد و رتبه‌ای شرکت کن."
            cta="نبردهای آزاد"
            onClick={() => select('battles')}
          />
        ) : null}
      </main>
      {creating ? (
        <NewBattleDialog
          hostName={name}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`/battle/${id}`)}
        />
      ) : null}
    </HomeShell>
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
      setError(err instanceof Error ? faMessage(err.message) : faMessage('Could not join'));
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
        placeholder="شناسه نبرد"
        aria-label="شناسه نبرد"
        maxLength={8}
        dir="ltr"
        data-testid="join-code"
        className={`h-10 w-36 rounded-s-lg border bg-panel px-3 text-center font-mono text-[13px] tracking-widest outline-none focus:border-accent ${
          error ? 'border-down' : 'border-line'
        }`}
      />
      <button
        type="submit"
        disabled={busy || !code.trim()}
        className="h-10 rounded-e-lg border border-s-0 border-line bg-panel px-3 text-[13px] font-medium hover:bg-hover disabled:opacity-50"
      >
        {busy ? '…' : 'ورود'}
      </button>
      {error ? (
        <span className="absolute start-0 top-11 whitespace-nowrap text-[11.5px] text-down">
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
      setError(
        e instanceof Error ? faMessage(e.message) : faMessage('Could not start matchmaking'),
      );
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
          title="رتبه‌ای"
          text="حریف‌یابی تو را با معامله‌گری هم‌سطح خودت جفت می‌کند. نتیجه این نبردها امتیاز الو را جابه‌جا می‌کند."
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
          title="آزاد"
          text="نبرد سفارشی با قانون‌های خودت. امتیاز الو این‌جا تکان نمی‌خورد."
        />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ActionCard
            icon="swords"
            title="نبرد سفارشی بساز"
            text="نوع نبرد، حداکثر پنج نماد، موجودی، زمان و سقف افت را خودت تعیین کن. شناسه را برای دوستانت بفرست."
            cta="نبرد تازه"
            onClick={onCustom}
            testId="custom-battle"
          />
          <ActionCard
            icon="globe"
            title="به لابی عمومی بپیوند"
            text="نبردهای باز را ببین؛ آن‌هایی که هنوز شروع نشده‌اند، یا در جریان‌اند و ورود دیرهنگام را قبول می‌کنند."
            cta="نبردهای عمومی"
            onClick={onBrowse}
          />
        </div>
      </section>

      <section>
        <SectionTitle icon="info" title="نبرد چطور پیش می‌رود" />
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            [
              'بپیوند یا بساز',
              'برای نبرد رتبه‌ای صف بکش، به یک لابی برو، یا خودت نبرد بساز و شناسه‌اش را بفرست.',
            ],
            [
              'همان کندل‌ها را معامله کن',
              'با پایان شمارش، همه یک بازار را می‌بینند؛ کندل به کندل و روی یک ساعت مشترک. سفارش بازار، لیمیت و استاپ، با حد ضرر و حد سود.',
            ],
            [
              'ببر و رتبه بگیر',
              'بیشترین بازده، یا اولین رسیدن به هدف سود، برنده است. اگر از سقف افت رد شوی حذف می‌شوی. در پایان، الو و امتیاز ترکیبی به‌روز می‌شود.',
            ],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-xl border border-line bg-panel p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-[12px] font-bold text-accent">
                {faNum(i + 1)}
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
    'یک‌به‌یک',
    minutes(s.durationMin),
    WIN_FA[s.winCondition].name,
    compactMoney(s.startingBalance),
    s.profitTargetPct ? `هدف +${faNum(s.profitTargetPct)}٪` : null,
    s.maxDrawdownPct ? `افت ${faNum(s.maxDrawdownPct)}٪` : null,
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
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
            {format.id === 'duel'
              ? 'همان نبرد کلاسیک: ده دقیقه، بیشترین بازده برنده است.'
              : 'سریع و تیز: هرکس زودتر معامله را روی ۲٪ سود ببندد، برنده است.'}
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
        <Icon name="bolt" size={16} /> {searching ? 'در حال جست‌وجو…' : 'پیدا کردن حریف'}
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
        {cta} <Icon name="chevronRight" size={15} className="rtl:-scale-x-100" />
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
      aria-label="حریف‌یابی"
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
          {matched ? 'حریف پیدا شد' : 'در حال پیدا کردن حریف'}
        </h2>
        {matched ? (
          <p className="mt-1 text-[13px] text-muted">نبرد در حال باز شدن است…</p>
        ) : queue.status === 'searching' ? (
          <>
            <p className="mt-1 text-[13px] text-muted">
              {format?.name ?? 'رتبه‌ای'} · {format?.summary}
            </p>
            <p className="mt-4 font-mono text-[28px] font-bold tabular-nums" dir="ltr">
              {clockFa(`${Math.floor(waited / 60)}:${String(waited % 60).padStart(2, '0')}`)}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              بازه الو ±{faNum(queue.range)} · {traders(queue.searching)} در جست‌وجو
            </p>
            <button
              type="button"
              onClick={onCancel}
              data-testid="cancel-search"
              className="mt-5 inline-flex h-9 items-center rounded-lg border border-line px-4 text-[13px] hover:bg-hover"
            >
              لغو
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
      (e: unknown) =>
        setError(e instanceof Error ? faMessage(e.message) : faMessage('Could not load battles')),
    );
  }, [tab]);
  useEffect(() => {
    load();
    const t = window.setInterval(load, 5000);
    return () => window.clearInterval(t);
  }, [load]);
  return { list, error, reload: load };
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
          title="هنوز نبردی نداری"
          text="نبردهایی که می‌سازی یا به آن‌ها می‌پیوندی، با نتیجه‌ات این‌جا می‌آیند."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[640px] text-[13px]" data-testid="my-battles">
            <thead>
              <tr className="text-start text-[11.5px] text-muted">
                <th className="px-4 py-2.5 font-medium">نبرد</th>
                <th className="px-3 py-2.5 font-medium">حالت</th>
                <th className="px-3 py-2.5 font-medium">وضعیت</th>
                <th className="px-3 py-2.5 text-end font-medium">رتبه</th>
                <th className="px-3 py-2.5 text-end font-medium">بازده</th>
                <th className="px-3 py-2.5 text-end font-medium">الو</th>
                <th className="px-4 py-2.5 text-end font-medium">زمان</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => {
                const [label, cls] = STATUS[b.status];
                return (
                  <tr key={b.id} className="border-t border-line hover:bg-hover/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/battle/${b.id}`} className="font-medium hover:text-accent">
                        {battleTitle(b.name)}
                      </Link>
                      <div className="text-[11.5px] text-muted">
                        {winConditionName(b.winCondition)} · {traders(b.participants)}
                        {b.winnerName ? ` · برنده ${b.winnerName}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${b.mode === 'ranked' ? 'bg-accent/15 text-accent' : 'bg-hover text-muted'}`}
                      >
                        {b.mode === 'ranked' ? 'رتبه‌ای' : 'آزاد'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-end font-semibold tabular-nums">
                      {b.myPlace ? `${ordinal(b.myPlace)} از ${faNum(b.participants)}` : '—'}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-end font-semibold tabular-nums ${b.myReturn === null ? 'text-muted' : pctClass(b.myReturn)}`}
                    >
                      {b.myReturn === null ? '—' : signedPct(b.myReturn)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-end tabular-nums ${b.myEloChange === null ? 'text-muted' : b.myEloChange >= 0 ? 'text-up' : 'text-down'}`}
                    >
                      {b.myEloChange === null ? '—' : signed(b.myEloChange)}
                    </td>
                    <td className="px-4 py-2.5 text-end text-muted">{ago(b.createdAt, now)}</td>
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
            ['elo', 'الو'],
            ['xp', 'امتیاز ترکیبی'],
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
        <span className="ms-auto text-[12px] text-muted">
          {sort === 'elo'
            ? 'امتیاز رتبه‌ای؛ بعد از هر نبرد رتبه‌ای به‌روز می‌شود'
            : 'امتیازی که در هر نبرد، برد یا باخت، جمع می‌شود'}
        </span>
      </div>
      {entries === null ? (
        <ListSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState
          icon="trophy"
          title="جدول هنوز خالی است"
          text={
            sort === 'elo'
              ? 'یک نبرد رتبه‌ای را ببر تا صدر جدول مال تو شود.'
              : 'یک نبرد را تمام کن تا امتیاز ترکیبی بگیری.'
          }
        />
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full min-w-[560px] text-[13px]" data-testid="leaderboard">
            <thead>
              <tr className="text-start text-[11.5px] text-muted">
                <th className="w-14 px-4 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">معامله‌گر</th>
                <th className="px-3 py-2.5 font-medium">رتبه</th>
                <th className="px-3 py-2.5 text-end font-medium">الو</th>
                <th className="px-3 py-2.5 text-end font-medium">برد / باخت</th>
                <th className="px-4 py-2.5 text-end font-medium">امتیاز</th>
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
                        {faNum(e.place)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-hover text-[10.5px] font-bold">
                          {initials(e.name)}
                        </span>
                        <span className="font-medium">{e.name}</span>
                        {e.isMe ? (
                          <span className="text-[10.5px] font-semibold text-accent">تو</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <RankEmblem elo={e.elo} size={20} />
                        <span className="font-medium" style={{ color: rank.color }}>
                          {RANK_FA[rank.id] ?? rank.name}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-end font-semibold tabular-nums">
                      {faNum(e.elo)}
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums text-muted">
                      {faNum(e.rankedWins)}/{faNum(e.rankedGames - e.rankedWins)}
                    </td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{faNum(e.xp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-5 rounded-xl border border-line bg-panel p-4">
        <h3 className="text-[13px] font-semibold">رتبه‌ها</h3>
        <ol className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {RANKS.map((r) => (
            <li key={r.id} className="flex flex-col items-center gap-1 text-center">
              <RankEmblem elo={r.min} size={34} />
              <span className="text-[11.5px] font-semibold" style={{ color: r.color }}>
                {RANK_FA[r.id] ?? r.name}
              </span>
              <span className="text-[10.5px] tabular-nums text-muted">
                {r.min === 0 ? `زیر ${faNum(1100)}` : `${faNum(r.min)}+`}
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
      ? `${faNum(Math.round((profile.rankedWins / profile.rankedGames) * 100))}٪`
      : '—';
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/api/battles/profile', { method: 'PATCH', body: { name } });
      setEditing(false);
      setError(null);
      onRenamed();
    } catch (err) {
      setError(err instanceof Error ? faMessage(err.message) : faMessage('Could not save'));
    }
  };
  const stats: Array<[string, ReactNode]> = [
    ['نبردها', faNum(profile.battles)],
    ['بردها', faNum(profile.wins)],
    ['سکو', faNum(profile.podiums)],
    ['برد رتبه‌ای', winRate],
    ['بهترین برد پیاپی', faNum(profile.bestStreak)],
    [
      'برد معاملات',
      profile.trades > 0
        ? `${faNum(Math.round((profile.winningTrades / profile.trades) * 100))}٪`
        : '—',
    ],
    [
      'میانگین بازده',
      profile.avgReturn === null ? (
        '—'
      ) : (
        <span className={pctClass(profile.avgReturn)}>{signedPct(profile.avgReturn)}</span>
      ),
    ],
    [
      'بهترین بازده',
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
                aria-label="نام نمایشی"
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-chart px-3 text-[13px] outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-accent px-3 text-[13px] font-semibold text-accent-fg"
              >
                ذخیره
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-9 rounded-lg border border-line px-2 text-[13px]"
                aria-label="لغو"
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
                aria-label="ویرایش نام نمایشی"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
              >
                <Icon name="edit" size={14} />
              </button>
            </div>
          )}
          {error ? <p className="mt-1 text-[11.5px] text-down">{error}</p> : null}
          <p className="mt-1 text-[13px]">
            <span className="font-semibold" style={{ color: rank.color }}>
              {rankLabel(profile.elo)}
            </span>{' '}
            · <span className="font-semibold tabular-nums">{faNum(profile.elo)}</span>{' '}
            <span className="text-muted">الو</span>
            {profile.globalRank ? (
              <span className="text-muted"> · رتبه {faNum(profile.globalRank)}</span>
            ) : null}
          </p>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-[11.5px] text-muted">
            <span>اوج {faNum(profile.peakElo)}</span>
            <span>
              {next
                ? `${faNum(next.min - profile.elo)} تا ${RANK_FA[next.id] ?? next.name}`
                : 'بالاترین رتبه'}
            </span>
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
            <span className="font-medium">امتیاز ترکیبی · سطح {faNum(lvl.level)}</span>
            <span className="tabular-nums text-muted">{faNum(profile.xp)} امتیاز</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(lvl.into / lvl.needed) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {faNum(lvl.needed - lvl.into)} امتیاز تا سطح {faNum(lvl.level + 1)}
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
