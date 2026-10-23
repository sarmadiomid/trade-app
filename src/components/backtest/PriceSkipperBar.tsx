'use client';

import type { ReactNode } from 'react';
import { chordLabel } from '@/lib/app';
import { TIMEFRAMES } from '@/lib/core';
import { FREQUENCIES, TICKER_VALUES } from '@/lib/backtest';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { useBacktest } from './context';
import { faNum, failReasonFa, pnlClass, signedUsd, usd, utcDateTime } from './format';
import { QuickTradePanel } from './QuickTradePanel';
import { useBacktestStore } from './store';

const selectCls =
  'h-7 cursor-pointer appearance-none rounded-md bg-transparent pe-5 ps-2 text-[12.5px] font-semibold tabular-nums text-fg outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40';

/**
 * Replay bar: quick trade on the start side, playback in the true centre, account on the end side.
 * The side columns share the width equally so the playback group never moves when figures change.
 */
export function PriceSkipperBar() {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  const openModal = useBacktestStore((s) => s.openModal);
  const toggleProp = useBacktestStore((s) => s.toggleProp);
  const propOpen = useBacktestStore((s) => s.propOpen);
  const panelHidden = useBacktestStore((s) => s.panelHidden);
  const setPanelHidden = useBacktestStore((s) => s.setPanelHidden);
  const actionsEnabled = useBacktestStore((s) => s.actionsEnabled);
  const allowRewind = useBacktestStore((s) => s.allowRewind);
  const sessionLinks = useBacktestStore((s) => s.sessionLinks);
  if (!snap) return null;
  const ended = snap.status !== 'active';
  const blocked = ended || !actionsEnabled;
  const atStart = snap.cursor <= snap.start;
  const detailsOpen = !panelHidden;
  const open = snap.positions.length > 0;
  const pnl = open ? snap.floating : snap.realized;
  const progress = Math.max(0, Math.min(1, snap.progress));

  return (
    <div
      role="region"
      aria-label="نوار بازپخش"
      dir="rtl"
      className="relative grid h-[3.25rem] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 overflow-x-auto border-t border-line bg-panel px-2.5 text-[13px]"
    >
      <div
        className="absolute inset-x-0 -top-px h-0.5 bg-line/60"
        role="progressbar"
        aria-label="پیشرفت جلسه"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        title={`پیشرفت جلسه: ${faNum(progress * 100, 0)}٪ · ${faNum(snap.daysLeft)} روز مانده`}
      >
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex min-w-0 items-center justify-start">
        <QuickTradePanel dock />
      </div>

      <div
        dir="ltr"
        className="flex h-10 items-center gap-0.5 rounded-xl border border-line bg-chart/70 px-1 shadow-sm"
      >
        <IconButton
          icon="stepBack"
          label="یک کندل به عقب"
          shortcut={chordLabel('Alt+Z')}
          tooltipSide="top"
          disabled={!allowRewind || atStart || snap.loading || !actionsEnabled}
          onClick={() => void c.requestRewind()}
          className="text-muted hover:text-fg"
          size={16}
        />
        <Tooltip label={snap.playing ? 'مکث' : 'پخش'} shortcut={chordLabel('Alt+1')} side="top">
          <button
            type="button"
            aria-label={snap.playing ? 'مکث' : 'پخش'}
            aria-pressed={snap.playing}
            disabled={blocked}
            onClick={() => c.togglePlay()}
            data-testid="bt-play"
            className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
              snap.playing
                ? 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/50'
                : 'bg-accent text-accent-fg hover:brightness-110'
            }`}
          >
            {snap.loading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Icon
                name={snap.playing ? 'pause' : 'play'}
                size={14}
                strokeWidth={1.4}
                className={`fill-current ${snap.playing ? '' : 'ml-0.5'}`}
              />
            )}
          </button>
        </Tooltip>
        <IconButton
          icon="stepForward"
          label="کندل بعدی"
          shortcut={chordLabel('Ctrl+Space')}
          tooltipSide="top"
          disabled={blocked || snap.loading}
          onClick={() => void c.next()}
          data-testid="bt-next"
          className="text-muted hover:text-fg"
          size={16}
        />
        <Sep />
        <Tooltip label="گام بازپخش: اندازه هر قدم" shortcut="Alt + 4 / Alt + 5" side="top">
          <SelectWrap>
            <select
              aria-label="گام کندل"
              data-testid="bt-ticker"
              className={selectCls}
              value={snap.tickerValue}
              onChange={(e) => c.setTickerValue(e.target.value as (typeof TICKER_VALUES)[number])}
            >
              {TICKER_VALUES.map((tf) => (
                <option key={tf} value={tf}>
                  {TIMEFRAMES[tf].label}
                </option>
              ))}
            </select>
          </SelectWrap>
        </Tooltip>
        <Tooltip label="سرعت پخش: کندل در ثانیه" shortcut="Alt + 2 / Alt + 3" side="top">
          <SelectWrap>
            <select
              aria-label="سرعت پخش"
              data-testid="bt-frequency"
              className={selectCls}
              value={snap.frequency}
              onChange={(e) => c.setFrequency(Number(e.target.value))}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}x
                </option>
              ))}
            </select>
          </SelectWrap>
        </Tooltip>
        <Sep />
        <Tooltip label="پرش به تاریخ و ساعت" side="top">
          <button
            type="button"
            dir="rtl"
            disabled={blocked || snap.loading}
            onClick={() => openModal({ type: 'go-to' })}
            className="flex h-8 w-[10.5rem] items-center justify-center gap-1.5 rounded-md px-2 text-fg hover:bg-hover disabled:opacity-60"
          >
            <Icon name="calendar" size={14} className="shrink-0 text-muted" />
            <span className="truncate text-[12.5px] font-medium" data-testid="bt-cursor">
              {utcDateTime(snap.cursor)}
            </span>
            <span className="shrink-0 rounded bg-hover px-1 text-[9.5px] font-semibold text-muted">
              UTC
            </span>
          </button>
        </Tooltip>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1">
        {ended ? (
          <span
            className={`hidden truncate rounded-md px-2 py-1 text-[12px] font-medium xl:inline ${
              snap.status === 'ended' ? 'bg-hover text-muted' : 'bg-down/15 text-down'
            }`}
          >
            {snap.status === 'ended'
              ? 'جلسه تمام شد'
              : `متوقف شد${snap.failReason ? ` · ${failReasonFa(snap.failReason)}` : ''}`}
          </span>
        ) : (
          <span
            className="hidden shrink-0 rounded-md bg-[#f7a6001f] px-2 py-1 text-[11.5px] font-medium text-[#f7a600] 2xl:inline"
            title="روزهای باقی‌مانده از بازه جلسه"
          >
            {faNum(snap.daysLeft)} روز مانده
          </span>
        )}
        <Stat label="ارزش خالص" value={usd(snap.equity)} testId="bt-equity" />
        <Stat
          label={open ? 'سود شناور' : 'سود قطعی'}
          value={signedUsd(pnl)}
          cls={pnlClass(pnl)}
          testId="bt-pnl"
        />
        <span className="mx-1 h-6 w-px shrink-0 bg-line" />
        {snap.prop && sessionLinks ? (
          <Tooltip label="قوانین پراپ" shortcut="Tab" side="top">
            <button
              type="button"
              aria-pressed={propOpen}
              onClick={() => toggleProp()}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium ${
                propOpen ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-hover hover:text-fg'
              }`}
            >
              <Icon name="shield" size={15} />
              <span className="hidden xl:inline">پراپ</span>
            </button>
          </Tooltip>
        ) : null}
        <Tooltip label={detailsOpen ? 'پنهان کردن جزئیات' : 'نمایش معاملات و سفارش‌ها'} side="top">
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-label={detailsOpen ? 'پنهان کردن جزئیات معامله' : 'نمایش جزئیات معامله'}
            data-testid="toggle-trading-panel"
            onClick={() => setPanelHidden(detailsOpen)}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium ${
              detailsOpen ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-hover hover:text-fg'
            }`}
          >
            <Icon name="list" size={15} />
            <span className="hidden xl:inline">معاملات</span>
            {snap.positions.length > 0 ? (
              <span className="min-w-4 rounded-full bg-accent px-1 text-center text-[10.5px] font-bold leading-4 text-accent-fg">
                {faNum(snap.positions.length)}
              </span>
            ) : null}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-line" />;
}

function SelectWrap({ children }: { readonly children: ReactNode }) {
  return (
    <span className="relative inline-flex items-center">
      {children}
      <Icon
        name="chevronDown"
        size={12}
        className="pointer-events-none absolute right-1 text-muted"
      />
    </span>
  );
}

function Stat({
  label,
  value,
  cls = 'text-fg',
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly cls?: string;
  readonly testId?: string;
}) {
  return (
    <div className="flex min-w-[5.75rem] shrink-0 flex-col items-start px-1.5 leading-tight">
      <span className="text-[10.5px] text-muted">{label}</span>
      <span className={`text-[13px] font-semibold tabular-nums ${cls}`} data-testid={testId}>
        {value}
      </span>
    </div>
  );
}
