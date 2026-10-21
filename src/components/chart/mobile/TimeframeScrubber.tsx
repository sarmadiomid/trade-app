'use client';

import { useContext, useRef, useState } from 'react';
import { TIMEFRAMES, type TimeframeId } from '@/lib/core';
import { AppContext } from '../../state/app-context';
import { useUiStore } from '../../state/ui-store';
import {
  TIMEFRAME_DRAG_PX,
  stepsFromDrag,
  timeframeBySteps,
  timeframeWindow,
} from './timeframe-step';

/**
 * Three intervals in a row. The middle one is active.
 * Drag up or down to step through timeframes; a tap on a neighbour selects it.
 */
export function TimeframeScrubber() {
  const app = useContext(AppContext);
  const current = useUiStore((s) => s.timeframe);
  const [preview, setPreview] = useState<TimeframeId | null>(null);
  const [shift, setShift] = useState(0);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const previewRef = useRef<TimeframeId | null>(null);
  const suppressClick = useRef(false);
  const shown = preview && preview !== current ? preview : current;
  const [prev, active, next] = timeframeWindow(shown);

  if (!app) return null;

  const commit = (id: TimeframeId) => {
    setPreview(null);
    setShift(0);
    if (id !== current) void app.setTimeframe(id);
  };

  return (
    <div
      role="group"
      aria-label="Interval"
      data-testid="tf-scrubber"
      className="flex h-14 w-14 shrink-0 touch-none select-none flex-col items-center justify-center overflow-hidden"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { y: e.clientY, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const start = drag.current;
        if (!start) return;
        const dy = e.clientY - start.y;
        if (Math.abs(dy) > 6) start.moved = true;
        const steps = stepsFromDrag(dy);
        const next = steps === 0 ? null : timeframeBySteps(current, steps);
        previewRef.current = next;
        setPreview(next);
        const remainder = dy + steps * TIMEFRAME_DRAG_PX;
        setShift(Math.max(-14, Math.min(14, remainder)));
      }}
      onPointerUp={() => {
        const moved = drag.current?.moved ?? false;
        const next = previewRef.current;
        suppressClick.current = moved;
        drag.current = null;
        previewRef.current = null;
        setShift(0);
        if (moved && next && next !== current) {
          setPreview(next);
          void app.setTimeframe(next);
        } else setPreview(null);
      }}
      onClickCapture={(e) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerCancel={() => {
        drag.current = null;
        previewRef.current = null;
        setPreview(null);
        setShift(0);
      }}
    >
      <div
        className="flex flex-col items-center transition-transform duration-75"
        style={{ transform: `translateY(${shift}px)` }}
      >
        <TfChip id={prev} onPick={commit} />
        <span
          className="flex h-6 items-center justify-center text-[16px] font-bold leading-none text-fg"
          aria-current="true"
        >
          {TIMEFRAMES[active].label}
        </span>
        <TfChip id={next} onPick={commit} />
      </div>
    </div>
  );
}

function TfChip({
  id,
  onPick,
}: {
  readonly id: TimeframeId | null;
  readonly onPick: (id: TimeframeId) => void;
}) {
  if (!id) return <span className="h-4" />;
  return (
    <button
      type="button"
      onClick={() => onPick(id)}
      className="flex h-4 items-center justify-center px-1 text-[11px] font-medium leading-none text-muted"
    >
      {TIMEFRAMES[id].label}
    </button>
  );
}
