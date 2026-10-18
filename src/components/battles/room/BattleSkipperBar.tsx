'use client';

import { chordLabel } from '@/lib/app';
import { TIMEFRAMES } from '@/lib/core';
import { FREQUENCIES, TICKER_VALUES } from '@/lib/backtest';
import { useBacktest } from '../../backtest/context';
import { faNum, TF_FA, utcDateTime } from '../../backtest/format';
import { useBacktestStore } from '../../backtest/store';
import { Divider } from '../../ui/Divider';
import { IconButton } from '../../ui/IconButton';
import { Tooltip } from '../../ui/Tooltip';

const selectCls =
  'h-8 rounded-md border border-line bg-panel px-1.5 text-[13px] text-fg hover:bg-hover';

/** The battle's Price Skipper: play / pause, next candle, ticker value and frequency (no rewind). */
export function BattleSkipperBar({
  start,
  end,
  enabled,
}: {
  readonly start: number;
  readonly end: number;
  readonly enabled: boolean;
}) {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  if (!snap) return null;
  const done = snap.status !== 'active' || snap.cursor >= end;
  const blocked = !enabled || done;
  const progress = Math.max(0, Math.min(1, (snap.cursor - start) / Math.max(1, end - start)));
  const candlesLeft = Math.max(0, Math.round((end - snap.cursor) / 60_000));
  return (
    <div
      role="region"
      aria-label="نوار بازپخش"
      className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-t border-line bg-panel px-2 text-[13px]"
      data-testid="battle-skipper"
    >
      <IconButton
        icon={snap.playing ? 'pause' : 'play'}
        label={snap.playing ? 'مکث' : 'پخش'}
        shortcut={chordLabel('Alt+1')}
        tooltipSide="top"
        disabled={blocked}
        onClick={() => c.togglePlay()}
        data-testid="bt-play"
      />
      <IconButton
        icon="stepForward"
        label="کندل بعدی"
        shortcut={chordLabel('Ctrl+Space')}
        tooltipSide="top"
        disabled={blocked || snap.loading}
        onClick={() => void c.next()}
        data-testid="bt-next"
      />
      <Divider />
      <Tooltip
        label="گام کندل: اندازه هر قدم بازپخش"
        shortcut="Alt + 4 / Alt + 5"
        side="top"
      >
        <label className="flex items-center gap-1 ps-1 text-muted">
          <span className="hidden md:inline">گام</span>
          <select
            aria-label="گام کندل"
            data-testid="bt-ticker"
            className={selectCls}
            value={snap.tickerValue}
            onChange={(e) => c.setTickerValue(e.target.value as (typeof TICKER_VALUES)[number])}
          >
            {TICKER_VALUES.map((tf) => (
              <option key={tf} value={tf}>
                {TF_FA[tf] ?? TIMEFRAMES[tf].label}
              </option>
            ))}
          </select>
        </label>
      </Tooltip>
      <Tooltip
        label="سرعت پخش: چند کندل در هر ثانیه"
        shortcut="Alt + 2 / Alt + 3"
        side="top"
      >
        <label className="flex items-center gap-1 ps-1 text-muted">
          <span className="hidden md:inline">سرعت</span>
          <select
            aria-label="سرعت پخش"
            data-testid="bt-frequency"
            className={selectCls}
            value={snap.frequency}
            onChange={(e) => c.setFrequency(Number(e.target.value))}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {faNum(f)} در ثانیه
              </option>
            ))}
          </select>
        </label>
      </Tooltip>
      <Divider />
      <span className="whitespace-nowrap px-1 tabular-nums text-fg" data-testid="bt-cursor">
        {utcDateTime(snap.cursor)}
        <span className="ms-1 text-[11px] text-muted">ساعت جهانی</span>
      </span>
      <span
        className="whitespace-nowrap rounded bg-[#f7a60026] px-1.5 py-0.5 text-[12px] font-medium text-[#f7a600]"
        title="کندل‌های یک‌دقیقه‌ای مانده از بازار این نبرد"
      >
        {faNum(candlesLeft)} کندل مانده
      </span>
      <div
        className="mx-2 hidden h-1.5 w-28 overflow-hidden rounded-full bg-line sm:block"
        aria-label={`پیشرفت ${faNum(Math.round(progress * 100))} درصد`}
      >
        <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
      </div>
      {snap.loading ? <span className="text-muted">در حال بارگذاری…</span> : null}
      {snap.cursor >= end ? <span className="text-muted">بازار این نبرد تمام شد</span> : null}
    </div>
  );
}
