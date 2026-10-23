'use client';

import { useState } from 'react';
import { isTimeframeId, TIMEFRAMES, TIMEFRAME_IDS, type TimeframeId } from '@/lib/core';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Icon } from '../ui/Icon';
import { Popover } from '../ui/Popover';
import { Tooltip } from '../ui/Tooltip';
import { useToolbarText } from './toolbar-locale';

const STORAGE_KEY = 'chartix.favoriteTimeframes.v1';
const DEFAULT_FAVORITES: readonly TimeframeId[] = ['1m', '5m', '15m', '1h', '4h', '1D'];

const TF_DESC_EN: Readonly<Record<TimeframeId, string>> = {
  '1m': '1 minute',
  '3m': '3 minutes',
  '5m': '5 minutes',
  '15m': '15 minutes',
  '30m': '30 minutes',
  '1h': '1 hour',
  '2h': '2 hours',
  '4h': '4 hours',
  '1D': '1 day',
  '1W': '1 week',
  '1M': '1 month',
};

const TF_DESC_FA: Readonly<Record<TimeframeId, string>> = {
  '1m': '۱ دقیقه',
  '3m': '۳ دقیقه',
  '5m': '۵ دقیقه',
  '15m': '۱۵ دقیقه',
  '30m': '۳۰ دقیقه',
  '1h': '۱ ساعت',
  '2h': '۲ ساعت',
  '4h': '۴ ساعت',
  '1D': '۱ روز',
  '1W': '۱ هفته',
  '1M': '۱ ماه',
};

const GROUPS: ReadonlyArray<{
  readonly label: string;
  readonly items: readonly TimeframeId[];
}> = [
  { label: 'Minutes', items: ['1m', '3m', '5m', '15m', '30m'] },
  { label: 'Hours', items: ['1h', '2h', '4h'] },
  { label: 'Days & Weeks', items: ['1D', '1W', '1M'] },
];

/** Pinned intervals kept on the bar. The rest stay in the menu so the bar never scrolls. */
const MAX_INLINE = 6;

function inlineIds(favorites: readonly TimeframeId[], current: TimeframeId): TimeframeId[] {
  const base = favorites.includes(current) ? [...favorites] : [...favorites, current];
  if (base.length <= MAX_INLINE) return base;
  const trimmed = base.slice(0, MAX_INLINE);
  if (!trimmed.includes(current)) trimmed[trimmed.length - 1] = current;
  return trimmed;
}

function readFavorites(): TimeframeId[] {
  if (typeof window === 'undefined') return [...DEFAULT_FAVORITES];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_FAVORITES];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_FAVORITES];
    const valid = parsed.filter(isTimeframeId);
    return valid.length > 0 ? valid : [...DEFAULT_FAVORITES];
  } catch {
    return [...DEFAULT_FAVORITES];
  }
}

function writeFavorites(list: readonly TimeframeId[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

/** Pinned intervals on the top bar + categorized dropdown with favorite stars. */
export function TimeframeBar() {
  const app = useApp();
  const current = useUiStore((s) => s.timeframe);
  const { fa, t } = useToolbarText();
  const [favorites, setFavorites] = useState<TimeframeId[]>(readFavorites);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const toggleFav = (id: TimeframeId) => {
    setFavorites((prev) => {
      const has = prev.includes(id);
      if (has && prev.length <= 1) return prev;
      const next = has
        ? prev.filter((x) => x !== id)
        : TIMEFRAME_IDS.filter((x) => x === id || prev.includes(x));
      writeFavorites(next);
      return next;
    });
  };

  const shown = inlineIds(favorites, current);

  return (
    <>
      {/* Narrow bar: the active interval opens the full menu. */}
      <button
        type="button"
        dir="ltr"
        aria-label={t('Interval')}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className="hidden h-8 shrink-0 items-center gap-1 rounded-lg bg-chart/65 px-2 text-[13px] font-semibold text-accent ring-1 ring-inset ring-line/80 transition-colors hover:bg-hover @max-[919px]/bar:inline-flex"
      >
        <span>{TIMEFRAMES[current].label}</span>
        <Icon
          name="chevronDown"
          size={13}
          className={`text-muted transition-transform duration-150 ${anchor ? 'rotate-180 text-accent' : ''}`}
        />
      </button>

      <div
        dir="ltr"
        className="hidden w-max min-w-0 shrink items-center rounded-lg bg-chart/65 p-0.5 ring-1 ring-inset ring-line/80 @min-[920px]/bar:flex"
        role="radiogroup"
        aria-label={t('Interval')}
      >
        <div className="flex min-w-0 items-center gap-0.5 overflow-hidden">
          {shown.map((id) => {
            const active = id === current;
            return (
              <Tooltip
                key={id}
                label={`${t('Interval')} ${fa ? TF_DESC_FA[id] : TF_DESC_EN[id]}`}
                shortcut={t('type e.g. 4h ↵')}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => void app.setTimeframe(id)}
                  className={`h-7 shrink-0 rounded-md px-2 text-[12.5px] font-semibold tracking-tight transition-all ${
                    active
                      ? 'bg-accent text-accent-fg shadow-xs'
                      : 'text-muted hover:bg-hover/80 hover:text-fg'
                  }`}
                >
                  {TIMEFRAMES[id].label}
                </button>
              </Tooltip>
            );
          })}
        </div>

        <Tooltip label={t('All intervals')} shortcut={t('type e.g. 4h ↵')}>
          <button
            type="button"
            aria-label={t('All intervals')}
            aria-haspopup="menu"
            aria-expanded={anchor !== null}
            onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
            className={`flex h-7 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${
              anchor !== null
                ? 'bg-accent/15 text-accent'
                : 'text-muted hover:bg-hover/80 hover:text-fg'
            }`}
          >
            <Icon
              name="chevronDown"
              size={13}
              className={`transition-transform duration-150 ${anchor ? 'rotate-180' : ''}`}
            />
          </button>
        </Tooltip>
      </div>

      {anchor ? (
        <Popover anchor={anchor} onClose={() => setAnchor(null)}>
          <div
            dir={fa ? 'rtl' : 'ltr'}
            className="-m-1.5 flex w-60 flex-col gap-1.5 p-1"
            role="menu"
            aria-label={t('All intervals')}
          >
            {GROUPS.map((group, gi) => (
              <div key={group.label} className={gi > 0 ? 'border-t border-line/70 pt-1.5' : ''}>
                <div className="px-2 pb-1 text-[10.5px] font-semibold tracking-wider text-muted uppercase">
                  {t(group.label)}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((id) => {
                    const active = id === current;
                    const fav = favorites.includes(id);
                    return (
                      <div
                        key={id}
                        className={`group/tf flex h-8 items-center rounded-md px-1.5 text-[12.5px] transition-colors ${
                          active
                            ? 'bg-accent/15 font-semibold text-accent'
                            : 'text-fg hover:bg-hover'
                        }`}
                      >
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          onClick={() => {
                            setAnchor(null);
                            void app.setTimeframe(id);
                          }}
                          className="flex h-full flex-1 items-center justify-between gap-2 px-1 text-start"
                        >
                          <span>{fa ? TF_DESC_FA[id] : TF_DESC_EN[id]}</span>
                          <span
                            dir="ltr"
                            className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                              active ? 'bg-accent/20 text-accent' : 'bg-chart/70 text-muted'
                            }`}
                          >
                            {TIMEFRAMES[id].label}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={fav ? t('Unpin from toolbar') : t('Pin to toolbar')}
                          title={fav ? t('Unpin from toolbar') : t('Pin to toolbar')}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFav(id);
                          }}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded transition-opacity ${
                            fav
                              ? 'text-amber-400 hover:text-amber-300'
                              : 'text-muted opacity-0 group-hover/tf:opacity-100 hover:text-fg focus-visible:opacity-100'
                          }`}
                        >
                          <Icon name="star" size={13} className={fav ? 'fill-current' : ''} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Popover>
      ) : null}
    </>
  );
}
