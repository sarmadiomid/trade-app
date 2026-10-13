'use client';

import { useEffect, useRef, useState } from 'react';
import { chordLabel } from '@/lib/app';
import { drawingRegistry, type AnyToolDefinition } from '@/lib/drawings';
import { useApp } from '../state/app-context';
import { useFavoritesStore } from '../state/favorites-store';
import { useUiStore } from '../state/ui-store';
import { Divider } from '../ui/Divider';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';

const EDGE = 4;

function clamp(el: HTMLElement, x: number, y: number) {
  const parent = el.offsetParent as HTMLElement | null;
  if (!parent) return { x, y };
  return {
    x: Math.max(EDGE, Math.min(parent.clientWidth - el.offsetWidth - EDGE, x)),
    y: Math.max(EDGE, Math.min(parent.clientHeight - el.offsetHeight - EDGE, y)),
  };
}

/** Draggable floating toolbar with the user's favorite drawing tools (TradingView style). */
export function FavoritesToolbar() {
  const app = useApp();
  const tool = useUiStore((s) => s.activeTool);
  const { tools, visible, vertical, pos, toggle, move, setVertical, setPos, setVisible } =
    useFavoritesStore();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [dragTool, setDragTool] = useState<string | null>(null);

  const defs = tools
    .map((id) => drawingRegistry.get(id))
    .filter((d): d is AnyToolDefinition => !!d);

  // Keep the toolbar inside the chart when the chart resizes or the toolbar changes shape.
  useEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent || !pos) return;
    const fit = () => {
      const p = useFavoritesStore.getState().pos;
      if (!p) return;
      const next = clamp(el, p.x, p.y);
      if (next.x !== p.x || next.y !== p.y) setPos(next);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pos, vertical, defs.length, setPos]);

  if (!visible || defs.length === 0) return null;

  const onGripDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    const r = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onGripMove = (e: React.PointerEvent) => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!drag.current || !el || !parent) return;
    const p = parent.getBoundingClientRect();
    setPos(clamp(el, e.clientX - p.left - drag.current.dx, e.clientY - p.top - drag.current.dy));
  };
  const onGripUp = (e: React.PointerEvent) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const tooltipSide = vertical ? 'right' : 'bottom';

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Favorite drawing tools"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={`absolute z-20 flex items-center gap-0.5 rounded-lg border border-line bg-panel p-1 shadow-xl ${
        vertical ? 'flex-col' : 'flex-row'
      } ${pos ? '' : 'left-1/2 top-2 -translate-x-1/2'}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={onGripUp}
        onDoubleClick={() => setPos(null)}
        title="Drag to move, double-click to reset"
        className={`flex cursor-grab touch-none items-center justify-center text-muted hover:text-fg active:cursor-grabbing ${
          vertical ? 'h-3 w-8' : 'h-8 w-3'
        }`}
        aria-hidden="true"
      >
        <Icon name="grip" size={14} strokeWidth={2.6} className={vertical ? 'rotate-90' : ''} />
      </span>
      {defs.map((def, i) => (
        <div
          key={def.id}
          draggable
          onDragStart={(e) => {
            setDragTool(def.id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', def.id);
          }}
          onDragOver={(e) => {
            if (!dragTool || dragTool === def.id) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragTool && dragTool !== def.id) move(dragTool, i);
            setDragTool(null);
          }}
          onDragEnd={() => setDragTool(null)}
          className={`flex ${dragTool === def.id ? 'opacity-40' : ''}`}
        >
          <IconButton
            path={def.icon}
            label={def.label}
            shortcut={def.shortcut ? chordLabel(def.shortcut) : undefined}
            tooltipSide={tooltipSide}
            active={tool === def.id}
            onClick={() => app.drawings.setTool(tool === def.id ? null : def.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              toggle(def.id);
            }}
            className="h-8 w-8"
          />
        </div>
      ))}
      <Divider vertical={!vertical} />
      <IconButton
        icon="rotate"
        label={vertical ? 'Horizontal layout' : 'Vertical layout'}
        tooltipSide={tooltipSide}
        size={14}
        onClick={() => setVertical(!vertical)}
        className="h-8 w-8 text-muted"
      />
      <IconButton
        icon="close"
        label="Hide favorites toolbar"
        tooltipSide={tooltipSide}
        size={14}
        onClick={() => setVisible(false)}
        className="h-8 w-8 text-muted"
      />
    </div>
  );
}
