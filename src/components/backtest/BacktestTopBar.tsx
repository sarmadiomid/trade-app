'use client';

import Link from 'next/link';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { chordLabel } from '@/lib/app';
import { isTimeframeId } from '@/lib/core';
import { seriesRegistry } from '@/lib/series';
import {
  readActiveLayout,
  readLayouts,
  writeActiveLayout,
  writeLayouts,
  type ChartLayout,
} from '../chart/mobile/layouts';
import { useVolumeChip } from '../chart/mobile/mobile-ui';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { ChartTypeMenu } from '../toolbar/ChartTypeMenu';
import { TimeframeBar } from '../toolbar/TimeframeBar';
import { Divider } from '../ui/Divider';
import { statsHref } from '../home/stats-href';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import type { IconName } from '../ui/icons';
import { Popover } from '../ui/Popover';
import { Tooltip } from '../ui/Tooltip';
import { captureChart } from './capture';
import { BacktestContext } from './context';
import { useBacktestStore } from './store';

const FLOW = ['volume-footprint', 'session-volume-profile', 'tpo'] as const;

const FLOW_FA: Readonly<Record<string, string>> = {
  'volume-footprint': 'فوت‌پرینت حجم',
  'session-volume-profile': 'پروفایل حجم سشن',
  tpo: 'TPO (نمای بازار)',
};

const ghost =
  'inline-flex h-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40';

/** Desktop session bar: symbol & playback capsule on the left, intervals & order-flow in the center, session & tools on the right. */
export function BacktestTopBar() {
  const app = useApp();
  const c = useContext(BacktestContext);
  const snap = useBacktestStore((s) => s.snap);
  const openModal = useBacktestStore((s) => s.openModal);
  const openTicket = useBacktestStore((s) => s.openTicket);
  const toggleProp = useBacktestStore((s) => s.toggleProp);
  const symbol = useUiStore((s) => s.symbol);
  const timeframe = useUiStore((s) => s.timeframe);
  const chartType = useUiStore((s) => s.options.chartType);
  const volumeOn = useUiStore((s) => s.options.volumeVisible);
  const history = useUiStore((s) => s.history);
  const theme = useUiStore((s) => s.activeTheme);
  const openDialog = useUiStore((s) => s.openDialog);
  const pushToast = useUiStore((s) => s.pushToast);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const name = snap?.settings.symbol ?? symbol?.symbol ?? '';
  const ended = snap ? snap.status !== 'active' : true;
  const playing = snap?.playing ?? false;
  const flowOn = (FLOW as readonly string[]).includes(chartType);
  const prop = snap?.settings.type === 'prop';

  const shoot = () => {
    const url = captureChart();
    if (!url) {
      pushToast('نمودار هنوز آماده نیست', 'error');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'chart'}.jpg`;
    a.click();
  };

  const toggleFull = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const el = document.documentElement;
    if (!el.requestFullscreen) {
      pushToast('تمام‌صفحه در این مرورگر پشتیبانی نمی‌شود', 'error');
      return;
    }
    el.requestFullscreen().catch(() =>
      pushToast('تمام‌صفحه در این مرورگر پشتیبانی نمی‌شود', 'error'),
    );
  };

  return (
    <header
      dir="ltr"
      className="@container/bar flex h-11 shrink-0 items-center gap-1 overflow-clip border-b border-line bg-panel/95 px-2 text-[13px] text-fg backdrop-blur-md"
    >
      {/* Back to Sessions */}
      <Tooltip label="بازگشت به جلسه‌ها">
        <Link
          href="/backtest"
          aria-label="بازگشت به جلسه‌ها"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <Icon name="chevronLeft" size={17} />
        </Link>
      </Tooltip>

      {/* Instrument + Play + Quick Order Capsule */}
      <div className="flex h-8 shrink-0 items-center gap-0.5 rounded-lg bg-chart/70 p-0.5 ring-1 ring-inset ring-line/80">
        <Tooltip label={playing ? 'مکث بازپخش' : 'پخش بازپخش'} shortcut={chordLabel('Alt+1')}>
          <button
            type="button"
            aria-label={playing ? 'مکث' : 'پخش'}
            disabled={!c || ended}
            onClick={() => c?.togglePlay()}
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40 ${
              playing
                ? 'bg-accent text-accent-fg shadow-xs'
                : 'text-muted hover:bg-hover hover:text-fg'
            }`}
          >
            <Icon
              name={playing ? 'pause' : 'play'}
              size={13}
              strokeWidth={1.4}
              className={playing ? 'fill-current' : 'ml-px fill-current'}
            />
          </button>
        </Tooltip>

        <div className="flex items-center gap-1.5 px-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              ended ? 'bg-muted' : 'bg-up shadow-[0_0_6px_var(--tc-up)]'
            }`}
            aria-hidden="true"
          />
          <span className="max-w-30 truncate text-[13px] font-bold tracking-wide text-fg">
            {name || '…'}
          </span>
        </div>

        <Tooltip label="سفارش جدید" shortcut="Alt + N">
          <button
            type="button"
            aria-label="سفارش جدید"
            disabled={!c || ended}
            onClick={() => openTicket({ side: 'buy', type: 'market' })}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/15 hover:text-accent disabled:opacity-40"
          >
            <Icon name="plus" size={15} />
          </button>
        </Tooltip>
      </div>

      <Divider />

      {/* Timeframes */}
      <TimeframeBar />

      <Divider />

      {/* Chart Type */}
      <ChartTypeMenu />

      {/* Indicators Dropdown */}
      <Drop
        label="اندیکاتورها"
        active={volumeOn}
        className="gap-1.5 px-2"
        button={
          <>
            <Icon name="activity" size={15} />
            <span className="hidden @min-[1280px]/bar:inline">اندیکاتورها</span>
          </>
        }
      >
        {(close) => (
          <div dir="rtl" className="-m-1.5 flex min-w-52 flex-col p-1" role="menu">
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={volumeOn}
              onClick={() => {
                const next = !volumeOn;
                app.settings.update({ volumeVisible: next });
                if (next) useVolumeChip.getState().setOpen(true);
                close();
              }}
              className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[12.5px] text-fg transition-colors hover:bg-hover"
            >
              <Icon name="activity" size={15} className={volumeOn ? 'text-accent' : 'text-muted'} />
              <span className="flex-1 text-start">حجم معاملات</span>
              <Icon
                name={volumeOn ? 'eye' : 'eyeOff'}
                size={14}
                className={volumeOn ? 'text-accent' : 'text-muted'}
              />
            </button>
          </div>
        )}
      </Drop>

      {/* Order Flow Dropdown */}
      <Drop
        label="جریان سفارش"
        active={flowOn}
        className="gap-1.5 px-2"
        button={
          <>
            <FlowMark />
            <span className="hidden @min-[1400px]/bar:inline">جریان سفارش</span>
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9.5px] font-bold leading-none text-accent">
              NEW
            </span>
          </>
        }
      >
        {(close) => (
          <div dir="rtl" className="-m-1.5 flex min-w-56 flex-col gap-0.5 p-1" role="menu">
            <div className="px-2 pt-0.5 pb-1 text-[10.5px] font-semibold text-muted">
              ابزارهای جریان سفارش
            </div>
            {FLOW.map((id) => {
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
                    close();
                    app.settings.update({ chartType: id });
                  }}
                  className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-start text-[12.5px] transition-colors ${
                    on ? 'bg-accent/15 font-semibold text-accent' : 'text-fg hover:bg-hover'
                  }`}
                >
                  <Icon path={def.icon} size={16} className={on ? 'text-accent' : 'text-muted'} />
                  <span className="flex-1">{FLOW_FA[id] ?? def.label}</span>
                  {on ? <Icon name="check" size={14} className="text-accent" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </Drop>

      <div className="min-w-0 flex-1" />

      {/* Session Navigation & Quick Links */}
      {snap ? (
        <div className="hidden items-center gap-1 @min-[1120px]/bar:flex">
          <Tooltip label="دفتر معاملات">
            <Link
              href={`/backtest/${snap.id}/journal`}
              className={`${ghost} gap-1.5 px-2 text-[12.5px] font-medium`}
            >
              <Icon name="journal" size={15} />
              <span className="hidden @min-[1400px]/bar:inline">دفتر</span>
            </Link>
          </Tooltip>
          <Tooltip label="تحلیل عملکرد جلسه">
            <Link
              href={statsHref(snap.id)}
              data-testid="open-analytics"
              className={`${ghost} gap-1.5 px-2 text-[12.5px] font-medium`}
            >
              <Icon name="chart" size={15} />
              <span className="hidden @min-[1280px]/bar:inline">تحلیل</span>
            </Link>
          </Tooltip>
        </div>
      ) : null}

      {/* Session Dropdown Capsule */}
      <Drop
        label="جلسه"
        className="min-w-0 max-w-32 gap-1.5 overflow-hidden rounded-lg bg-chart/65 px-2 text-fg ring-1 ring-inset ring-line/80 @min-[1200px]/bar:max-w-44"
        button={
          <>
            {snap ? (
              <span
                className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold sm:inline ${
                  prop ? 'bg-[#f7a60024] text-[#f7a600]' : 'bg-accent/15 text-accent'
                }`}
              >
                {prop ? 'پراپ' : 'شخصی'}
              </span>
            ) : null}
            <span className="min-w-0 truncate text-[12.5px] font-semibold">
              {snap?.settings.name ?? 'جلسه'}
            </span>
            <Icon name="chevronDown" size={13} className="shrink-0 text-muted" />
          </>
        }
      >
        {(close) => (
          <div className="-m-1.5 flex min-w-52 flex-col gap-0.5 p-1" dir="rtl" role="menu">
            {snap ? (
              <div className="mb-1 border-b border-line/70 px-2 pb-2 pt-1">
                <div className="truncate text-[13px] font-bold text-fg">{snap.settings.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                  <span dir="ltr" className="font-mono font-semibold text-fg">
                    {snap.settings.symbol}
                  </span>
                  <span>·</span>
                  <span>{prop ? 'ارزیابی پراپ' : 'حساب شخصی'}</span>
                </div>
              </div>
            ) : null}
            <MenuItem
              icon="info"
              onClick={() => {
                close();
                openModal({ type: 'settings' });
              }}
            >
              مشخصات و قوانین جلسه
            </MenuItem>
            {prop ? (
              <MenuItem
                icon="shield"
                onClick={() => {
                  close();
                  toggleProp();
                }}
              >
                پنجره قوانین پراپ
              </MenuItem>
            ) : null}
            {snap ? (
              <>
                <Link
                  href={`/backtest/${snap.id}/journal`}
                  onClick={close}
                  className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[12.5px] text-fg transition-colors hover:bg-hover"
                >
                  <Icon name="journal" size={15} className="text-muted" />
                  <span>دفتر معاملات</span>
                </Link>
                <Link
                  href={statsHref(snap.id)}
                  onClick={close}
                  className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[12.5px] text-fg transition-colors hover:bg-hover"
                >
                  <Icon name="chart" size={15} className="text-muted" />
                  <span>تحلیل عملکرد</span>
                </Link>
              </>
            ) : null}
            <div role="separator" className="my-1 h-px bg-line/70" />
            <MenuItem
              icon="keyboard"
              onClick={() => {
                close();
                openModal({ type: 'shortcuts' });
              }}
            >
              میانبرهای صفحه‌کلید
            </MenuItem>
            <MenuItem
              icon="palette"
              onClick={() => {
                close();
                openDialog({ type: 'theme-editor' });
              }}
            >
              پوسته‌های نمودار
            </MenuItem>
          </div>
        )}
      </Drop>

      <Divider />

      {/* Undo / Redo Pill Group */}
      <div className="flex items-center rounded-lg bg-chart/50 p-0.5 ring-1 ring-inset ring-line/70">
        <IconButton
          icon="undo"
          label="واگرد"
          shortcut={chordLabel('Ctrl+Z')}
          disabled={!history.canUndo}
          onClick={() => app.history.undo()}
          className="h-7 min-w-7 px-1"
          size={16}
        />
        <IconButton
          icon="redo"
          label="انجام دوباره"
          shortcut={chordLabel('Ctrl+Y')}
          disabled={!history.canRedo}
          onClick={() => app.history.redo()}
          className="h-7 min-w-7 px-1"
          size={16}
        />
      </div>

      {/* Layout Switcher & Save */}
      <LayoutControl
        snapshot={() => ({
          chartType,
          timeframe,
          themeId: theme.id,
          volumeVisible: volumeOn,
        })}
        apply={(layout) => {
          app.settings.update({ chartType: layout.chartType, volumeVisible: layout.volumeVisible });
          if (isTimeframeId(layout.timeframe)) void app.setTimeframe(layout.timeframe);
          app.themes.setActive(layout.themeId);
          if (layout.volumeVisible) useVolumeChip.getState().setOpen(true);
        }}
      />

      <Divider />

      {/* Utility Icons */}
      <div className="flex shrink-0 items-center gap-0.5">
        <span className="hidden @min-[1200px]/bar:contents">
          <IconButton
            icon="palette"
            label="پوسته‌ها"
            onClick={() => openDialog({ type: 'theme-editor' })}
            size={16}
          />
          <IconButton
            icon="keyboard"
            label="میانبرها"
            shortcut="?"
            onClick={() => openModal({ type: 'shortcuts' })}
            size={16}
          />
          <IconButton icon="camera" label="ذخیره تصویر نمودار" onClick={shoot} size={16} />
        </span>
        <IconButton
          icon="settings"
          label="تنظیمات نمودار"
          shortcut="Ctrl + ,"
          onClick={() => openDialog({ type: 'settings' })}
          size={16}
        />
        <IconButton
          icon="expand"
          label={full ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}
          active={full}
          onClick={toggleFull}
          size={16}
        />
      </div>
    </header>
  );
}

function LayoutControl({
  snapshot,
  apply,
}: {
  readonly snapshot: () => Omit<ChartLayout, 'id' | 'name'>;
  readonly apply: (layout: ChartLayout) => void;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [layouts, setLayouts] = useState<ChartLayout[]>(readLayouts);
  const [activeId, setActiveId] = useState<string | null>(readActiveLayout);
  const active = layouts.find((l) => l.id === activeId);

  const save = () => {
    const body = snapshot();
    const next: ChartLayout = active
      ? { ...active, ...body }
      : { id: crypto.randomUUID(), name: `Layout ${layouts.length + 1}`, ...body };
    const list = layouts.some((l) => l.id === next.id)
      ? layouts.map((l) => (l.id === next.id ? next : l))
      : [...layouts, next];
    setLayouts(list);
    setActiveId(next.id);
    writeLayouts(list);
    writeActiveLayout(next.id);
    pushToast(`چیدمان «${next.name}» ذخیره شد`, 'success');
  };

  return (
    <div className="hidden items-center rounded-lg bg-chart/50 ring-1 ring-inset ring-line/70 @min-[1400px]/bar:flex">
      <Tooltip label="ذخیره چیدمان فعلی">
        <button
          type="button"
          aria-label="ذخیره چیدمان"
          onClick={save}
          className="inline-flex h-8 w-7 items-center justify-center rounded-l-lg text-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <Icon name="grid" size={14} />
        </button>
      </Tooltip>
      <span className="h-4 w-px bg-line/70" />
      <Drop
        label="چیدمان"
        className="max-w-28 gap-1 rounded-l-none rounded-r-lg px-2 text-[12px]"
        button={
          <>
            <span className="truncate font-medium text-fg">{active?.name ?? 'Default'}</span>
            <Icon name="chevronDown" size={12} className="shrink-0 text-muted" />
          </>
        }
      >
        {(close) => (
          <div dir="rtl" className="-m-1.5 flex min-w-44 flex-col gap-0.5 p-1" role="menu">
            <div className="px-2 pt-0.5 pb-1 text-[10.5px] font-semibold text-muted">
              چیدمان‌های ذخیره‌شده
            </div>
            {layouts.map((layout) => {
              const isCurrent = layout.id === activeId;
              return (
                <button
                  key={layout.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isCurrent}
                  onClick={() => {
                    close();
                    setActiveId(layout.id);
                    writeActiveLayout(layout.id);
                    apply(layout);
                  }}
                  className={`flex h-8 items-center justify-between gap-2 rounded-md px-2 text-start text-[12.5px] transition-colors ${
                    isCurrent ? 'bg-accent/15 font-semibold text-accent' : 'text-fg hover:bg-hover'
                  }`}
                >
                  <span dir="ltr" className="truncate">
                    {layout.name}
                  </span>
                  {isCurrent ? <Icon name="check" size={14} className="text-accent" /> : null}
                </button>
              );
            })}
            {layouts.length > 0 ? <div role="separator" className="my-1 h-px bg-line/70" /> : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                save();
              }}
              className="flex h-8 items-center gap-2 rounded-md px-2 text-start text-[12.5px] text-accent transition-colors hover:bg-hover"
            >
              <Icon name="save" size={14} />
              <span>ذخیره چیدمان فعلی</span>
            </button>
          </div>
        )}
      </Drop>
    </div>
  );
}

function Drop({
  label,
  button,
  active = false,
  className = '',
  children,
}: {
  readonly label: string;
  readonly button: ReactNode;
  readonly active?: boolean;
  readonly className?: string;
  readonly children: (close: () => void) => ReactNode;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  const isOpen = anchor !== null;
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className={`inline-flex h-8 shrink-0 items-center justify-center rounded-lg text-[12.5px] font-medium transition-colors ${
          active || isOpen
            ? 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/30'
            : 'text-muted hover:bg-hover hover:text-fg'
        } ${className}`}
      >
        {button}
      </button>
      {anchor ? (
        <Popover anchor={anchor} onClose={close}>
          {children(close)}
        </Popover>
      ) : null}
    </>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  disabled,
}: {
  readonly icon?: IconName;
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 items-center gap-2.5 rounded-md px-2 text-start text-[12.5px] text-fg transition-colors hover:bg-hover disabled:opacity-40"
    >
      {icon ? <Icon name={icon} size={15} className="text-muted" /> : null}
      <span>{children}</span>
    </button>
  );
}

function FlowMark() {
  const icon = seriesRegistry.get('volume-footprint')?.icon;
  return icon ? <Icon path={icon} size={15} /> : <Icon name="activity" size={15} />;
}
