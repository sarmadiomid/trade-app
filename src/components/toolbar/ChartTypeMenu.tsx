'use client';

import { Fragment, useState } from 'react';
import { seriesRegistry } from '@/lib/series';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Icon } from '../ui/Icon';
import { Popover } from '../ui/Popover';
import { Tooltip } from '../ui/Tooltip';
import { useToolbarText } from './toolbar-locale';

const GROUP_LABELS: Readonly<Record<string, string>> = {
  ohlc: 'Classic',
  line: 'Lines & Area',
  area: 'Lines & Area',
  columns: 'Lines & Area',
  derived: 'Price-based',
  boxes: 'Price-based',
  profile: 'Order Flow',
};

/** TradingView-style chart type dropdown: the active type's icon, a sectioned list on click. */
export function ChartTypeMenu() {
  const app = useApp();
  const current = useUiStore((s) => s.options.chartType);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const types = seriesRegistry.list();
  const active = types.find((t) => t.id === current) ?? types[0]!;
  const { fa, t: tr } = useToolbarText();
  const open = anchor !== null;

  return (
    <>
      <Tooltip label={`${tr('Chart type')}: ${tr(active.label)}`}>
        <button
          type="button"
          aria-label={tr(active.label)}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
          className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium transition-colors ${
            open
              ? 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/35'
              : 'text-fg hover:bg-hover'
          }`}
        >
          <Icon path={active.icon} size={18} />
          <Icon
            name="chevronDown"
            size={12}
            className={`text-muted transition-transform duration-150 ${open ? 'rotate-180 text-accent' : ''}`}
          />
        </button>
      </Tooltip>
      {anchor ? (
        <Popover anchor={anchor} onClose={() => setAnchor(null)}>
          <div
            dir={fa ? 'rtl' : 'ltr'}
            className="-m-1.5 flex max-h-[75vh] min-w-64 flex-col overflow-y-auto p-1"
            role="menu"
            aria-label={tr('Chart type')}
          >
            {types.map((t, i) => {
              const prevGroupKey = i > 0 ? (types[i - 1]!.group ?? 'ohlc') : null;
              const curGroupKey = t.group ?? 'ohlc';
              const prevGroup = prevGroupKey ? (GROUP_LABELS[prevGroupKey] ?? prevGroupKey) : null;
              const curGroup = GROUP_LABELS[curGroupKey] ?? curGroupKey;
              const showGroupHeader = i === 0 || curGroup !== prevGroup;
              const isSelected = t.id === active.id;
              const isOrderFlow = t.group === 'profile';

              return (
                <Fragment key={t.id}>
                  {i > 0 && showGroupHeader ? (
                    <div role="separator" className="my-1.5 h-px bg-line/70" />
                  ) : null}
                  {showGroupHeader ? (
                    <div className="flex items-center justify-between px-2 pt-0.5 pb-1">
                      <span className="text-[10.5px] font-semibold tracking-wider text-muted uppercase">
                        {tr(curGroup)}
                      </span>
                      {isOrderFlow ? (
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9.5px] font-bold tracking-wider text-accent">
                          PRO
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setAnchor(null);
                      app.settings.update({ chartType: t.id });
                    }}
                    className={`flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2 text-start text-[12.5px] transition-colors ${
                      isSelected
                        ? 'bg-accent/15 font-semibold text-accent'
                        : 'text-fg hover:bg-hover'
                    }`}
                  >
                    <Icon
                      path={t.icon}
                      size={17}
                      className={isSelected ? 'text-accent' : 'text-muted'}
                    />
                    <span className="flex-1 truncate">{tr(t.label)}</span>
                    {isSelected ? <Icon name="check" size={14} className="text-accent" /> : null}
                  </button>
                </Fragment>
              );
            })}
          </div>
        </Popover>
      ) : null}
    </>
  );
}
