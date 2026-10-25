'use client';

import { useState } from 'react';
import { currentPlan, entitlements, guardPlan, requiresPlan } from '@/lib/app';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';
import { Popover } from '../ui/Popover';
import { Tooltip } from '../ui/Tooltip';
import { useToolbarText } from './toolbar-locale';

/** "Replay" toggle plus the quick start-point options (select bar / date / first / random). */
export function ReplayButton() {
  const app = useApp();
  const state = useUiStore((s) => s.replay.state);
  const openDialog = useUiStore((s) => s.openDialog);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { fa, t } = useToolbarText();
  const on = state !== 'idle' && state !== 'exited';

  const items: Array<{ label: string; icon: IconName; run: () => void }> = [
    { label: t('Select bar'), icon: 'scissors', run: () => app.replay.startSelecting() },
    { label: t('Select date…'), icon: 'calendar', run: () => openDialog({ type: 'replay-date' }) },
    {
      label: t('First available bar'),
      icon: 'first',
      run: () => {
        app.replay.startSelecting();
        void app.replay.selectFirstBar();
      },
    },
    {
      label: t('Random bar'),
      icon: 'shuffle',
      run: () => {
        const allowed = entitlements(currentPlan()).randomCandle;
        if (!guardPlan(allowed ? null : requiresPlan('کندل تصادفی', 'mid'))) return;
        app.replay.startSelecting();
        void app.replay.selectRandomBar();
      },
    },
  ];

  return (
    <div
      className={`flex items-center rounded-lg transition-colors ${
        on ? 'bg-accent/15 ring-1 ring-inset ring-accent/35' : 'bg-chart/50 ring-1 ring-inset ring-line/70'
      }`}
    >
      <Tooltip label={on ? t('Exit bar replay') : t('Bar replay — pick a start bar')}>
        <button
          type="button"
          aria-pressed={on}
          onClick={() => (on ? app.replay.exit() : app.replay.startSelecting())}
          className={`flex h-8 items-center gap-1.5 rounded-l-lg pl-2.5 pr-1.5 text-[12.5px] font-semibold transition-colors hover:bg-hover ${
            on ? 'text-accent' : 'text-fg'
          }`}
        >
          <Icon name="replay" size={16} />
          <span className="hidden @min-[1020px]/bar:inline">{t('Replay')}</span>
        </button>
      </Tooltip>
      <span className="h-4 w-px bg-line/70" />
      <button
        type="button"
        aria-label={t('Replay start options')}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className={`flex h-8 w-5 items-center justify-center rounded-r-lg transition-colors hover:bg-hover ${
          on ? 'text-accent' : 'text-muted hover:text-fg'
        }`}
      >
        <Icon name="chevronDown" size={12} />
      </button>
      {anchor ? (
        <Popover anchor={anchor} onClose={() => setAnchor(null)}>
          <div dir={fa ? 'rtl' : 'ltr'} className="-m-1.5 flex min-w-52 flex-col gap-0.5 p-1" role="menu">
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setAnchor(null);
                  it.run();
                }}
                className="flex h-8 items-center gap-2.5 rounded-md px-2 text-start text-[12.5px] text-fg transition-colors hover:bg-hover"
              >
                <Icon name={it.icon} size={15} className="text-muted" />
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        </Popover>
      ) : null}
    </div>
  );
}
