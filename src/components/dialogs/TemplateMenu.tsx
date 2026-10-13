'use client';

import { useState, useSyncExternalStore } from 'react';
import type { AnyToolDefinition, DrawingStyle } from '@/lib/drawings';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Popover } from '../ui/Popover';

const ITEM = 'flex h-8 w-full items-center rounded-md px-2 text-left text-[13px] hover:bg-hover';

/** Named style templates of one tool: save the current style, apply or delete saved ones. */
export function TemplateMenu({
  def,
  style,
  onApply,
}: {
  def: AnyToolDefinition;
  style: DrawingStyle;
  onApply: (style: DrawingStyle) => void;
}) {
  const app = useApp();
  const pushToast = useUiStore((s) => s.pushToast);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const templates = useSyncExternalStore(
    (cb) => app.drawings.templates.onChange(cb),
    () => app.drawings.templates.list(def.id),
  );

  const close = () => {
    setOpen(false);
    setNaming(false);
    setName('');
  };
  const saveTemplate = () => {
    if (!name.trim()) return;
    const t = app.drawings.templates.save(def.id, app.drawings.newId(), name, style);
    pushToast(`Template "${t.name}" saved`);
    close();
  };
  const applyStyle = (next: DrawingStyle) => {
    onApply({ ...style, ...structuredClone(next) });
    close();
  };

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-[13px] font-medium text-fg transition hover:bg-hover"
      >
        Template
        <Icon name="chevronDown" size={14} />
      </button>
      {open ? (
        <Popover anchor={anchor} onClose={close}>
          <div className="flex w-60 flex-col gap-0.5 text-fg">
            {naming ? (
              <form
                className="flex gap-1.5 p-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveTemplate();
                }}
              >
                <input
                  autoFocus
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Template name"
                  className="h-8 min-w-0 flex-1 rounded-md border border-line bg-chart px-2 text-[13px] outline-none focus:border-accent"
                />
                <Button type="submit" variant="primary" disabled={!name.trim()}>
                  Save
                </Button>
              </form>
            ) : (
              <button type="button" className={ITEM} onClick={() => setNaming(true)}>
                Save drawing template as…
              </button>
            )}
            {templates.length ? (
              <div className="my-1 border-t border-line pt-1">
                {templates.map((t) => (
                  <div key={t.id} className="group flex items-center">
                    <button type="button" className={ITEM} onClick={() => applyStyle(t.style)}>
                      <span className="truncate">{t.name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete template ${t.name}`}
                      className="ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted opacity-0 hover:bg-hover hover:text-down group-hover:opacity-100 focus:opacity-100"
                      onClick={() => app.drawings.templates.remove(def.id, t.id)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-1 border-t border-line pt-1">
              <button
                type="button"
                className={ITEM}
                onClick={() => {
                  app.drawings.defaults.set(def.id, style);
                  pushToast(`Saved as default for ${def.label}`);
                  close();
                }}
              >
                Save as default
              </button>
              <button
                type="button"
                className={ITEM}
                onClick={() => {
                  app.drawings.defaults.reset(def.id);
                  applyStyle(app.drawings.defaults.resolve(def, app.engine.getTheme()));
                }}
              >
                Reset to default
              </button>
            </div>
          </div>
        </Popover>
      ) : null}
    </>
  );
}
