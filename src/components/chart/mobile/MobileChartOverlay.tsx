'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { drawingRegistry, type AnyToolDefinition } from '@/lib/drawings';
import { useApp } from '../../state/app-context';
import { useFavoritesStore } from '../../state/favorites-store';
import { useUiStore } from '../../state/ui-store';
import { Icon } from '../../ui/Icon';
import { captureChart } from '../../backtest/capture';
import { MobileToolsSheet } from './MobileToolsSheet';

/** Phone chrome over the chart: screenshot, tools, the volume pill, and pinned tools. */
export function MobileChartOverlay({
  start,
  below,
}: {
  readonly start?: ReactNode;
  readonly below?: ReactNode;
}) {
  const app = useApp();
  const symbol = useUiStore((s) => s.symbol?.symbol ?? 'chart');
  const pushToast = useUiStore((s) => s.pushToast);
  const tools = useFavoritesStore((s) => s.tools);
  const visible = useFavoritesStore((s) => s.visible);
  const vertical = useFavoritesStore((s) => s.vertical);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const active = useUiStore((s) => s.activeTool);

  const defs = tools
    .map((id) => drawingRegistry.get(id))
    .filter((d): d is AnyToolDefinition => !!d);
  const showDock = visible && defs.length > 0;

  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const el = document.documentElement;
    if (!el.requestFullscreen) {
      pushToast('Full screen is not supported on this browser', 'error');
      return;
    }
    el.requestFullscreen().catch(() =>
      pushToast('Full screen is not supported on this browser', 'error'),
    );
  };

  const shoot = () => {
    const url = captureChart();
    if (!url) {
      pushToast('Chart is not ready yet', 'error');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symbol}.jpg`;
    a.click();
  };

  return (
    <div className="chart-mob pointer-events-none absolute inset-0 z-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-2 pt-[max(8px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <div className="pointer-events-auto flex min-w-0 items-center gap-1">
            {start}
            {showDock && !vertical ? (
              <Dock
                defs={defs}
                active={active}
                onPick={(id) => app.drawings.setTool(active === id ? null : id)}
              />
            ) : null}
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1">
            <span className="mr-1 h-7 w-px bg-line" />
            <TopIcon label="Save chart image" icon="camera" onClick={shoot} />
            <TopIcon
              label="Drawing tools"
              icon="plus"
              testId="mobile-tools"
              boxed
              active={toolsOpen}
              onClick={() => setToolsOpen(true)}
            />
            <TopIcon
              label={fullscreen ? 'Exit full screen' : 'Full screen'}
              icon="expand"
              active={fullscreen}
              onClick={toggleFullscreen}
            />
          </div>
        </div>
        {below}
      </div>

      {showDock && vertical ? (
        <Dock
          defs={defs}
          active={active}
          vertical
          onPick={(id) => app.drawings.setTool(active === id ? null : id)}
        />
      ) : null}

      {toolsOpen ? <MobileToolsSheet onClose={() => setToolsOpen(false)} /> : null}
    </div>
  );
}

function Dock({
  defs,
  active,
  vertical = false,
  onPick,
}: {
  readonly defs: readonly AnyToolDefinition[];
  readonly active: string | null;
  readonly vertical?: boolean;
  readonly onPick: (id: string) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Favorite drawing tools"
      className={`pointer-events-auto z-20 flex gap-1 ${
        vertical
          ? 'absolute top-24 left-1.5 max-h-[50vh] flex-col overflow-y-auto rounded-xl border border-line bg-panel/95 p-1 shadow-lg'
          : 'min-w-0 flex-row overflow-x-auto [scrollbar-width:none]'
      }`}
    >
      {defs.map((def) => (
        <button
          key={def.id}
          type="button"
          aria-label={def.label}
          aria-pressed={active === def.id}
          onClick={() => onPick(def.id)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            active === def.id ? 'bg-accent/20 text-accent' : 'text-fg hover:bg-hover'
          }`}
        >
          <Icon path={def.icon} size={18} />
        </button>
      ))}
    </div>
  );
}

function TopIcon({
  label,
  icon,
  onClick,
  active,
  testId,
  boxed,
}: {
  readonly label: string;
  readonly icon: 'camera' | 'plus' | 'expand';
  readonly onClick: () => void;
  readonly active?: boolean;
  readonly testId?: string;
  readonly boxed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      data-testid={testId}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-fg hover:bg-hover ${
        boxed ? 'border border-line bg-panel/90 shadow-md' : ''
      } ${active ? 'text-accent' : ''}`}
    >
      <Icon name={icon} size={boxed ? 22 : 19} />
    </button>
  );
}
