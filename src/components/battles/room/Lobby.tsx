'use client';

import Link from 'next/link';
import { useState } from 'react';
import { faNum } from '@/lib/locale/jalali';
import { formatClock, remainingMs, type BattleView } from '@/lib/battles';
import { initials } from '../../platform/AppHeader';
import { Icon } from '../../ui/Icon';
import { RankEmblem } from '../RankEmblem';
import {
  STATUS,
  battleTitle,
  clockFa,
  compactMoney,
  faMessage,
  minutes,
  winConditionName,
} from '../format';
import { BattleChat } from './BattleChat';
import { RulesList } from './RulesList';
import { useTicker } from './useBattle';

/**
 * The battle lobby (Standby): the traders who joined, the rules, the chat and the host's start
 * button. Also the join screen of a battle in progress that accepts late entries.
 */
export function Lobby({
  view,
  meId,
  now,
  run,
  refetch,
  initialCode,
}: {
  readonly view: BattleView;
  readonly meId: string;
  readonly now: () => number;
  readonly run: (path: string, body?: unknown) => Promise<BattleView>;
  readonly refetch: () => void;
  readonly initialCode: string;
}) {
  useTicker(500);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState<string | null>(null);
  const joined = view.me !== null;
  const s = view.settings;
  const [label, cls] = STATUS[view.status];
  const slots = Math.max(0, Math.min(s.maxParticipants, 12) - view.standings.length);
  const live = view.status === 'live' || view.status === 'paused';

  const act = async (path: string, body?: unknown) => {
    setBusy(path);
    setError(null);
    try {
      await run(path, body);
    } catch (e) {
      setError(e instanceof Error ? faMessage(e.message) : faMessage('Something went wrong'));
    } finally {
      setBusy(null);
    }
  };

  const copy = async (what: 'id' | 'link') => {
    const text =
      what === 'id' ? view.code : `${window.location.origin}/battle/${view.id}?code=${view.code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setError(faMessage('Copy failed: select the battle ID instead'));
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 sm:px-6">
      <Link
        href="/battle"
        className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"
      >
        <Icon name="chevronLeft" size={15} className="rtl:-scale-x-100" /> نبردها
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[24px] font-bold tracking-tight" data-testid="battle-name">
              {battleTitle(s.name)}
            </h1>
            <span
              className={`rounded px-2 py-0.5 text-[11.5px] font-semibold ${cls}`}
              data-testid="battle-status"
            >
              {label}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {view.mode === 'ranked' ? 'رتبه‌ای' : 'آزاد'} · {winConditionName(s.winCondition)} ·{' '}
            {compactMoney(s.startingBalance)} · {minutes(s.durationMin)}
            {view.host ? ` · میزبان: ${view.host.name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copy('id')}
            className="group inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-[13px] hover:bg-hover"
            title="کپی شناسه نبرد"
          >
            <span className="text-muted">شناسه</span>
            <bdi dir="ltr" className="font-mono font-bold tracking-widest" data-testid="battle-code">
              {view.code}
            </bdi>
            <Icon name={copied === 'id' ? 'check' : 'copy'} size={14} />
          </button>
          <button
            type="button"
            onClick={() => void copy('link')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] hover:bg-hover"
          >
            <Icon name={copied === 'link' ? 'check' : 'users'} size={14} />
            {copied === 'link' ? 'لینک کپی شد' : 'دعوت'}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">
                معامله‌گرها{' '}
                <span className="font-normal text-muted">
                  {faNum(view.standings.length)}/{faNum(s.maxParticipants)}
                </span>
              </h2>
              {live ? (
                <span className="text-[12.5px] text-muted">
                  در جریان · {clockFa(formatClock(remainingMs(view.clock, now())))} مانده
                </span>
              ) : null}
            </div>
            <ul
              className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4"
              data-testid="lobby-traders"
            >
              {view.standings.map((p) => {
                const host = view.host?.id === p.userId;
                const me = p.userId === meId;
                return (
                  <li
                    key={p.userId}
                    className={`relative flex flex-col items-center rounded-xl border px-3 py-4 text-center ${
                      me ? 'border-accent/60 bg-accent/10' : 'border-line bg-chart/50'
                    }`}
                  >
                    {host ? (
                      <span className="absolute start-2 top-2 text-[#f2c14e]" title="میزبان">
                        <Icon name="crown" size={15} />
                      </span>
                    ) : null}
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#2a3550] to-[#1b2236] text-[15px] font-bold">
                      {initials(p.name)}
                    </span>
                    <span className="mt-2 max-w-full truncate text-[13px] font-semibold">
                      {p.name}
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-muted">
                      <RankEmblem elo={p.elo} size={14} /> {faNum(p.elo)}
                    </span>
                    {me ? (
                      <span className="mt-1 text-[10.5px] font-semibold text-accent">تو</span>
                    ) : null}
                  </li>
                );
              })}
              {Array.from({ length: slots }, (_, i) => (
                <li
                  key={`slot-${i}`}
                  className="flex min-h-[132px] flex-col items-center justify-center rounded-xl border border-dashed border-line text-[12px] text-muted"
                >
                  <Icon name="plus" size={16} />
                  <span className="mt-1">جای خالی</span>
                </li>
              ))}
            </ul>
            {s.maxParticipants > 12 && slots === 0 && view.standings.length < s.maxParticipants ? (
              <p className="mt-2 text-[12px] text-muted">
                {faNum(s.maxParticipants - view.standings.length)} جای خالی دیگر
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
            {!joined ? (
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <h2 className="text-[15px] font-semibold">
                    {view.joinBlocked
                      ? 'نمی‌توانی به این نبرد بپیوندی'
                      : live
                        ? 'به نبرد در جریان بپیوند'
                        : 'به این نبرد بپیوند'}
                  </h2>
                  <p className="mt-0.5 text-[13px] leading-6 text-muted">
                    {view.joinBlocked
                      ? faMessage(view.joinBlocked)
                      : live
                        ? 'ورود دیرهنگام از کندل فعلی شروع می‌شود، با یک حساب تازه.'
                        : 'وقتی میزبان نبرد را شروع کند، همه یک بازار را معامله می‌کنند.'}
                  </p>
                </div>
                {!view.joinBlocked ? (
                  <div className="flex items-center gap-2">
                    {s.visibility === 'private' ? (
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="شناسه"
                        aria-label="شناسه نبرد"
                        dir="ltr"
                        className="h-10 w-32 rounded-lg border border-line bg-chart px-3 text-center font-mono text-[14px] tracking-widest outline-none focus:border-accent"
                      />
                    ) : null}
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void act('join', { code })}
                      data-testid="join-battle"
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-5 text-[14px] font-semibold text-accent-fg hover:brightness-110 disabled:opacity-50"
                    >
                      <Icon name="swords" size={16} />{' '}
                      {busy === 'join' ? 'در حال پیوستن…' : 'پیوستن'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : view.isHost && view.status === 'standby' ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <h2 className="text-[15px] font-semibold">تو میزبان هستی</h2>
                  <p className="mt-0.5 text-[13px] leading-6 text-muted">
                    وقتی همه آمدند شروع کن. اول یک شمارش ده‌ثانیه‌ای می‌آید؛{' '}
                    {s.allowLateJoin
                      ? 'بعد از شروع هم می‌شود پیوست'
                      : 'با شروع، ورود بسته می‌شود'}
                    .
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void act('control', { op: 'cancel' })}
                    className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-[13px] hover:bg-hover disabled:opacity-50"
                  >
                    بستن لابی
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void act('control', { op: 'start' })}
                    data-testid="start-battle"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-5 text-[14px] font-semibold text-accent-fg hover:brightness-110 disabled:opacity-50"
                  >
                    <Icon name="play" size={15} />{' '}
                    {busy === 'control' ? 'در حال شروع…' : 'شروع نبرد'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
                  </span>
                  <div>
                    <h2 className="text-[15px] font-semibold">منتظر شروع میزبان</h2>
                    <p className="mt-0.5 text-[13px] leading-6 text-muted">
                      بازار با شروع شمارش معلوم می‌شود. همین صفحه را باز نگه دار.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void act('leave')}
                  className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-[13px] hover:bg-hover disabled:opacity-50"
                >
                  ترک لابی
                </button>
              </div>
            )}
            {error ? (
              <p className="mt-3 text-[12.5px] text-down" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-line bg-panel px-4 py-3">
            <h2 className="pb-1 text-[14px] font-semibold">قانون‌ها</h2>
            <RulesList view={view} />
          </section>
          <section className="flex h-80 flex-col rounded-2xl border border-line bg-panel">
            <h2 className="border-b border-line px-4 py-2.5 text-[14px] font-semibold">گفت‌وگو</h2>
            <BattleChat
              battleId={view.id}
              messages={view.chat}
              meId={meId}
              canPost={joined}
              onSent={refetch}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
