'use client';

import { useState } from 'react';
import { faNum } from '@/lib/locale/jalali';
import type { BattleView } from '@/lib/battles';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/icons';
import { BattleChat } from './BattleChat';
import { RulesList } from './RulesList';
import { StandingsList } from './StandingsList';

type Tab = 'leaderboard' | 'chat' | 'rules' | 'admin';

/** In-battle sidebar: live leaderboard, chat, rules and (for the host) the admin controls. */
export function BattleSidebar({
  view,
  meId,
  refetch,
  onControl,
  onClose,
  className = '',
}: {
  readonly view: BattleView;
  readonly meId: string;
  readonly refetch: () => void;
  readonly onControl: (op: 'pause' | 'resume' | 'restart' | 'end') => void;
  /** Closes the drawer (small screens). */
  readonly onClose?: () => void;
  readonly className?: string;
}) {
  const [tab, setTab] = useState<Tab>('leaderboard');
  const tabs: Array<{ id: Tab; label: string; icon: IconName }> = [
    { id: 'leaderboard', label: 'جدول', icon: 'trophy' },
    { id: 'chat', label: 'گفت‌وگو', icon: 'chat' },
    { id: 'rules', label: 'قانون‌ها', icon: 'list' },
  ];
  if (view.isHost) tabs.push({ id: 'admin', label: 'میزبان', icon: 'shield' });
  const unread = view.chat.length;
  return (
    <aside
      aria-label="نبرد"
      data-testid="battle-sidebar"
      className={`w-80 shrink-0 flex-col border-l border-line bg-panel ${className}`}
    >
      <div role="tablist" className="flex h-10 shrink-0 items-stretch border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1 border-b-2 text-[12px] font-medium transition ${
              tab === t.id ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
            {t.id === 'chat' && tab !== 'chat' && unread > 0 ? (
              <span className="ms-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
            ) : null}
          </button>
        ))}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex w-10 items-center justify-center text-muted hover:text-fg lg:hidden"
          >
            <Icon name="close" size={15} />
          </button>
        ) : null}
      </div>
      {tab === 'leaderboard' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
          <StandingsList standings={view.standings} meId={meId} showElo={view.mode === 'ranked'} />
          <p className="mt-3 px-1 text-[11px] text-muted">
            مرتب‌شده بر اساس بازده، با احتساب معاملات باز.{' '}
            {view.settings.winCondition === 'profit-target'
              ? `اولین کسی که معامله را روی +${faNum(view.settings.profitTargetPct ?? 0)}٪ ببندد برنده است.`
              : 'در پایان، بیشترین بازده برنده است.'}{' '}
            برای دیدن روی نمودار، <kbd className="rounded border border-line px-1">Tab</kbd> را نگه
            دار.
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
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
          <RulesList view={view} />
        </div>
      ) : null}
      {tab === 'admin' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 text-[12.5px]">
          <p className="text-muted">این دکمه‌ها برای همه معامله‌گرهای نبرد است.</p>
          {view.status === 'paused' ? (
            <AdminButton icon="play" label="ادامه نبرد" onClick={() => onControl('resume')} />
          ) : (
            <AdminButton
              icon="pause"
              label="توقف نبرد"
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
          <AdminButton
            icon="stop"
            label="پایان نبرد"
            hint="نتیجه قطعی می‌شود"
            danger
            disabled={view.status !== 'live' && view.status !== 'paused'}
            onClick={() => onControl('end')}
          />
        </div>
      ) : null}
    </aside>
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
      className={`flex items-center gap-2.5 rounded-lg border border-line px-3 py-2.5 text-start transition hover:bg-hover disabled:opacity-40 ${
        danger ? 'text-down' : ''
      }`}
    >
      <Icon name={icon} size={16} />
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        {hint ? <span className="block text-[11px] text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}
