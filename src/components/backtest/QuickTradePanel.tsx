'use client';

import { useState } from 'react';
import type { ScalperSettings } from '@/lib/backtest';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { useBacktest } from './context';
import { enNum } from './format';
import { useBacktestStore } from './store';

/**
 * Quick Buy/Sell. `dock` sits in the replay bar (backtest). The default floats on the chart
 * (battles): SELL at Bid · quantity · BUY at Ask, plus scalper presets and the order ticket.
 */
export function QuickTradePanel({ dock = false }: { readonly dock?: boolean }) {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  const openTicket = useBacktestStore((s) => s.openTicket);
  const [scalperOpen, setScalperOpen] = useState(false);
  if (!snap) return null;
  if (dock) return <DockTrade />;
  const precision = c.spec.pricePrecision;
  const disabled = snap.status !== 'active';
  const spreadPips = snap.spread > 0 ? snap.spread / c.spec.pipSize : 0;
  return (
    <div className="absolute left-2 top-8 z-10 flex flex-col gap-1" data-testid="quick-panel">
      <div
        dir="ltr"
        className="flex items-stretch overflow-hidden rounded-md border border-line bg-panel/95 text-[12px] shadow-md"
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => c.trading.quick('sell')}
          className="flex w-[86px] flex-col items-start bg-down/15 px-2 py-1 text-down hover:bg-down/25 disabled:opacity-40"
          data-testid="quick-sell"
        >
          <span className="text-[11px] font-semibold">فروش</span>
          <span className="tabular-nums text-[13px] font-semibold">
            {enNum(snap.bid, precision)}
          </span>
        </button>
        <div className="flex flex-col items-center justify-center border-x border-line px-1">
          <input
            aria-label="حجم (لات)"
            dir="ltr"
            data-testid="quick-qty"
            type="number"
            min={0}
            step={c.spec.lotStep}
            value={snap.quickVolume}
            onChange={(e) => c.setQuickVolume(Number(e.target.value))}
            className="h-6 w-16 rounded bg-transparent text-center tabular-nums text-fg outline-none focus:bg-hover"
          />
          <span className="text-[10px] text-muted">
            {spreadPips > 0 ? (
              <>
                اسپرد <span className="tabular-nums">{enNum(spreadPips, 1)}</span>
              </>
            ) : (
              'لات'
            )}
          </span>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => c.trading.quick('buy')}
          className="flex w-[86px] flex-col items-end bg-accent/15 px-2 py-1 text-accent hover:bg-accent/25 disabled:opacity-40"
          data-testid="quick-buy"
        >
          <span className="text-[11px] font-semibold">خرید</span>
          <span className="tabular-nums text-[13px] font-semibold">
            {enNum(snap.ask, precision)}
          </span>
        </button>
        <Tooltip label="پیش‌تنظیم اسکالپ: حد ضرر، حد سود و سربه‌سر آماده">
          <button
            type="button"
            aria-label="پیش‌تنظیم"
            aria-pressed={snap.scalper.enabled}
            onClick={() => setScalperOpen((o) => !o)}
            className={`flex w-8 items-center justify-center border-l border-line hover:bg-hover ${snap.scalper.enabled ? 'text-accent' : 'text-muted'}`}
          >
            <Icon name="bolt" size={15} />
          </button>
        </Tooltip>
        <Tooltip label="سفارش جدید" shortcut="Alt + ,">
          <button
            type="button"
            aria-label="سفارش جدید"
            disabled={disabled}
            onClick={() => openTicket({ side: 'buy', type: 'market' })}
            className="flex w-8 items-center justify-center border-l border-line text-muted hover:bg-hover hover:text-fg disabled:opacity-40"
            data-testid="new-order"
          >
            <Icon name="plus" size={15} />
          </button>
        </Tooltip>
      </div>
      {scalperOpen ? (
        <ScalperMode
          value={snap.scalper}
          onClose={() => setScalperOpen(false)}
          onSave={(s) => {
            c.setScalper(s);
            setScalperOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** Replay-bar quick trade: Sell at Bid · lots · Buy at Ask, then presets and the order ticket. */
function DockTrade() {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  const openTicket = useBacktestStore((s) => s.openTicket);
  const [scalperOpen, setScalperOpen] = useState(false);
  if (!snap) return null;
  const precision = c.spec.pricePrecision;
  const disabled = snap.status !== 'active';
  const lotDecimals = Math.max(0, Math.min(3, Math.ceil(-Math.log10(c.spec.lotStep))));
  const spreadPips = snap.spread > 0 ? snap.spread / c.spec.pipSize : 0;
  const side =
    'flex w-[4.75rem] flex-col items-center justify-center gap-px leading-none transition-[filter] hover:brightness-110 disabled:opacity-40 xl:w-[5.75rem]';
  const stepLot = (dir: 1 | -1) =>
    c.setQuickVolume(Math.max(0, +(snap.quickVolume + dir * c.spec.lotStep).toFixed(lotDecimals)));

  return (
    <div className="relative flex shrink-0 items-center gap-1.5" data-testid="quick-panel">
      <div
        dir="ltr"
        className="flex h-10 items-stretch overflow-hidden rounded-lg border border-line bg-chart/70 shadow-sm"
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => c.trading.quick('sell')}
          className={`${side} bg-down text-white`}
          data-testid="quick-sell"
        >
          <span className="text-[10.5px] font-semibold opacity-90">فروش</span>
          <span className="text-[12.5px] font-bold tabular-nums">{enNum(snap.bid, precision)}</span>
        </button>
        <div className="group/lot relative flex w-[4.5rem] flex-col items-center justify-center">
          <input
            aria-label="حجم (لات)"
            dir="ltr"
            data-testid="quick-qty"
            type="number"
            min={0}
            step={c.spec.lotStep}
            value={snap.quickVolume}
            onChange={(e) => c.setQuickVolume(Number(e.target.value))}
            className="h-5 w-full bg-transparent text-center text-[13px] font-bold tabular-nums text-fg outline-none [appearance:textfield] focus:text-accent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-[9.5px] text-muted">
            {spreadPips > 0 ? (
              <>
                اسپرد <span className="tabular-nums">{enNum(spreadPips, 1)}</span>
              </>
            ) : (
              'لات'
            )}
          </span>
          <button
            type="button"
            tabIndex={-1}
            aria-label="کاهش حجم"
            onClick={() => stepLot(-1)}
            className="absolute inset-y-0 left-0 flex w-4 items-center justify-center text-muted opacity-0 hover:bg-hover hover:text-fg group-hover/lot:opacity-100"
          >
            <Icon name="minus" size={11} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="افزایش حجم"
            onClick={() => stepLot(1)}
            className="absolute inset-y-0 right-0 flex w-4 items-center justify-center text-muted opacity-0 hover:bg-hover hover:text-fg group-hover/lot:opacity-100"
          >
            <Icon name="plus" size={11} />
          </button>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => c.trading.quick('buy')}
          className={`${side} bg-accent text-accent-fg`}
          data-testid="quick-buy"
        >
          <span className="text-[10.5px] font-semibold opacity-90">خرید</span>
          <span className="text-[12.5px] font-bold tabular-nums">{enNum(snap.ask, precision)}</span>
        </button>
      </div>
      <Tooltip label="پیش‌تنظیم اسکالپ: حد ضرر، حد سود و سربه‌سر آماده" side="top">
        <button
          type="button"
          aria-label="پیش‌تنظیم"
          aria-pressed={snap.scalper.enabled}
          onClick={() => setScalperOpen((o) => !o)}
          className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium ${
            snap.scalper.enabled
              ? 'bg-accent/15 text-accent'
              : 'text-muted hover:bg-hover hover:text-fg'
          }`}
        >
          <Icon name="bolt" size={15} className={snap.scalper.enabled ? 'fill-current' : ''} />
          <span className="hidden 2xl:inline">پیش‌تنظیم</span>
        </button>
      </Tooltip>
      <Tooltip label="سفارش جدید" shortcut="Alt + ," side="top">
        <button
          type="button"
          aria-label="سفارش جدید"
          disabled={disabled}
          onClick={() => openTicket({ side: 'buy', type: 'market' })}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg disabled:opacity-40"
          data-testid="new-order"
        >
          <Icon name="plus" size={16} />
        </button>
      </Tooltip>
      {scalperOpen ? (
        <div className="absolute bottom-full start-0 z-30 mb-2">
          <ScalperMode
            value={snap.scalper}
            onClose={() => setScalperOpen(false)}
            onSave={(s) => {
              c.setScalper(s);
              setScalperOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ScalperMode({
  value,
  onSave,
  onClose,
  className = '',
}: {
  readonly value: ScalperSettings;
  readonly onSave: (s: ScalperSettings) => void;
  readonly onClose: () => void;
  readonly className?: string;
}) {
  const [s, set] = useState(value);
  const [slOn, setSlOn] = useState(value.sl !== null);
  const [tpOn, setTpOn] = useState(value.tp !== null);
  const [beOn, setBeOn] = useState(value.autoBE !== null);
  const [sl, setSl] = useState(value.sl ?? 50);
  const [tp, setTp] = useState(value.tp ?? 100);
  const [be, setBe] = useState(value.autoBE ?? { mode: 'rr' as const, value: 1 });
  const field = 'h-7 w-20 rounded border border-line bg-panel px-1.5 text-left tabular-nums';
  return (
    <div
      dir="rtl"
      className={`w-72 animate-pop rounded-lg border border-line bg-panel p-3 text-[12.5px] shadow-xl ${className}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">حالت اسکالپ</span>
        <select
          aria-label="واحد فاصله"
          value={s.unit}
          onChange={(e) => set({ ...s, unit: e.target.value as ScalperSettings['unit'] })}
          className="h-7 rounded border border-line bg-panel px-1"
        >
          <option value="pips">پیپ</option>
          <option value="ticks">تیک</option>
          <option value="percent">٪</option>
        </select>
      </div>
      <label className="flex h-8 items-center gap-2">
        <input type="checkbox" checked={slOn} onChange={(e) => setSlOn(e.target.checked)} />
        <span className="flex-1">حد ضرر</span>
        <input
          aria-label="فاصله حد ضرر"
          dir="ltr"
          type="number"
          min={0}
          className={field}
          value={sl}
          disabled={!slOn}
          onChange={(e) => setSl(Number(e.target.value))}
        />
      </label>
      <label className="flex h-8 items-center gap-2">
        <input type="checkbox" checked={tpOn} onChange={(e) => setTpOn(e.target.checked)} />
        <span className="flex-1">حد سود</span>
        <input
          aria-label="فاصله حد سود"
          dir="ltr"
          type="number"
          min={0}
          className={field}
          value={tp}
          disabled={!tpOn}
          onChange={(e) => setTp(Number(e.target.value))}
        />
      </label>
      <label className="flex h-8 items-center gap-2">
        <input
          type="checkbox"
          checked={beOn && slOn}
          disabled={!slOn}
          onChange={(e) => setBeOn(e.target.checked)}
        />
        <span className="flex-1">سربه‌سر خودکار در</span>
        <input
          aria-label="فاصله سربه‌سر خودکار"
          dir="ltr"
          type="number"
          min={0}
          step={0.1}
          className="h-7 w-14 rounded border border-line bg-panel px-1 text-right"
          value={be.value}
          disabled={!beOn || !slOn}
          onChange={(e) => setBe({ ...be, value: Number(e.target.value) })}
        />
        <select
          aria-label="واحد سربه‌سر خودکار"
          className="h-7 rounded border border-line bg-panel px-1"
          value={be.mode}
          disabled={!beOn || !slOn}
          onChange={(e) => setBe({ ...be, mode: e.target.value as 'rr' | 'pips' })}
        >
          <option value="rr">ریسک به ریوارد</option>
          <option value="pips">پیپ</option>
        </select>
      </label>
      <p className="mt-1 text-[11px] leading-5 text-muted">
        فقط فاصله است، قیمت مطلق نیست. سربه‌سر خودکار بدون حد ضرر کار نمی‌کند.
      </p>
      <div className="mt-2 flex justify-end gap-2">
        <Button
          onClick={() => {
            onSave({ ...value, enabled: false });
          }}
        >
          خاموش
        </Button>
        <Button variant="ghost" onClick={onClose}>
          انصراف
        </Button>
        <Button
          variant="primary"
          onClick={() =>
            onSave({
              enabled: true,
              unit: s.unit,
              sl: slOn ? sl : null,
              tp: tpOn ? tp : null,
              autoBE: beOn && slOn ? be : null,
            })
          }
        >
          ذخیره
        </Button>
      </div>
    </div>
  );
}
