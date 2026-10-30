'use client';

import { useState } from 'react';
import { PLAN_LABEL, symbolAllowed, symbolMinPlan, type PlanId } from '@/lib/app';
import { assetClassOf, type AssetClass } from '@/lib/data';
import { ASSET_FA } from '../backtest/format';
import { Icon } from '../ui/Icon';

/** Hardcoded palette for the create-session dialog. */
const SESSION = {
  field:
    'h-11 w-full rounded-xl border border-[#23252c] bg-[#0b0c0e] px-3.5 text-[13.5px] text-white outline-none transition placeholder:text-[#686c78] focus:border-[#1d5eff]',
  chevron: 'text-[#7c808d]',
  panel: 'rounded-xl border border-[#23252c] bg-[#141519] shadow-2xl',
  panelRule: 'border-[#23252c]',
  chipOn: 'bg-[#1d5eff] text-white',
  chipOff: 'bg-[#17181c] text-[#9aa3b5] hover:text-white',
  empty: 'text-[#7c808d]',
  rowOn: 'bg-[#1c1e26] text-white',
  rowOff: 'text-[#9aa3b5]',
  locked: 'text-[#6d7280]',
  lockIcon: 'text-[#8b93a7]',
  checkOn: 'text-[#1d5eff]',
  symbol: 'text-white',
  symbolLocked: 'text-[#9aa3b5]',
  upgrade: 'bg-[#102042] text-[#4785ff] hover:bg-[#16306a]',
  starOn: 'text-[#f5c451]',
  starOff: 'text-[#5c6270] hover:text-[#d1d5db]',
} as const;

/** Design-token palette matching the battle dialog fields. */
const BATTLE = {
  field:
    'h-9 w-full rounded-lg border border-line bg-chart px-3 text-[13px] text-fg outline-none transition placeholder:text-muted focus:border-accent',
  chevron: 'text-muted',
  panel: 'rounded-lg border border-line bg-panel shadow-2xl',
  panelRule: 'border-line',
  chipOn: 'bg-accent text-accent-fg',
  chipOff: 'bg-hover text-muted hover:text-fg',
  empty: 'text-muted',
  rowOn: 'bg-hover text-fg',
  rowOff: 'text-muted',
  locked: 'text-muted',
  lockIcon: 'text-muted',
  checkOn: 'text-accent',
  symbol: 'text-fg',
  symbolLocked: 'text-muted',
  upgrade: 'bg-accent/15 text-accent hover:bg-accent/25',
  starOn: 'text-[#f5c451]',
  starOff: 'text-muted hover:text-fg',
} as const;

const TONES = { session: SESSION, battle: BATTLE } as const;

export type SymbolFieldTone = keyof typeof TONES;

const FAVORITE_SYMBOLS_KEY = 'chartix.favoriteSymbols.v1';

type SymbolCategory = 'all' | AssetClass | 'favorites';

const SYMBOL_CATEGORIES: ReadonlyArray<{ id: SymbolCategory; label: string }> = [
  { id: 'all', label: 'همه' },
  { id: 'metals', label: 'فلزات' },
  { id: 'forex', label: 'فارکس' },
  { id: 'indices', label: 'شاخص‌ها' },
  { id: 'crypto', label: 'کریپتو' },
  { id: 'favorites', label: 'علاقه‌مندی‌ها' },
];

export interface SymbolOption {
  readonly symbol: string;
  readonly description: string;
}

function symbolLabel(symbol: string, description: string): string {
  return `${symbol} · ${ASSET_FA[symbol] ?? description}`;
}

function readFavoriteSymbols(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FAVORITE_SYMBOLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
}

function writeFavoriteSymbols(list: readonly string[]): void {
  try {
    window.localStorage.setItem(FAVORITE_SYMBOLS_KEY, JSON.stringify(list));
  } catch {
    // Ignore quota and private-mode failures; the stars still work for this visit.
  }
}

/** Searchable symbol combobox shared by session setup and battle setup. */
export function SymbolField({
  instruments,
  symbol = '',
  plan,
  onChange,
  onLocked,
  multiple = false,
  picked = [],
  listId = 'session-symbols',
  placeholder,
  ariaLabel = 'نماد',
  tone = 'session',
}: {
  readonly instruments: readonly SymbolOption[];
  readonly symbol?: string;
  readonly plan?: PlanId;
  readonly onChange: (symbol: string) => void;
  readonly onLocked?: (symbol: string) => void;
  /** Keep the list open and toggle membership instead of replacing one symbol. */
  readonly multiple?: boolean;
  readonly picked?: readonly string[];
  readonly listId?: string;
  readonly placeholder?: string;
  readonly ariaLabel?: string;
  /** `session` keeps the create-session palette; `battle` follows battle dialog tokens. */
  readonly tone?: SymbolFieldTone;
}) {
  const skin = TONES[tone];
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [category, setCategory] = useState<SymbolCategory>('all');
  const [favorites, setFavorites] = useState<string[]>(readFavoriteSymbols);
  const selected = instruments.find((item) => item.symbol === symbol);
  const label = multiple
    ? ''
    : selected
      ? symbolLabel(selected.symbol, selected.description)
      : symbol;
  const q = query.trim().toLowerCase();
  const raw = query.trim();
  const items = instruments.filter((item) => {
    if (category === 'favorites' && !favorites.includes(item.symbol)) return false;
    if (category !== 'all' && category !== 'favorites' && assetClassOf(item.symbol) !== category) {
      return false;
    }
    if (!q) return true;
    const fa = ASSET_FA[item.symbol] ?? '';
    return (
      item.symbol.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      fa.toLowerCase().includes(q) ||
      fa.includes(raw)
    );
  });
  const active = items.length === 0 ? 0 : Math.min(cursor, items.length - 1);
  const empty =
    q.length > 0
      ? 'نمادی پیدا نشد'
      : category === 'favorites'
        ? 'هنوز نمادی علامت نخورده'
        : 'در این دسته نمادی نیست';
  const hint = placeholder ?? (multiple ? 'جستجوی نماد...' : 'انتخاب نماد...');

  const allowed = (next: string) => (plan ? symbolAllowed(plan, next) : true);

  const pick = (next: string) => {
    onChange(next);
    setQuery('');
    if (!multiple) setOpen(false);
  };

  const choose = (next: string) => {
    if (allowed(next)) pick(next);
    else onLocked?.(next);
  };

  const toggleFavorite = (next: string) => {
    setFavorites((prev) => {
      const list = prev.includes(next) ? prev.filter((item) => item !== next) : [...prev, next];
      writeFavoriteSymbols(list);
      return list;
    });
  };

  const chooseCategory = (next: SymbolCategory) => {
    setCategory(next);
    setCursor(0);
  };

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
          setQuery('');
        }
      }}
    >
      <input
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={hint}
        className={`${skin.field} py-5`}
        value={open ? query : label}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setCursor(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setCursor(0);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            setOpen(true);
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCursor((c) => Math.min(items.length - 1, c + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCursor((c) => Math.max(0, c - 1));
          } else if (e.key === 'Enter' && items[active]) {
            e.preventDefault();
            choose(items[active]!.symbol);
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
            setQuery('');
          }
        }}
      />
      <Icon
        name="chevronDown"
        size={15}
        className={`pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 ${skin.chevron}`}
      />
      {open ? (
        <div className={`absolute z-20 mt-1 w-full overflow-hidden ${skin.panel}`}>
          <div
            role="radiogroup"
            aria-label="دسته نماد"
            className={`flex gap-1 overflow-x-auto border-b px-2 py-2 ${skin.panelRule}`}
          >
            {SYMBOL_CATEGORIES.map((item) => {
              const on = category === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chooseCategory(item.id)}
                  className={`h-7 shrink-0 rounded-full px-2.5 text-[12px] font-medium transition ${
                    on ? skin.chipOn : skin.chipOff
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label="نمادها"
            aria-multiselectable={multiple || undefined}
            className="max-h-52 overflow-auto py-1"
          >
            {items.length === 0 ? (
              <li className={`px-3.5 py-2 text-[12.5px] ${skin.empty}`}>{empty}</li>
            ) : (
              items.map((item, i) => {
                const fav = favorites.includes(item.symbol);
                const locked = !allowed(item.symbol);
                const needed = symbolMinPlan(item.symbol);
                const on = multiple && picked.includes(item.symbol);
                return (
                  <li
                    key={item.symbol}
                    role="option"
                    aria-selected={multiple ? on : i === active}
                    aria-disabled={locked}
                  >
                    <div
                      onMouseEnter={() => setCursor(i)}
                      className={`flex items-center gap-1 pe-1.5 ${
                        i === active ? skin.rowOn : skin.rowOff
                      }`}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(item.symbol)}
                        className={`flex min-w-0 flex-1 items-center gap-2 px-3.5 py-2 text-start text-[13px] ${
                          locked ? skin.locked : ''
                        }`}
                      >
                        {locked ? (
                          <Icon name="lock" size={13} className={`shrink-0 ${skin.lockIcon}`} />
                        ) : multiple ? (
                          <Icon
                            name="check"
                            size={13}
                            className={`shrink-0 ${on ? skin.checkOn : 'text-transparent'}`}
                          />
                        ) : null}
                        <span
                          dir="ltr"
                          className={`w-20 shrink-0 font-semibold ${
                            locked ? skin.symbolLocked : skin.symbol
                          }`}
                        >
                          {item.symbol}
                        </span>
                        <span className="truncate">
                          {ASSET_FA[item.symbol] ?? item.description}
                        </span>
                      </button>
                      {locked && plan ? (
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onLocked?.(item.symbol)}
                          className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition ${skin.upgrade}`}
                        >
                          ارتقا به {PLAN_LABEL[needed]}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-pressed={fav}
                        aria-label={
                          fav
                            ? `حذف ${item.symbol} از علاقه‌مندی‌ها`
                            : `افزودن ${item.symbol} به علاقه‌مندی‌ها`
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => toggleFavorite(item.symbol)}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                          fav ? skin.starOn : skin.starOff
                        }`}
                      >
                        <Icon name="star" size={14} className={fav ? 'fill-current' : ''} />
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
