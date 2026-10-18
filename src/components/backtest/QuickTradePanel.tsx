'use client';

import { useState } from 'react';
import type { ScalperSettings } from '@/lib/backtest';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { useBacktest } from './context';
import { useBacktestStore } from './store';

/**
 * FX Replay's Quick Buy/Sell panel on the chart: SELL at Bid · quantity · BUY at Ask, plus the
 * Scalper Mode presets and the full order ticket.
 */
export function QuickTradePanel() {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  const openTicket = useBacktestStore((s) => s.openTicket);
  const [scalperOpen, setScalperOpen] = useState(false);
  if (!snap) return null;
  const precision = c.spec.pricePrecision;
  const disabled = snap.status !== 'active';
  return (
    <div className="absolute left-2 top-8 z-10 flex flex-col gap-1" data-testid="quick-panel">
      <div className="flex items-stretch overflow-hidden rounded-md border border-line bg-panel/95 text-[12px] shadow-md">
        <button
          type="button"
          disabled={disabled}
          onClick={() => c.trading.quick('sell')}
          className="flex w-[86px] flex-col items-start bg-down/15 px-2 py-1 text-down hover:bg-down/25 disabled:opacity-40"
          data-testid="quick-sell"
        >
          <span className="text-[11px] font-semibold">فروش</span>
          <span className="tabular-nums text-[13px] font-semibold">
            {snap.bid.toFixed(precision)}
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
            {snap.spread > 0
              ? `اسپرد ${(snap.spread / c.spec.pipSize).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}`
              : 'لات'}
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
            {snap.ask.toFixed(precision)}
          </span>
        </button>
        <Tooltip label="حالت اسکالپ: حد ضرر، حد سود و سربه‌سر آماده برای معامله سریع">
          <button
            type="button"
            aria-label="حالت اسکالپ"
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

function ScalperMode({
  value,
  onSave,
  onClose,
}: {
  readonly value: ScalperSettings;
  readonly onSave: (s: ScalperSettings) => void;
  readonly onClose: () => void;
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
    <div dir="rtl" className="w-72 animate-pop rounded-lg border border-line bg-panel p-3 text-[12.5px] shadow-xl">
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
