'use client';

import { useEffect, useRef, useState } from 'react';
import { chordLabel } from '@/lib/app';
import type { CrosshairMode } from '@/lib/core';
import { drawingRegistry, type AnyToolDefinition, type MagnetMode } from '@/lib/drawings';
import { useApp } from '../state/app-context';
import { useFavoritesStore } from '../state/favorites-store';
import { useUiStore } from '../state/ui-store';
import { Divider } from '../ui/Divider';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import type { IconName } from '../ui/icons';
import { Popover } from '../ui/Popover';

const CURSORS: ReadonlyArray<{ mode: CrosshairMode; label: string; icon: IconName }> = [
  { mode: 'full', label: 'Cross', icon: 'cross' },
  { mode: 'dot', label: 'Dot', icon: 'dot' },
  { mode: 'arrow', label: 'Arrow', icon: 'arrow' },
];

const MAGNETS: ReadonlyArray<{ mode: Exclude<MagnetMode, 'off'>; label: string }> = [
  { mode: 'weak', label: 'Weak magnet' },
  { mode: 'strong', label: 'Strong magnet' },
];

function Flyout({
  children,
  anchor,
  onClose,
}: {
  children: React.ReactNode;
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  return (
    <Popover anchor={anchor} onClose={onClose}>
      <div className="-m-2 flex min-w-40 flex-col">{children}</div>
    </Popover>
  );
}

function FlyoutItem({
  active,
  onClick,
  icon,
  path,
  label,
  shortcut,
  favorite,
  onToggleFavorite,
}: {
  active: boolean;
  onClick: () => void;
  icon?: IconName;
  path?: string;
  label: string;
  shortcut?: string | undefined;
  favorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  return (
    <div
      className={`group/item flex h-9 items-center rounded-md text-[13px] ${
        active
          ? 'bg-accent/20 text-accent ring-1 ring-inset ring-accent/40'
          : 'hover:bg-hover'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex h-full flex-1 items-center gap-2 px-2 text-left"
      >
        {icon ? <Icon name={icon} size={16} /> : null}
        {path ? <Icon path={path} size={16} /> : null}
        <span className="flex-1">{label}</span>
        {shortcut ? <span className="pl-4 text-[11px] text-muted">{shortcut}</span> : null}
      </button>
      {onToggleFavorite ? (
        <button
          type="button"
          aria-label={favorite ? `Remove ${label} from favorites` : `Add ${label} to favorites`}
          aria-pressed={favorite}
          title={favorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={onToggleFavorite}
          className={`mr-1 flex h-7 w-7 items-center justify-center rounded hover:text-fg ${
            favorite
              ? 'text-amber-400 hover:text-amber-300'
              : 'text-muted opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100'
          }`}
        >
          <Icon name="star" size={14} className={favorite ? 'fill-current' : ''} />
        </button>
      ) : null}
    </div>
  );
}

/** Hover star on a toolbar slot so tools that have no dropdown can still be favorited. */
function FavoriteMark({ id, label }: { id: string; label: string }) {
  const on = useFavoritesStore((s) => s.tools.includes(id));
  const toggle = useFavoritesStore((s) => s.toggle);
  return (
    <button
      type="button"
      aria-label={on ? `Remove ${label} from favorites` : `Add ${label} to favorites`}
      aria-pressed={on}
      title={on ? 'Remove from favorites' : 'Add to favorites'}
      onClick={(e) => {
        e.stopPropagation();
        toggle(id);
      }}
      className={`absolute right-0 top-0 z-10 flex h-4 w-4 items-center justify-center rounded-sm hover:text-fg ${
        on
          ? 'text-amber-400'
          : 'text-muted opacity-0 group-hover/slot:opacity-100 focus-visible:opacity-100'
      }`}
    >
      <Icon name="star" size={11} className={on ? 'fill-current' : ''} />
    </button>
  );
}

type ToolSlot =
  | { readonly kind: 'tool'; readonly def: AnyToolDefinition }
  | { readonly kind: 'group'; readonly id: string; readonly tools: AnyToolDefinition[] };

/** Registry order, with tools sharing a `group` collapsed into the slot of the first one. */
function toolSlots(): ToolSlot[] {
  const slots: ToolSlot[] = [];
  const groups = new Map<string, AnyToolDefinition[]>();
  for (const def of drawingRegistry.list()) {
    if (!def.group) {
      slots.push({ kind: 'tool', def });
      continue;
    }
    const existing = groups.get(def.group);
    if (existing) existing.push(def);
    else {
      const tools = [def];
      groups.set(def.group, tools);
      slots.push({ kind: 'group', id: def.group, tools });
    }
  }
  return slots;
}

/** Left vertical toolbar: cursor modes, every registered drawing tool, and drawing helpers. */
export function DrawingToolbar() {
  const app = useApp();
  const tool = useUiStore((s) => s.activeTool);
  const modes = useUiStore((s) => s.drawingModes);
  const crosshair = useUiStore((s) => s.options.crosshairMode);
  const history = useUiStore((s) => s.history);
  const count = useUiStore((s) => s.drawingCount);
  const pushToast = useUiStore((s) => s.pushToast);
  const navRef = useRef<HTMLElement>(null);
  const favorites = useFavoritesStore((s) => s.tools);
  const favoritesVisible = useFavoritesStore((s) => s.visible);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const setFavoritesVisible = useFavoritesStore((s) => s.setVisible);
  const [flyout, setFlyout] = useState<
    { kind: 'cursor' | 'magnet'; el: HTMLElement } | { kind: 'group'; id: string; el: HTMLElement } | null
  >(null);
  const [slots] = useState(toolSlots);
  const [groupChoice, setGroupChoice] = useState<Record<string, string>>({});
  // A group button keeps showing the last tool used from it (also when picked by shortcut).
  const activeGroup = tool ? drawingRegistry.get(tool)?.group : undefined;
  if (activeGroup && tool && groupChoice[activeGroup] !== tool)
    setGroupChoice({ ...groupChoice, [activeGroup]: tool });
  // Placing a drawing returns to the cursor tool. Drop focus on the tool button so its
  // focus ring is not left looking like the tool is still selected.
  useEffect(() => {
    if (tool !== null) return;
    const el = document.activeElement;
    if (
      el instanceof HTMLElement &&
      navRef.current?.contains(el) &&
      el.getAttribute('aria-label') !== 'Cursor'
    )
      el.blur();
  }, [tool]);
  const [lastMagnet, setLastMagnet] = useState<Exclude<MagnetMode, 'off'>>('weak');
  const cursorIcon = CURSORS.find((c) => c.mode === crosshair)?.icon ?? 'cross';

  return (
    <nav
      ref={navRef}
      aria-label="Drawing tools"
      className="flex h-full max-h-full min-h-0 w-12 shrink-0 flex-col items-center gap-0.5 overflow-x-clip overflow-y-auto border-r border-line bg-panel py-1.5 [scrollbar-width:none]"
    >
      <div className="relative flex">
        <IconButton
          icon={cursorIcon}
          label="Cursor"
          shortcut="Esc"
          tooltipSide="right"
          active={tool === null}
          onClick={() => app.drawings.setTool(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setFlyout({ kind: 'cursor', el: e.currentTarget });
          }}
          className="h-9 w-9"
        />
        <button
          type="button"
          aria-label="Cursor options"
          onClick={(e) => setFlyout({ kind: 'cursor', el: e.currentTarget })}
          className="absolute -right-1 bottom-0 flex h-4 w-3 items-center justify-center text-muted hover:text-fg"
        >
          <Icon name="chevronRight" size={10} />
        </button>
      </div>
      <Divider vertical={false} />
      {slots.map((slot) => {
        if (slot.kind === 'tool') {
          const def = slot.def;
          return (
            <div key={def.id} className="group/slot relative flex">
              <IconButton
                path={def.icon}
                label={def.label}
                shortcut={def.shortcut ? chordLabel(def.shortcut) : undefined}
                tooltipSide="right"
                active={tool === def.id}
                onClick={() => app.drawings.setTool(tool === def.id ? null : def.id)}
                className="h-9 w-9"
              />
              <FavoriteMark id={def.id} label={def.label} />
            </div>
          );
        }
        const activeDef = slot.tools.find((d) => d.id === tool);
        const def =
          activeDef ?? slot.tools.find((d) => d.id === groupChoice[slot.id]) ?? slot.tools[0]!;
        return (
          <div key={`group:${slot.id}`} className="group/slot relative flex">
            <IconButton
              path={def.icon}
              label={def.label}
              shortcut={def.shortcut ? chordLabel(def.shortcut) : undefined}
              tooltipSide="right"
              active={activeDef !== undefined}
              onClick={() => app.drawings.setTool(tool === def.id ? null : def.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setFlyout({ kind: 'group', id: slot.id, el: e.currentTarget });
              }}
              className="h-9 w-9"
            />
            <FavoriteMark id={def.id} label={def.label} />
            {slot.tools.length > 1 ? (
              <button
                type="button"
                aria-label={`More ${def.label.toLowerCase()} tools`}
                onClick={(e) => setFlyout({ kind: 'group', id: slot.id, el: e.currentTarget })}
                className="absolute -right-1 bottom-0 flex h-4 w-3 items-center justify-center text-muted opacity-0 hover:text-fg group-hover/slot:opacity-100 focus-visible:opacity-100"
              >
                <Icon name="chevronRight" size={10} />
              </button>
            ) : null}
          </div>
        );
      })}
      <Divider vertical={false} />
      <IconButton
        icon="star"
        label={
          favorites.length === 0
            ? 'Favorites toolbar (star a tool to add it)'
            : favoritesVisible
              ? 'Hide favorites toolbar'
              : 'Show favorites toolbar'
        }
        tooltipSide="right"
        disabled={favorites.length === 0}
        active={favorites.length > 0 && favoritesVisible}
        onClick={() => setFavoritesVisible(!favoritesVisible)}
        className="h-9 w-9"
      />
      <div className="relative flex">
        <IconButton
          icon="magnet"
          label={modes.magnet === 'off' ? 'Magnet mode' : `Magnet: ${modes.magnet}`}
          shortcut={chordLabel('Alt+M')}
          tooltipSide="right"
          active={modes.magnet !== 'off'}
          onClick={() => app.drawings.setMagnet(modes.magnet === 'off' ? lastMagnet : 'off')}
          className="h-9 w-9"
        />
        <button
          type="button"
          aria-label="Magnet options"
          onClick={(e) => setFlyout({ kind: 'magnet', el: e.currentTarget })}
          className="absolute -right-1 bottom-0 flex h-4 w-3 items-center justify-center text-muted hover:text-fg"
        >
          <Icon name="chevronRight" size={10} />
        </button>
      </div>
      <IconButton
        icon="pencilLock"
        label="Stay in drawing mode"
        tooltipSide="right"
        active={modes.stayInDrawingMode}
        onClick={() => app.drawings.setModes({ stayInDrawingMode: !modes.stayInDrawingMode })}
        className="h-9 w-9"
      />
      <IconButton
        icon={modes.lockAll ? 'lock' : 'unlock'}
        label={modes.lockAll ? 'Unlock all drawings' : 'Lock all drawings'}
        shortcut={chordLabel('Ctrl+Alt+L')}
        tooltipSide="right"
        active={modes.lockAll}
        onClick={() => app.drawings.setModes({ lockAll: !modes.lockAll })}
        className="h-9 w-9"
      />
      <IconButton
        icon={modes.hideAll ? 'eyeOff' : 'eye'}
        label={modes.hideAll ? 'Show all drawings' : 'Hide all drawings'}
        shortcut={chordLabel('Ctrl+Alt+H')}
        tooltipSide="right"
        active={modes.hideAll}
        onClick={() => app.drawings.setModes({ hideAll: !modes.hideAll })}
        className="h-9 w-9"
      />
      <IconButton
        icon="trash"
        label="Remove all drawings"
        tooltipSide="right"
        disabled={count === 0}
        onClick={() => {
          app.drawings.removeAll();
          pushToast(`Removed ${count} drawing${count === 1 ? '' : 's'} — Ctrl+Z to undo`);
        }}
        className="h-9 w-9"
      />
      <Divider vertical={false} />
      <IconButton
        icon="undo"
        label="Undo"
        shortcut={chordLabel('Ctrl+Z')}
        tooltipSide="right"
        disabled={!history.canUndo}
        onClick={() => app.history.undo()}
        className="h-9 w-9"
      />
      <IconButton
        icon="redo"
        label="Redo"
        shortcut={chordLabel('Ctrl+Y')}
        tooltipSide="right"
        disabled={!history.canRedo}
        onClick={() => app.history.redo()}
        className="h-9 w-9"
      />

      {flyout?.kind === 'cursor' ? (
        <Flyout anchor={flyout.el} onClose={() => setFlyout(null)}>
          {CURSORS.map((c) => (
            <FlyoutItem
              key={c.mode}
              icon={c.icon}
              label={c.label}
              active={crosshair === c.mode}
              onClick={() => {
                app.settings.update({ crosshairMode: c.mode });
                app.drawings.setTool(null);
                setFlyout(null);
              }}
            />
          ))}
        </Flyout>
      ) : null}
      {flyout?.kind === 'group' ? (
        <Flyout anchor={flyout.el} onClose={() => setFlyout(null)}>
          {slots
            .filter((s) => s.kind === 'group' && s.id === flyout.id)
            .flatMap((s) => (s.kind === 'group' ? s.tools : []))
            .map((def) => (
              <FlyoutItem
                key={def.id}
                path={def.icon}
                label={def.label}
                shortcut={def.shortcut ? chordLabel(def.shortcut) : undefined}
                active={tool === def.id}
                favorite={favorites.includes(def.id)}
                onToggleFavorite={() => toggleFavorite(def.id)}
                onClick={() => {
                  setGroupChoice((c) => ({ ...c, [flyout.id]: def.id }));
                  app.drawings.setTool(def.id);
                  setFlyout(null);
                }}
              />
            ))}
        </Flyout>
      ) : null}
      {flyout?.kind === 'magnet' ? (
        <Flyout anchor={flyout.el} onClose={() => setFlyout(null)}>
          {MAGNETS.map((m) => (
            <FlyoutItem
              key={m.mode}
              icon="magnet"
              label={m.label}
              active={modes.magnet === m.mode}
              onClick={() => {
                setLastMagnet(m.mode);
                app.drawings.setMagnet(m.mode);
                setFlyout(null);
              }}
            />
          ))}
          <FlyoutItem
            label="Off"
            active={modes.magnet === 'off'}
            onClick={() => (app.drawings.setMagnet('off'), setFlyout(null))}
          />
        </Flyout>
      ) : null}
    </nav>
  );
}
