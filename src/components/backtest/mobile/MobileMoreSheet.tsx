'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { chartTypeDenial, currentPlan, guardPlan, isPlanLimitMessage } from '@/lib/app';
import { isTimeframeId } from '@/lib/core';
import { seriesRegistry } from '@/lib/series';
import { drawingRegistry } from '@/lib/drawings';
import { useApp } from '../../state/app-context';
import { useUiStore } from '../../state/ui-store';
import { Icon } from '../../ui/Icon';
import { journalHref } from '../../home/journal-href';
import { statsHref } from '../../home/stats-href';
import type { IconName } from '../../ui/icons';
import { MobileSheet } from '../../chart/mobile/MobileSheet';
import {
  loadServerLayouts,
  persistLayouts,
  readActiveLayout,
  readLayouts,
  writeActiveLayout,
  type ChartLayout,
} from '../../chart/mobile/layouts';
import { useDesktopMode } from '../../chart/mobile/mobile-ui';
import { TradingPanel } from '../TradingPanel';
import { useBacktestStore } from '../store';

type Panel =
  null | 'layouts' | 'chart' | 'objects' | 'watchlist' | 'news' | 'indicators' | 'positions';

const VERSION = '0.1.0';

/** The phone "More" sheet: session actions in the same grid as the reference layout. */
export function MobileMoreSheet({ onClose }: { readonly onClose: () => void }) {
  const app = useApp();
  const snap = useBacktestStore((s) => s.snap);
  const openModal = useBacktestStore((s) => s.openModal);
  const openTicket = useBacktestStore((s) => s.openTicket);
  const history = useUiStore((s) => s.history);
  const theme = useUiStore((s) => s.activeTheme);
  const options = useUiStore((s) => s.options);
  const timeframe = useUiStore((s) => s.timeframe);
  const symbol = useUiStore((s) => s.symbol);
  const pushToast = useUiStore((s) => s.pushToast);
  const setDesktop = useDesktopMode((s) => s.setForced);
  const [panel, setPanel] = useState<Panel>(null);
  const sessionLinks = useBacktestStore((s) => s.sessionLinks);
  const actionsEnabled = useBacktestStore((s) => s.actionsEnabled);
  const [layouts, setLayouts] = useState<ChartLayout[]>(readLayouts);
  const [activeId, setActiveId] = useState<string | null>(readActiveLayout);

  useEffect(() => {
    let live = true;
    void loadServerLayouts().then((list) => {
      if (!live || !list) return;
      setLayouts(list);
    });
    return () => {
      live = false;
    };
  }, []);

  const activeName = layouts.find((l) => l.id === activeId)?.name ?? 'Default';
  const indicatorCount = options.volumeVisible ? 1 : 0;

  if (!snap) return null;

  const share = async () => {
    const url = window.location.href;
    const payload = { title: snap.settings.name, url };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      pushToast('Link copied');
    } catch {
      pushToast('Could not share this session', 'error');
    }
  };

  const snapshot = (): Omit<ChartLayout, 'id' | 'name'> => ({
    chartType: options.chartType,
    timeframe,
    themeId: theme.id,
    volumeVisible: options.volumeVisible,
  });

  const saveLayout = (asNew: boolean) => {
    const body = snapshot();
    const current = layouts.find((l) => l.id === activeId);
    const next: ChartLayout =
      !asNew && current
        ? { ...current, ...body }
        : { id: crypto.randomUUID(), name: `Layout ${layouts.length + 1}`, ...body };
    const list = layouts.some((l) => l.id === next.id)
      ? layouts.map((l) => (l.id === next.id ? next : l))
      : [...layouts, next];
    void persistLayouts(list).then((err) => {
      if (err) {
        if (!isPlanLimitMessage(err)) pushToast(err, 'error');
        return;
      }
      setLayouts(list);
      setActiveId(next.id);
      writeActiveLayout(next.id);
      pushToast(`Saved “${next.name}”`, 'success');
    });
  };

  const applyLayout = (layout: ChartLayout) => {
    app.settings.update({
      chartType: layout.chartType,
      volumeVisible: layout.volumeVisible,
      ...(layout.volumeVisible ? { volumeHidden: false } : {}),
    });
    if (isTimeframeId(layout.timeframe)) void app.setTimeframe(layout.timeframe);
    app.themes.setActive(layout.themeId);
    setActiveId(layout.id);
    writeActiveLayout(layout.id);
    pushToast(`Applied “${layout.name}”`);
  };

  const title =
    panel === 'layouts'
      ? 'Layouts'
      : panel === 'chart'
        ? 'Chart type'
        : panel === 'objects'
          ? 'Object tree'
          : panel === 'watchlist'
            ? 'Watchlist'
            : panel === 'news'
              ? 'News'
              : panel === 'indicators'
                ? 'Indicators'
                : panel === 'positions'
                  ? 'Positions and orders'
                  : 'More';

  return (
    <MobileSheet
      title={title}
      onClose={onClose}
      tall
      footer={
        panel ? undefined : (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] text-[13px] text-muted">
            <button
              type="button"
              onClick={() => app.themes.setActive(theme.dark ? 'light' : 'dark')}
              className="inline-flex items-center gap-2 hover:text-fg"
            >
              <Icon name="sun" size={16} />
              {theme.dark ? 'Light theme' : 'Dark theme'}
            </button>
            <span className="tabular-nums">{VERSION}</span>
          </div>
        )
      }
    >
      {panel ? (
        <button
          type="button"
          onClick={() => setPanel(null)}
          className="mb-2 inline-flex items-center gap-1 px-1 text-[13px] text-muted hover:text-fg"
        >
          <Icon name="chevronLeft" size={16} />
          More
        </button>
      ) : null}

      {panel === null ? (
        <div dir="ltr" className="flex flex-col gap-2 pb-2">
          <div className="grid grid-cols-3 gap-2">
            <BarButton
              icon="undo"
              label="Undo"
              disabled={!history.canUndo}
              onClick={() => app.history.undo()}
            />
            <BarButton icon="share" label="Share" onClick={() => void share()} />
            <BarButton
              icon="redo"
              label="Redo"
              disabled={!history.canRedo}
              onClick={() => app.history.redo()}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setDesktop(true);
              onClose();
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-chart text-[14px] font-medium hover:bg-hover"
          >
            <Icon name="expand" size={18} />
            Desktop mode
          </button>
          <button
            type="button"
            onClick={() => setPanel('layouts')}
            className="flex items-center gap-3 rounded-2xl bg-chart px-4 py-3 text-left hover:bg-hover"
          >
            <Icon name="save" size={18} className="text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">Save layout</span>
              <span className="block truncate text-[12px] text-muted">{activeName}</span>
            </span>
            <Icon name="chevronDown" size={16} className="text-muted" />
          </button>
          <div className="grid grid-cols-6 gap-2">
            <Tile
              span={6}
              icon="list"
              label="Order"
              onClick={() => {
                if (!actionsEnabled) return;
                onClose();
                openTicket({ side: 'buy', type: 'market' });
              }}
            />
            <Tile span={3} icon="list" label="Object tree" onClick={() => setPanel('objects')} />
            <Tile span={3} icon="chart" label="Chart type" onClick={() => setPanel('chart')} />
            <Tile span={3} icon="star" label="Watchlist" onClick={() => setPanel('watchlist')} />
            <Tile span={3} icon="flag" label="News" onClick={() => setPanel('news')} />
            <Tile
              span={6}
              icon="activity"
              label={`Indicators (${indicatorCount})`}
              accent={indicatorCount > 0}
              onClick={() => setPanel('indicators')}
            />
            {sessionLinks ? (
              <Tile span={2} icon="journal" label="Journal" href={journalHref(snap.id)} />
            ) : null}
            <Tile
              span={2}
              icon="target"
              label="Positions and orders"
              onClick={() => setPanel('positions')}
            />
            {sessionLinks ? (
              <Tile span={2} icon="chart" label="Analytics" href={statsHref(snap.id)} />
            ) : null}
            <Tile span={3} icon="front" label="Layouts" onClick={() => setPanel('layouts')} />
            {sessionLinks ? (
              <Tile
                span={3}
                icon="settings"
                label="Settings"
                onClick={() => {
                  onClose();
                  openModal({ type: 'settings' });
                }}
              />
            ) : null}
            <Tile span={6} icon="home" label="Dashboard" href="/home" />
          </div>
        </div>
      ) : null}

      {panel === 'layouts' ? (
        <div className="flex flex-col gap-2 px-1">
          <button
            type="button"
            onClick={() => saveLayout(false)}
            className="h-11 rounded-xl bg-accent text-[14px] font-semibold text-white"
          >
            Save current layout
          </button>
          <button
            type="button"
            onClick={() => saveLayout(true)}
            className="h-11 rounded-xl border border-line text-[14px] font-medium hover:bg-hover"
          >
            Save as new layout
          </button>
          {layouts.length === 0 ? (
            <p className="px-1 py-6 text-center text-[13px] text-muted">No saved layouts yet.</p>
          ) : (
            layouts.map((layout) => (
              <div key={layout.id} className="flex items-center gap-2 rounded-xl bg-chart px-3">
                <button
                  type="button"
                  onClick={() => applyLayout(layout)}
                  className="flex h-12 min-w-0 flex-1 items-center text-left text-[14px]"
                >
                  <span className="truncate">{layout.name}</span>
                  {layout.id === activeId ? (
                    <Icon name="check" size={16} className="ml-2 shrink-0 text-accent" />
                  ) : null}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${layout.name}`}
                  onClick={() => {
                    const list = layouts.filter((l) => l.id !== layout.id);
                    void persistLayouts(list).then((err) => {
                      if (err) {
                        if (!isPlanLimitMessage(err)) pushToast(err, 'error');
                        return;
                      }
                      setLayouts(list);
                      if (activeId === layout.id) {
                        setActiveId(null);
                        writeActiveLayout(null);
                      }
                    });
                  }}
                  className="flex h-9 w-9 items-center justify-center text-muted hover:text-fg"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}

      {panel === 'chart' ? <ChartTypes onDone={() => setPanel(null)} /> : null}
      {panel === 'objects' ? <ObjectTree /> : null}
      {panel === 'watchlist' ? (
        <div className="px-1 py-2">
          <div className="flex items-center gap-3 rounded-xl bg-chart px-3 py-3">
            <Icon name="check" size={16} className="text-accent" />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">{snap.settings.symbol}</span>
              <span className="block truncate text-[12px] text-muted">
                {symbol?.description || 'Session symbol'}
              </span>
            </span>
          </div>
          <p className="px-1 pt-3 text-[12px] leading-5 text-muted">
            This session stays on {snap.settings.symbol}.
          </p>
        </div>
      ) : null}
      {panel === 'news' ? (
        <p className="px-2 py-10 text-center text-[13px] leading-6 text-muted">
          No headlines for {snap.settings.symbol}.
        </p>
      ) : null}
      {panel === 'indicators' ? (
        <button
          type="button"
          onClick={() => {
            const next = !options.volumeVisible;
            app.settings.update(
              next ? { volumeVisible: true, volumeHidden: false } : { volumeVisible: false },
            );
          }}
          className="flex h-12 w-full items-center gap-3 rounded-xl bg-chart px-3 text-left"
        >
          <Icon name="activity" size={18} className={options.volumeVisible ? 'text-accent' : ''} />
          <span className="flex-1 text-[15px]">Volume</span>
          <Icon name={options.volumeVisible ? 'eye' : 'eyeOff'} size={16} className="text-muted" />
        </button>
      ) : null}
      {panel === 'positions' ? <TradingPanel sheet /> : null}
    </MobileSheet>
  );
}

function BarButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-chart text-[13px] font-medium hover:bg-hover disabled:opacity-35"
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}

function Tile({
  icon,
  label,
  span,
  onClick,
  href,
  accent,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly span: 2 | 3 | 6;
  readonly onClick?: () => void;
  readonly href?: string;
  readonly accent?: boolean;
}) {
  const spanClass = span === 6 ? 'col-span-6' : span === 3 ? 'col-span-3' : 'col-span-2';
  const className = `${spanClass} flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl bg-chart px-2 py-3 text-center text-[13px] leading-tight hover:bg-hover ${
    accent ? 'text-accent' : 'text-fg'
  }`;
  const body = (
    <>
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

function ChartTypes({ onDone }: { readonly onDone: () => void }) {
  const app = useApp();
  const current = useUiStore((s) => s.options.chartType);
  const types = seriesRegistry.list();
  return (
    <div className="flex flex-col">
      {types.map((t, i) => (
        <div key={t.id}>
          {i > 0 && t.group !== types[i - 1]!.group ? <div className="my-1 h-px bg-line" /> : null}
          <button
            type="button"
            onClick={() => {
              if (!guardPlan(chartTypeDenial(currentPlan(), t.id))) return;
              app.settings.update({ chartType: t.id });
              onDone();
            }}
            className={`flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-[14px] hover:bg-hover ${
              t.id === current ? 'text-accent' : 'text-fg'
            }`}
          >
            <Icon path={t.icon} size={18} />
            <span className="flex-1">{t.label}</span>
            {t.id === current ? <Icon name="check" size={16} /> : null}
          </button>
        </div>
      ))}
    </div>
  );
}

function ObjectTree() {
  const app = useApp();
  const selection = useUiStore((s) => s.selection);
  const drawingCount = useUiStore((s) => s.drawingCount);
  const items = drawingCount === 0 ? [] : app.drawings.serializeAll();
  if (items.length === 0) {
    return (
      <p className="px-2 py-10 text-center text-[13px] text-muted">No drawings on the chart.</p>
    );
  }
  return (
    <div className="flex flex-col">
      {items.map((d) => {
        const def = drawingRegistry.get(d.type);
        return (
          <div
            key={d.id}
            className={`flex h-12 items-center gap-2 border-b border-line/70 px-1 ${
              selection?.id === d.id ? 'text-accent' : 'text-fg'
            }`}
          >
            <button
              type="button"
              onClick={() => app.drawings.select(d.id)}
              className="flex h-full min-w-0 flex-1 items-center gap-3 text-left"
            >
              {def ? <Icon path={def.icon} size={18} /> : null}
              <span className={`truncate text-[14px] ${d.hidden ? 'text-muted line-through' : ''}`}>
                {def?.label ?? d.type}
              </span>
            </button>
            <button
              type="button"
              aria-label={d.hidden ? 'Show drawing' : 'Hide drawing'}
              onClick={() => app.drawings.setHidden(d.id, !d.hidden)}
              className="flex h-9 w-9 items-center justify-center text-muted hover:text-fg"
            >
              <Icon name={d.hidden ? 'eyeOff' : 'eye'} size={16} />
            </button>
            <button
              type="button"
              aria-label="Remove drawing"
              onClick={() => app.drawings.remove([d.id])}
              className="flex h-9 w-9 items-center justify-center text-muted hover:text-fg"
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
