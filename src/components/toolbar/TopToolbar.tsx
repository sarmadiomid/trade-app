'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { chartTypeDenial, chordLabel, currentPlan, guardPlan } from '@/lib/app';
import { seriesRegistry } from '@/lib/series';
import { captureChart } from '../backtest/capture';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Divider } from '../ui/Divider';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Popover } from '../ui/Popover';
import { Tooltip } from '../ui/Tooltip';
import { ChartTypeMenu } from './ChartTypeMenu';
import { MoreMenu } from './MoreMenu';
import { ReplayButton } from './ReplayButton';
import { TimeframeBar } from './TimeframeBar';
import { useToolbarText } from './toolbar-locale';

export interface TopToolbarProps {
  readonly end?: ReactNode;
  /** Rendered before the symbol button (e.g. a back link). */
  readonly start?: ReactNode;
  /** The symbol is fixed: no symbol search. */
  readonly symbolLocked?: boolean;
  readonly hideReplay?: boolean;
}

const SOURCE_FA: Readonly<Record<string, string>> = {
  binance: 'بایننس',
  synthetic: 'داده ساختگی',
  mock: 'داده نمونه',
};

const FLOW_IDS = ['volume-footprint', 'session-volume-profile', 'tpo'] as const;

export function TopToolbar({
  end,
  start,
  symbolLocked = false,
  hideReplay = false,
}: TopToolbarProps) {
  const app = useApp();
  const symbol = useUiStore((s) => s.symbol);
  const history = useUiStore((s) => s.history);
  const source = useUiStore((s) => s.source);
  const chartType = useUiStore((s) => s.options.chartType);
  const volumeOn = useUiStore((s) => s.options.volumeVisible);
  const openDialog = useUiStore((s) => s.openDialog);
  const pushToast = useUiStore((s) => s.pushToast);
  const { fa, t } = useToolbarText();

  const [indAnchor, setIndAnchor] = useState<HTMLElement | null>(null);
  const [flowAnchor, setFlowAnchor] = useState<HTMLElement | null>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const flowOn = (FLOW_IDS as readonly string[]).includes(chartType);
  const flowIcon = seriesRegistry.get('volume-footprint')?.icon;

  const shoot = () => {
    const url = captureChart();
    if (!url) {
      pushToast(fa ? 'نمودار هنوز آماده نیست' : 'Chart is not ready yet', 'error');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symbol?.symbol || 'chart'}.jpg`;
    a.click();
  };

  const toggleFull = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const el = document.documentElement;
    if (!el.requestFullscreen) {
      pushToast(
        fa
          ? 'تمام‌صفحه در این مرورگر پشتیبانی نمی‌شود'
          : 'Full screen is not supported on this browser',
        'error',
      );
      return;
    }
    el.requestFullscreen().catch(() =>
      pushToast(
        fa
          ? 'تمام‌صفحه در این مرورگر پشتیبانی نمی‌شود'
          : 'Full screen is not supported on this browser',
        'error',
      ),
    );
  };

  return (
    <header
      dir="ltr"
      className="@container/bar flex h-11 shrink-0 items-center gap-1 overflow-clip border-b border-line bg-panel/95 px-2 backdrop-blur-md"
    >
      {start}

      {symbolLocked ? (
        <span
          dir="ltr"
          className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-chart/70 px-2.5 text-[13px] font-bold tracking-wide text-fg ring-1 ring-inset ring-line/80"
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-up shadow-[0_0_6px_var(--tc-up)]"
            aria-hidden="true"
          />
          <span className="max-w-30 truncate">{symbol?.symbol ?? '…'}</span>
        </span>
      ) : (
        <Tooltip label={t('Symbol search')} shortcut="Ctrl + K">
          <button
            type="button"
            onClick={() => openDialog({ type: 'symbol-search' })}
            className="group flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-chart/65 px-2.5 text-[13px] font-bold tracking-wide text-fg ring-1 ring-inset ring-line/80 transition-colors hover:bg-hover hover:ring-accent/40"
          >
            <Icon
              name="search"
              size={15}
              className="text-muted transition-colors group-hover:text-accent"
            />
            <span dir="ltr" className="max-w-30 truncate">
              {symbol?.symbol ?? '…'}
            </span>
            <kbd className="hidden rounded bg-panel/90 px-1 py-0.5 font-mono text-[10px] font-medium text-muted ring-1 ring-inset ring-line @min-[1360px]/bar:inline">
              ⌘K
            </kbd>
          </button>
        </Tooltip>
      )}

      <Divider />
      <TimeframeBar />
      <Divider />
      <ChartTypeMenu />

      <Tooltip label={t('Indicators')}>
        <button
          type="button"
          aria-label={t('Indicators')}
          aria-haspopup="menu"
          aria-expanded={indAnchor !== null}
          onClick={(e) => setIndAnchor(indAnchor ? null : e.currentTarget)}
          className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium transition-colors ${
            indAnchor !== null || volumeOn ? 'bg-accent/12 text-accent' : 'text-fg hover:bg-hover'
          }`}
        >
          <Icon name="activity" size={15} />
          <span className="hidden @min-[1320px]/bar:inline">{t('Indicators')}</span>
        </button>
      </Tooltip>
      {indAnchor ? (
        <Popover anchor={indAnchor} onClose={() => setIndAnchor(null)}>
          <div dir={fa ? 'rtl' : 'ltr'} className="-m-1.5 flex min-w-52 flex-col p-1" role="menu">
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={volumeOn}
              onClick={() => {
                const next = !volumeOn;
                app.settings.update(
                  next ? { volumeVisible: true, volumeHidden: false } : { volumeVisible: false },
                );
                setIndAnchor(null);
              }}
              className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[12.5px] text-fg transition-colors hover:bg-hover"
            >
              <Icon name="activity" size={15} className={volumeOn ? 'text-accent' : 'text-muted'} />
              <span className="flex-1 text-start">{t('Volume')}</span>
              <Icon
                name={volumeOn ? 'eye' : 'eyeOff'}
                size={14}
                className={volumeOn ? 'text-accent' : 'text-muted'}
              />
            </button>
          </div>
        </Popover>
      ) : null}

      <Tooltip label={t('Order Flow')}>
        <button
          type="button"
          aria-label={t('Order Flow')}
          aria-haspopup="menu"
          aria-expanded={flowAnchor !== null}
          onClick={(e) => setFlowAnchor(flowAnchor ? null : e.currentTarget)}
          className={`hidden h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium transition-colors @min-[1100px]/bar:inline-flex ${
            flowOn || flowAnchor !== null
              ? 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/30'
              : 'text-muted hover:bg-hover hover:text-fg'
          }`}
        >
          {flowIcon ? <Icon path={flowIcon} size={15} /> : <Icon name="activity" size={15} />}
          <span className="hidden @min-[1440px]/bar:inline">{t('Order Flow')}</span>
          <span className="rounded bg-accent/15 px-1 py-0.5 text-[9.5px] font-bold leading-none text-accent">
            PRO
          </span>
        </button>
      </Tooltip>
      {flowAnchor ? (
        <Popover anchor={flowAnchor} onClose={() => setFlowAnchor(null)}>
          <div
            dir={fa ? 'rtl' : 'ltr'}
            className="-m-1.5 flex min-w-56 flex-col gap-0.5 p-1"
            role="menu"
          >
            <div className="px-2 pt-0.5 pb-1 text-[10.5px] font-semibold tracking-wider text-muted uppercase">
              {t('Order Flow')}
            </div>
            {FLOW_IDS.map((id) => {
              const def = seriesRegistry.get(id);
              if (!def) return null;
              const on = chartType === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => {
                    if (!guardPlan(chartTypeDenial(currentPlan(), id))) return;
                    setFlowAnchor(null);
                    app.settings.update({ chartType: id });
                  }}
                  className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-start text-[12.5px] transition-colors ${
                    on ? 'bg-accent/15 font-semibold text-accent' : 'text-fg hover:bg-hover'
                  }`}
                >
                  <Icon path={def.icon} size={16} className={on ? 'text-accent' : 'text-muted'} />
                  <span className="flex-1">{t(def.label)}</span>
                  {on ? <Icon name="check" size={14} className="text-accent" /> : null}
                </button>
              );
            })}
          </div>
        </Popover>
      ) : null}

      <Divider />
      {hideReplay ? null : (
        <>
          <ReplayButton />
          <Divider />
        </>
      )}

      <div className="flex items-center rounded-lg bg-chart/50 p-0.5 ring-1 ring-inset ring-line/70">
        <IconButton
          icon="undo"
          label={history.undoLabel && !fa ? `Undo ${history.undoLabel}` : t('Undo')}
          shortcut={chordLabel('Ctrl+Z')}
          disabled={!history.canUndo}
          onClick={() => app.history.undo()}
          className="h-7 min-w-7 px-1"
          size={16}
        />
        <IconButton
          icon="redo"
          label={history.redoLabel && !fa ? `Redo ${history.redoLabel}` : t('Redo')}
          shortcut={chordLabel('Ctrl+Y')}
          disabled={!history.canRedo}
          onClick={() => app.history.redo()}
          className="h-7 min-w-7 px-1"
          size={16}
        />
      </div>

      <div className="min-w-0 flex-1" />

      {source ? (
        <span
          className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset @min-[1240px]/bar:inline-flex ${
            source === 'binance'
              ? 'bg-up/10 text-up ring-up/30'
              : 'bg-[#f7a6001a] text-[#f7a600] ring-[#f7a600]/30'
          }`}
          title={
            source === 'synthetic'
              ? fa
                ? 'داده ساختگی و قطعی (شبکه در دسترس نیست)'
                : 'Deterministic synthetic data (network unavailable)'
              : source === 'binance'
                ? fa
                  ? 'داده از بایننس'
                  : 'Binance REST data'
                : fa
                  ? 'داده نمونه بازار'
                  : 'Seeded mock market data'
          }
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {fa ? (SOURCE_FA[source] ?? source) : source.toUpperCase()}
        </span>
      ) : null}

      <div className="flex items-center gap-0.5">
        <span className="hidden @min-[1080px]/bar:contents">
          <IconButton icon="camera" label={t('Save chart image')} onClick={shoot} size={16} />
          <IconButton
            icon="palette"
            label={t('Themes')}
            onClick={() => openDialog({ type: 'theme-editor' })}
            size={16}
          />
          {fa ? null : (
            <IconButton
              icon="keyboard"
              label={t('Keyboard shortcuts')}
              shortcut="?"
              onClick={() => openDialog({ type: 'shortcuts' })}
              size={16}
            />
          )}
        </span>
        <IconButton
          icon="settings"
          label={t('Chart settings')}
          shortcut="Ctrl + ,"
          onClick={() => openDialog({ type: 'settings' })}
          size={16}
        />
        <span className="hidden @min-[1080px]/bar:contents">
          <IconButton
            icon="expand"
            label={full ? t('Exit full screen') : t('Full screen')}
            active={full}
            onClick={toggleFull}
            size={16}
          />
        </span>
        <MoreMenu />
      </div>

      {end}
    </header>
  );
}
