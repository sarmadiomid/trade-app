'use client';

import { Fragment, useState } from 'react';
import { seriesRegistry } from '@/lib/series';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Popover } from '../ui/Popover';

/** TradingView-style chart type dropdown: the active type's icon, a sectioned list on click. */
export function ChartTypeMenu() {
  const app = useApp();
  const current = useUiStore((s) => s.options.chartType);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const types = seriesRegistry.list();
  const active = types.find((t) => t.id === current) ?? types[0]!;
  return (
    <>
      <IconButton
        path={active.icon}
        label={active.label}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      />
      {anchor ? (
        <Popover anchor={anchor} onClose={() => setAnchor(null)}>
          <div className="-m-2 flex min-w-60 flex-col py-1" role="menu" aria-label="Chart type">
            {types.map((t, i) => (
              <Fragment key={t.id}>
                {i > 0 && t.group !== types[i - 1]!.group ? (
                  <div role="separator" className="my-1 h-px bg-line" />
                ) : null}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={t.id === active.id}
                  onClick={() => {
                    setAnchor(null);
                    app.settings.update({ chartType: t.id });
                  }}
                  className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-left text-[13px] transition-colors hover:bg-hover ${
                    t.id === active.id ? 'bg-accent/15 text-accent' : 'text-fg'
                  }`}
                >
                  <Icon path={t.icon} size={18} />
                  {t.label}
                </button>
              </Fragment>
            ))}
          </div>
        </Popover>
      ) : null}
    </>
  );
}
