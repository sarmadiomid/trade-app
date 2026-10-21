'use client';

import { useState } from 'react';
import { Icon } from '../../ui/Icon';
import { MobileSheet } from '../../chart/mobile/MobileSheet';
import { ScalperMode } from '../QuickTradePanel';
import { useBacktest } from '../context';
import { useBacktestStore } from '../store';

function stepLots(volume: number, dir: 1 | -1, step: number, min: number, max: number): number {
  const places = (step.toString().split('.')[1] ?? '').length;
  const next = Number((volume + dir * step).toFixed(Math.min(8, places)));
  return Math.min(max, Math.max(min, next));
}

function lotLabel(volume: number): string {
  const rounded = Math.round(volume * 100) / 100;
  return String(rounded);
}

/** Lot size, Buy and Sell. Opens from the phone session bar. */
export function MobileTradeSheet({ onClose }: { readonly onClose: () => void }) {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  const [preset, setPreset] = useState(false);
  if (!snap) return null;
  const disabled = snap.status !== 'active';
  const change = (dir: 1 | -1) =>
    c.setQuickVolume(stepLots(snap.quickVolume, dir, c.cfg.lotStep, c.cfg.lotMin, c.cfg.lotMax));
  const send = (side: 'buy' | 'sell') => {
    const err = c.trading.quick(side);
    if (!err) onClose();
  };

  return (
    <MobileSheet onClose={onClose}>
      <div dir="ltr" className="px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-center justify-between py-2">
          <span className="text-[16px] text-fg">Lot size</span>
          <div className="flex items-center gap-3">
            <StepButton label="Decrease lot size" onClick={() => change(-1)}>
              −
            </StepButton>
            <span className="w-10 text-center text-[20px] font-medium tabular-nums text-fg">
              {lotLabel(snap.quickVolume)}
            </span>
            <StepButton label="Increase lot size" onClick={() => change(1)}>
              +
            </StepButton>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={disabled}
            data-testid="mobile-buy"
            onClick={() => send('buy')}
            className="h-14 flex-1 rounded-xl bg-accent text-[17px] font-semibold text-white active:brightness-110 disabled:opacity-40"
          >
            Buy
          </button>
          <button
            type="button"
            disabled={disabled}
            data-testid="mobile-sell"
            onClick={() => send('sell')}
            className="h-14 flex-1 rounded-xl bg-[#f07870] text-[17px] font-semibold text-white active:brightness-110 disabled:opacity-40"
          >
            Sell
          </button>
        </div>
        <button
          type="button"
          aria-expanded={preset}
          onClick={() => setPreset((open) => !open)}
          className={`mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-2 text-[14px] ${
            snap.scalper.enabled ? 'text-accent' : 'text-muted'
          }`}
        >
          <Icon name="grid" size={16} />
          Preset
        </button>
        {preset ? (
          <ScalperMode
            className="mt-2 w-full"
            value={snap.scalper}
            onClose={() => setPreset(false)}
            onSave={(next) => {
              c.setScalper(next);
              setPreset(false);
            }}
          />
        ) : null}
      </div>
    </MobileSheet>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-[18px] text-fg hover:bg-hover"
    >
      {children}
    </button>
  );
}
