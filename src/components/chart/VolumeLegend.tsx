'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { ENGINE_CONFIG, formatCompact } from '@/lib/core';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Icon } from '../ui/Icon';

/**
 * Volume study legend, pinned to the top-left of the volume pane the way TradingView pins a
 * study: name and value always, hide and remove on hover. Hide keeps the pane; remove deletes it.
 */
export function VolumeLegend() {
  const app = useApp();
  const visible = useUiStore((s) => s.options.volumeVisible);
  const hidden = useUiStore((s) => s.options.volumeHidden);
  const rootRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!visible) return;
    const place = () => {
      const el = rootRef.current;
      if (!el) return;
      const layout = app.engine.getLayout();
      if (layout.height <= 0) {
        el.style.visibility = 'hidden';
        return;
      }
      const plotH = layout.height - ENGINE_CONFIG.timeAxis.height;
      const volH = Math.round(plotH * app.engine.getOptions().volumePaneRatio);
      el.style.visibility = '';
      el.style.top = `${plotH - volH + 2}px`;
    };
    place();
    const frame = requestAnimationFrame(place);
    const offs = [
      app.engine.events.on('resize', place),
      app.engine.events.on('options:changed', () => {
        place();
        requestAnimationFrame(place);
      }),
    ];
    return () => {
      cancelAnimationFrame(frame);
      offs.forEach((off) => off());
    };
  }, [app, visible]);

  useEffect(() => {
    if (!visible || hidden) return;
    let hovered: number | null = null;
    const paint = () => {
      const el = valueRef.current;
      const data = app.engine.seriesData;
      const i = hovered ?? data.lastIndex;
      const bar = data.bar(i);
      if (!el || !bar) return;
      const text = formatCompact(bar.volume);
      if (el.textContent !== text) el.textContent = text;
      el.style.color = bar.close >= bar.open ? 'var(--tc-up)' : 'var(--tc-down)';
    };
    const offs = [
      app.engine.events.on('crosshair:moved', (c) => {
        const next = c && c.barIndex >= 0 ? c.barIndex : null;
        if (next === hovered) return;
        hovered = next;
        paint();
      }),
      app.engine.events.on('data:changed', paint),
    ];
    paint();
    return () => offs.forEach((off) => off());
  }, [app, visible, hidden]);

  if (!visible) return null;

  const show = () => app.settings.update({ volumeHidden: false });
  const hide = () => app.settings.update({ volumeHidden: true });
  const remove = () => app.settings.update({ volumeVisible: false, volumeHidden: false });

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute left-2 z-10"
      data-testid="volume-legend"
    >
      <div className="group/vol pointer-events-auto relative flex h-5.5 items-center text-[12px] leading-none text-muted select-none">
        <span className={hidden ? 'opacity-45' : undefined}>Volume</span>
        {hidden ? null : <span ref={valueRef} className="ml-1.5 tabular-nums" />}
        {hidden ? (
          <span className="ml-1">
            <LegendIcon label="Show volume" icon="eyeOff" onClick={show} />
          </span>
        ) : null}
        <span className="pointer-events-none absolute top-0 left-full flex h-5.5 items-center pl-0.5 opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/vol:pointer-events-auto [@media(hover:hover)]:group-hover/vol:opacity-100 [@media(hover:hover)]:group-focus-within/vol:pointer-events-auto [@media(hover:hover)]:group-focus-within/vol:opacity-100">
          {hidden ? null : <LegendIcon hoverOnly label="Hide volume" icon="eye" onClick={hide} />}
          <LegendIcon hoverOnly label="Remove volume" icon="close" onClick={remove} />
        </span>
      </div>
    </div>
  );
}

function LegendIcon({
  label,
  icon,
  onClick,
  hoverOnly = false,
}: {
  readonly label: string;
  readonly icon: 'eye' | 'eyeOff' | 'close';
  readonly onClick: () => void;
  /** Stays out of the way until the legend is hovered. Touch screens keep it tappable. */
  readonly hoverOnly?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={`flex h-4.5 w-4.5 items-center justify-center rounded-sm text-muted hover:bg-hover hover:text-fg ${
        hoverOnly
          ? '[@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:group-hover/vol:pointer-events-auto [@media(hover:hover)]:group-focus-within/vol:pointer-events-auto'
          : ''
      }`}
    >
      <Icon name={icon} size={14} />
    </button>
  );
}
