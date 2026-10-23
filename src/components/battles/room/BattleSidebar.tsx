'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { faNum } from '@/lib/locale/jalali';
import { formatClock, remainingMs, type BattleView, type Standing } from '@/lib/battles';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/icons';
import {
  STATUS,
  WIN_FA,
  battleTitle,
  clockFa,
  compactMoney,
  faReason,
  pctClass,
  signedPct,
  traders,
} from '../format';
import { BattleChat } from './BattleChat';
import { RulesList } from './RulesList';
import { StandingsList } from './StandingsList';
import { useTicker } from './useBattle';

type Tab = 'leaderboard' | 'chat' | 'rules' | 'admin';

/** In-battle sidebar: live leaderboard, chat, rules and (for the host) the admin controls. */
export function BattleSidebar({
  view,
  meId,
  now,
  refetch,
  onControl,
  onClose,
  className = '',
}: {
  readonly view: BattleView;
  readonly meId: string;
  readonly now: () => number;
  readonly refetch: () => void;
  readonly onControl: (op: 'pause' | 'resume' | 'restart' | 'end') => void;
  /** Closes the drawer (small screens). */
  readonly onClose?: () => void;
  readonly className?: string;
}) {
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [seenChat, setSeenChat] = useState(view.chat.length);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const selectTab = (id: Tab) => {
    if (id === 'chat' || tab === 'chat') setSeenChat(view.chat.length);
    setTab(id);
  };
  const tabs: Array<{ id: Tab; label: string; icon: IconName }> = [
    { id: 'leaderboard', label: 'جدول', icon: 'trophy' },
    { id: 'chat', label: 'گفت‌وگو', icon: 'chat' },
    { id: 'rules', label: 'قانون‌ها', icon: 'list' },
  ];
  if (view.isHost) tabs.push({ id: 'admin', label: 'میزبان', icon: 'shield' });

  const unread = tab === 'chat' ? 0 : Math.max(0, view.chat.length - seenChat);
  const myIndex = view.standings.findIndex((s) => s.userId === meId);
  const myStanding = myIndex >= 0 ? view.standings[myIndex] : undefined;
  const myPlace = myIndex + 1;

  // Horizontal tabs in RTL: ArrowLeft moves to the next tab (visually leftward).
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const ids = tabs.map((item) => item.id);
    const index = ids.indexOf(tab);
    let next = -1;
    if (e.key === 'ArrowLeft') next = (index + 1) % ids.length;
    else if (e.key === 'ArrowRight') next = (index - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    const id = ids[next]!;
    selectTab(id);
    tabRefs.current[id]?.focus();
  };

  return (
    <aside
      aria-label="نبرد"
      data-testid="battle-sidebar"
      dir="rtl"
      className={`h-full min-h-0 w-[min(100vw,340px)] shrink-0 flex-col overflow-hidden border-l border-line bg-panel ${className}`}
    >
      <header className="shrink-0 border-b border-line px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[15px] font-semibold">
                {view.symbol ? <bdi dir="ltr">{view.symbol}</bdi> : battleTitle(view.settings.name)}
              </h2>
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${STATUS[view.status][1]}`}
              >
                {STATUS[view.status][0]}
              </span>
            </div>
            <p className="mt-1 truncate text-[11.5px] text-fg/75">
              {view.mode === 'ranked' ? 'رتبه‌ای' : 'آزاد'}
              {' · '}
              {WIN_FA[view.settings.winCondition].name}
              {' · '}
              {traders(view.standings.length)}
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="پنهان کردن پنل"
              title="پنهان کردن پنل"
              className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-fg/80 transition-colors duration-150 hover:bg-hover hover:text-fg"
            >
              <Icon name="close" size={16} />
            </button>
          ) : null}
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          <Kpi label="جایگاه">
            {myStanding ? (
              <span className="inline-flex items-center gap-1">
                {myPlace === 1 ? <Icon name="crown" size={13} className="text-[#f2c14e]" /> : null}
                {faNum(myPlace)}
                <span className="font-medium text-fg/60">/{faNum(view.standings.length)}</span>
              </span>
            ) : (
              '—'
            )}
          </Kpi>
          {myStanding ? (
            <Kpi label="بازده" tone={pctClass(myStanding.returnPct)}>
              {signedPct(myStanding.returnPct)}
            </Kpi>
          ) : (
            <Kpi label="بازده">—</Kpi>
          )}
          <Kpi label="زمان">
            <LiveClock view={view} now={now} />
          </Kpi>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="بخش‌های نبرد"
        aria-orientation="horizontal"
        onKeyDown={onTabKey}
        className="flex h-11 shrink-0 border-b border-line bg-chart/35"
      >
        {tabs.map((item) => {
          const selected = tab === item.id;
          const fresh = item.id === 'chat' ? unread : 0;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[item.id] = el;
              }}
              id={`battle-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`battle-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              aria-label={fresh > 0 ? `${item.label}، ${faNum(fresh)} پیام تازه` : undefined}
              onClick={() => selectTab(item.id)}
              className={`flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 border-b-2 px-1 text-[12px] transition-colors duration-150 ${
                selected
                  ? 'border-accent bg-panel font-semibold text-fg'
                  : 'border-transparent font-medium text-fg/70 hover:bg-hover hover:text-fg'
              }`}
            >
              <Icon name={item.icon} size={15} />
              <span className="truncate">{item.label}</span>
              {fresh > 0 ? (
                <span
                  aria-hidden="true"
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg"
                >
                  {fresh > 9 ? `${faNum(9)}+` : faNum(fresh)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`battle-panel-${tab}`}
        aria-labelledby={`battle-tab-${tab}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {tab === 'leaderboard' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto" tabIndex={0} aria-label="جدول زنده">
              {myStanding ? (
                <div className="sticky top-0 z-10 border-b border-line bg-panel p-2.5">
                  <YouCard
                    standing={myStanding}
                    place={myPlace}
                    leader={view.standings[0]}
                    target={view.settings.profitTargetPct}
                  />
                </div>
              ) : null}
              <div className="p-2.5">
                <StandingsList
                  standings={view.standings}
                  meId={meId}
                  showElo={view.mode === 'ranked'}
                />
              </div>
            </div>
            <p className="shrink-0 border-t border-line px-3 py-2 text-[11.5px] leading-5 text-fg/75">
              {view.settings.winCondition === 'profit-target'
                ? `اولین کسی که معامله را روی +${faNum(view.settings.profitTargetPct ?? 0)}٪ ببندد برنده است.`
                : 'در پایان، بیشترین بازده برنده است.'}{' '}
              مرتب‌شده با احتساب معاملات باز. نگه‌داشتن{' '}
              <kbd className="rounded border border-line bg-chart px-1 py-0.5 font-sans text-[11px]">
                Tab
              </kbd>{' '}
              جدول را روی نمودار نشان می‌دهد.
            </p>
          </div>
        ) : null}
        {tab === 'chat' ? (
          <BattleChat
            battleId={view.id}
            messages={view.chat}
            meId={meId}
            canPost={view.me !== null}
            onSent={refetch}
          />
        ) : null}
        {tab === 'rules' ? (
          <div
            className="min-h-0 flex-1 overflow-y-auto px-3"
            tabIndex={0}
            aria-label="قانون‌های نبرد"
          >
            <RulesList view={view} variant="cards" />
          </div>
        ) : null}
        {tab === 'admin' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 text-[12.5px]">
            <p className="text-[12.5px] leading-5 text-fg/75">
              این دکمه‌ها برای همه معامله‌گرهای نبرد است.
            </p>
            {view.status === 'paused' ? (
              <AdminButton icon="play" label="ادامه نبرد" onClick={() => onControl('resume')} />
            ) : (
              <AdminButton
                icon="pause"
                label="توقف نبرد"
                hint="زمان و بازار می‌ایستند"
                disabled={view.status !== 'live'}
                onClick={() => onControl('pause')}
              />
            )}
            <AdminButton
              icon="rotate"
              label="شروع دوباره"
              hint="حساب همه صفر می‌شود"
              onClick={() => onControl('restart')}
            />
            <div className="mt-1 border-t border-line pt-2">
              <p className="mb-2 text-[11.5px] font-semibold text-down">اقدام قطعی</p>
              <AdminButton
                icon="stop"
                label="پایان نبرد"
                hint="رتبه‌بندی فعلی نتیجه نهایی می‌شود"
                danger
                disabled={view.status !== 'live' && view.status !== 'paused'}
                onClick={() => onControl('end')}
              />
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function Kpi({
  label,
  tone,
  children,
}: {
  readonly label: string;
  readonly tone?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-chart/80 px-2 py-1.5 ring-1 ring-inset ring-line/80">
      <p className="text-[11px] font-medium text-fg/70">{label}</p>
      <p className={`mt-0.5 truncate text-[13px] font-bold tabular-nums ${tone ?? 'text-fg'}`}>
        {children}
      </p>
    </div>
  );
}

function LiveClock({ view, now }: { readonly view: BattleView; readonly now: () => number }) {
  useTicker(250);
  const remaining = remainingMs(view.clock, now());
  const low = view.status === 'live' && remaining < 30_000;
  const paused = view.status === 'paused';
  const text =
    view.status === 'countdown'
      ? formatClock(view.settings.durationMin * 60_000)
      : formatClock(remaining);
  return (
    <span
      dir="ltr"
      title="زمان باقی‌مانده"
      className={`font-mono ${paused ? 'text-[#f5c451]' : low ? 'text-down' : 'text-fg'} ${
        low ? 'motion-safe:animate-pulse' : ''
      }`}
    >
      {clockFa(text)}
    </span>
  );
}

function YouCard({
  standing,
  place,
  leader,
  target,
}: {
  readonly standing: Standing;
  readonly place: number;
  readonly leader: Standing | undefined;
  readonly target: number | null;
}) {
  const behind =
    leader && leader.userId !== standing.userId ? leader.returnPct - standing.returnPct : 0;
  const sentence =
    standing.status === 'disqualified'
      ? `حذف شدی: ${faReason(standing.reason ?? 'a rule was broken')}`
      : standing.status === 'left'
        ? 'از نبرد خارج شدی و پایین‌تر از کسانی می‌ایستی که هنوز داخل‌اند.'
        : standing.status === 'target'
          ? 'به هدف سود رسیدی.'
          : place === 1
            ? 'صدر جدول مال توست.'
            : behind < 0.05
              ? `شانه‌به‌شانه ${leader?.name ?? 'اول'} هستی.`
              : null;

  return (
    <section className="rounded-xl border border-line bg-chart/70 p-2.5" aria-label="جایگاه تو">
      <p className="text-[12.5px] leading-5">
        {sentence ? (
          <span
            className={
              standing.status === 'disqualified' || standing.status === 'left'
                ? 'font-medium text-down'
                : place === 1 || standing.status === 'target'
                  ? 'font-semibold text-up'
                  : 'font-medium'
            }
          >
            {sentence}
          </span>
        ) : (
          <>
            <span className="font-bold tabular-nums text-down">{faNum(behind, 2)}٪</span> عقب‌تر از{' '}
            <span className="font-semibold">{leader?.name}</span>
          </>
        )}
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-1.5">
        <Mini label="موجودی" value={compactMoney(Math.round(standing.equity))} />
        <Mini
          label="باز"
          value={standing.openPositions === 0 ? 'ندارد' : faNum(standing.openPositions)}
        />
        <Mini label="برد" value={faNum(standing.wins)} />
      </dl>
      {target !== null && standing.status === 'active' ? (
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between text-[11px] text-fg/75">
            <span>پیشرفت تا هدف</span>
            <span className="tabular-nums">{faNum(target)}٪</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div
              className="h-full rounded-full bg-up"
              style={{
                width: `${Math.max(0, Math.min(100, (standing.returnPct / target) * 100))}%`,
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Mini({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-panel px-2 py-1.5 ring-1 ring-inset ring-line/70">
      <dt className="text-[11px] text-fg/70">{label}</dt>
      <dd className="mt-0.5 truncate text-[12px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function AdminButton({
  icon,
  label,
  hint,
  danger = false,
  disabled = false,
  onClick,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly hint?: string;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 text-start transition-colors duration-150 hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? 'border-down/40 text-down' : 'border-line'
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          danger ? 'bg-down/15' : 'bg-chart'
        }`}
      >
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11.5px] text-fg/70">{hint}</span> : null}
      </span>
    </button>
  );
}
