'use client';

import { useMemo, useRef, useState } from 'react';
import type { CrosshairMode } from '@/lib/core';
import { drawingRegistry, type AnyToolDefinition } from '@/lib/drawings';
import { selectDrawingTool } from '../../drawing/plan-tool';
import { useApp } from '../../state/app-context';
import { useFavoritesStore } from '../../state/favorites-store';
import { useUiStore } from '../../state/ui-store';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/icons';
import { MobileSheet } from './MobileSheet';

const CURSORS: ReadonlyArray<{ mode: CrosshairMode; label: string; icon: IconName }> = [
  { mode: 'full', label: 'Cross', icon: 'cross' },
  { mode: 'dot', label: 'Dot', icon: 'dot' },
  { mode: 'arrow', label: 'Arrow', icon: 'arrow' },
];

const SECTIONS: ReadonlyArray<{ title: string; ids: readonly string[] }> = [
  {
    title: 'Trend line tools',
    ids: [
      'trend-line',
      'ray',
      'extended-line',
      'horizontal-line',
      'horizontal-ray',
      'vertical-line',
      'cross-line',
      'parallel-channel',
    ],
  },
  { title: 'Shapes', ids: ['rectangle', 'path', 'curve'] },
  { title: 'Fibonacci', ids: ['fib-retracement'] },
  { title: 'Annotation', ids: ['text', 'highlighter'] },
  { title: 'Forecasting', ids: ['long-position', 'short-position', 'fixed-range-volume-profile'] },
];

function toolById(id: string): AnyToolDefinition | undefined {
  return drawingRegistry.get(id);
}

/** Full drawing-tool sheet. Starred tools are listed first and dock on the chart. */
export function MobileToolsSheet({ onClose }: { readonly onClose: () => void }) {
  const app = useApp();
  const tool = useUiStore((s) => s.activeTool);
  const crosshair = useUiStore((s) => s.options.crosshairMode);
  const modes = useUiStore((s) => s.drawingModes);
  const count = useUiStore((s) => s.drawingCount);
  const pushToast = useUiStore((s) => s.pushToast);
  const favorites = useFavoritesStore((s) => s.tools);
  const vertical = useFavoritesStore((s) => s.vertical);
  const toggle = useFavoritesStore((s) => s.toggle);
  const move = useFavoritesStore((s) => s.move);
  const setVertical = useFavoritesStore((s) => s.setVertical);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const known = useMemo(() => new Set(SECTIONS.flatMap((s) => s.ids)), []);
  const extra = drawingRegistry.list().filter((d) => !known.has(d.id));
  const favoriteDefs = favorites
    .map((id) => toolById(id))
    .filter((d): d is AnyToolDefinition => !!d)
    .filter((d) => !q || d.label.toLowerCase().includes(q));

  const pick = (id: string) => {
    selectDrawingTool((next) => app.drawings.setTool(next), tool === id ? null : id);
    onClose();
  };

  return (
    <MobileSheet title="Tools" onClose={onClose} tall hideClose>
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[13px] text-muted">{favorites.length} in sidebar</span>
        <button
          type="button"
          aria-label="Close tools"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <span className="text-[14px] text-fg">Toolbar position</span>
        <div className="flex rounded-lg bg-chart p-0.5" role="group" aria-label="Toolbar position">
          <PosButton selected={!vertical} label="Top" pick={() => setVertical(false)} />
          <PosButton selected={vertical} label="Left" pick={() => setVertical(true)} />
        </div>
      </div>

      <label className="mb-2 flex h-11 items-center gap-2 rounded-xl border border-line bg-chart px-3">
        <Icon name="search" size={16} className="text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools"
          aria-label="Search tools"
          className="h-full w-full bg-transparent text-[14px] text-fg outline-none placeholder:text-muted"
        />
      </label>

      {favoriteDefs.length > 0 ? (
        <section className="mt-3">
          <p className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-muted">
            IN SIDEBAR — DRAG TO REORDER
          </p>
          {favoriteDefs.map((def) => (
            <FavoriteRow
              key={def.id}
              def={def}
              active={tool === def.id}
              onPick={() => pick(def.id)}
              onMove={move}
            />
          ))}
        </section>
      ) : null}

      <Section
        title="Cursors"
        hide={
          !!q && !CURSORS.some((c) => c.label.toLowerCase().includes(q)) && !'eraser'.includes(q)
        }
      >
        {CURSORS.filter((c) => !q || c.label.toLowerCase().includes(q)).map((c) => (
          <Row
            key={c.mode}
            icon={c.icon}
            label={c.label}
            active={tool === null && crosshair === c.mode}
            onClick={() => {
              app.settings.update({ crosshairMode: c.mode });
              app.drawings.setTool(null);
              onClose();
            }}
          />
        ))}
        {!q || 'eraser'.includes(q) ? (
          <Row
            icon="eraser"
            label="Eraser"
            onClick={() => {
              if (!app.drawings.selected) {
                pushToast('Select a drawing, then use Eraser');
                return;
              }
              app.drawings.removeSelected();
              onClose();
            }}
          />
        ) : null}
      </Section>

      {SECTIONS.map((section) => {
        const tools = section.ids
          .map((id) => toolById(id))
          .filter((d): d is AnyToolDefinition => !!d)
          .filter((d) => !q || d.label.toLowerCase().includes(q));
        if (tools.length === 0) return null;
        return (
          <Section key={section.title} title={section.title}>
            {tools.map((def) => (
              <ToolRow
                key={def.id}
                def={def}
                active={tool === def.id}
                starred={favorites.includes(def.id)}
                onPick={() => pick(def.id)}
                onToggle={() => toggle(def.id)}
              />
            ))}
          </Section>
        );
      })}

      {extra.filter((d) => !q || d.label.toLowerCase().includes(q)).length > 0 ? (
        <Section title="More tools">
          {extra
            .filter((d) => !q || d.label.toLowerCase().includes(q))
            .map((def) => (
              <ToolRow
                key={def.id}
                def={def}
                active={tool === def.id}
                starred={favorites.includes(def.id)}
                onPick={() => pick(def.id)}
                onToggle={() => toggle(def.id)}
              />
            ))}
        </Section>
      ) : null}

      {!q ? (
        <Section title="Drawing options">
          <Row
            icon="magnet"
            label={modes.magnet === 'off' ? 'Magnet off' : `Magnet ${modes.magnet}`}
            active={modes.magnet !== 'off'}
            onClick={() =>
              app.drawings.setMagnet(
                modes.magnet === 'off' ? 'weak' : modes.magnet === 'weak' ? 'strong' : 'off',
              )
            }
          />
          <Row
            icon={modes.lockAll ? 'lock' : 'unlock'}
            label={modes.lockAll ? 'Unlock drawings' : 'Lock drawings'}
            active={modes.lockAll}
            onClick={() => app.drawings.setModes({ lockAll: !modes.lockAll })}
          />
          <Row
            icon={modes.hideAll ? 'eyeOff' : 'eye'}
            label={modes.hideAll ? 'Show drawings' : 'Hide drawings'}
            active={modes.hideAll}
            onClick={() => app.drawings.setModes({ hideAll: !modes.hideAll })}
          />
          <Row
            icon="trash"
            label="Remove all drawings"
            onClick={() => {
              if (count === 0) return;
              app.drawings.removeAll();
              pushToast(`Removed ${count} drawing${count === 1 ? '' : 's'}`);
              onClose();
            }}
          />
        </Section>
      ) : null}
    </MobileSheet>
  );
}

function PosButton({
  selected,
  label,
  pick,
}: {
  readonly selected: boolean;
  readonly label: string;
  readonly pick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={pick}
      className={`h-8 min-w-14 rounded-md px-3 text-[13px] font-semibold ${
        selected ? 'bg-fg text-chart' : 'text-muted'
      }`}
    >
      {label}
    </button>
  );
}

function Section({
  title,
  hide,
  children,
}: {
  readonly title: string;
  readonly hide?: boolean;
  readonly children: React.ReactNode;
}) {
  if (hide) return null;
  return (
    <section className="mt-4">
      <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
      {children}
    </section>
  );
}

function Row({
  icon,
  path,
  label,
  active,
  onClick,
  trailing,
  grip,
}: {
  readonly icon?: IconName;
  readonly path?: string;
  readonly label: string;
  readonly active?: boolean;
  readonly onClick: () => void;
  readonly trailing?: React.ReactNode;
  readonly grip?: React.ReactNode;
}) {
  return (
    <div
      className={`flex h-12 items-center gap-2 border-b border-line/70 px-1 ${
        active ? 'text-accent' : 'text-fg'
      }`}
    >
      {grip}
      <button
        type="button"
        onClick={onClick}
        className="flex h-full min-w-0 flex-1 items-center gap-3 text-left"
      >
        {icon ? <Icon name={icon} size={20} /> : null}
        {path ? <Icon path={path} size={20} /> : null}
        <span className="truncate text-[15px]">{label}</span>
      </button>
      {trailing}
    </div>
  );
}

function Star({
  on,
  label,
  toggle,
}: {
  readonly on: boolean;
  readonly label: string;
  readonly toggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={on ? `Remove ${label} from the sidebar` : `Pin ${label} to the sidebar`}
      aria-pressed={on}
      onClick={toggle}
      className={`flex h-9 w-9 items-center justify-center rounded-full ${on ? 'text-accent' : 'text-muted'}`}
    >
      <Icon name="star" size={18} className={on ? 'fill-current' : ''} />
    </button>
  );
}

function ToolRow({
  def,
  active,
  starred,
  onPick,
  onToggle,
}: {
  readonly def: AnyToolDefinition;
  readonly active: boolean;
  readonly starred: boolean;
  readonly onPick: () => void;
  readonly onToggle: () => void;
}) {
  return (
    <Row
      path={def.icon}
      label={def.label}
      active={active}
      onClick={onPick}
      trailing={<Star on={starred} label={def.label} toggle={onToggle} />}
    />
  );
}

function FavoriteRow({
  def,
  active,
  onPick,
  onMove,
}: {
  readonly def: AnyToolDefinition;
  readonly active: boolean;
  readonly onPick: () => void;
  readonly onMove: (id: string, toIndex: number) => void;
}) {
  const drag = useRef<number | null>(null);
  const lock = useRef(0);
  return (
    <div data-fav-id={def.id}>
      <Row
        path={def.icon}
        label={def.label}
        active={active}
        onClick={onPick}
        grip={
          <span
            aria-hidden="true"
            title="Drag to reorder"
            className="flex h-9 w-6 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing"
            onPointerDown={(e) => {
              drag.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (drag.current !== e.pointerId) return;
              const rows = [...document.querySelectorAll<HTMLElement>('[data-fav-id]')];
              let index = 0;
              for (const row of rows) {
                const box = row.getBoundingClientRect();
                if (e.clientY > box.top + box.height / 2) index += 1;
              }
              if (performance.now() < lock.current) return;
              const current = useFavoritesStore.getState().tools.indexOf(def.id);
              if (index !== current) {
                lock.current = performance.now() + 120;
                onMove(def.id, index);
              }
            }}
            onPointerUp={(e) => {
              if (drag.current === e.pointerId) drag.current = null;
            }}
          >
            <Icon name="grip" size={16} />
          </span>
        }
        trailing={
          <Star on label={def.label} toggle={() => useFavoritesStore.getState().toggle(def.id)} />
        }
      />
    </div>
  );
}
