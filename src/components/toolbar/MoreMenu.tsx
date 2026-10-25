'use client';

import { useState } from 'react';
import {
  currentPlan,
  entitlements,
  guardPlan,
  isPlanLimitMessage,
  openPlanPrompt,
  requiresPlan,
} from '@/lib/app';
import { useApp } from '../state/app-context';
import { useUiStore } from '../state/ui-store';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import type { IconName } from '../ui/icons';
import { Popover } from '../ui/Popover';
import { downloadText, readJsonFile } from '../ui/files';
import { useToolbarText } from './toolbar-locale';

/** Overflow menu: drawings import/export and secondary dialogs. */
export function MoreMenu() {
  const app = useApp();
  const symbol = useUiStore((s) => s.symbol?.symbol ?? 'chart');
  const openDialog = useUiStore((s) => s.openDialog);
  const pushToast = useUiStore((s) => s.pushToast);
  const { fa, t } = useToolbarText();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const res = app.drawingStore.importJson(await readJsonFile(file));
    if (res.ok)
      pushToast(`Imported ${res.count} drawing(s)${res.skipped ? `, skipped ${res.skipped}` : ''}`);
    else if (isPlanLimitMessage(res.error)) openPlanPrompt(res.error);
    else pushToast(`Import failed: ${res.error}`, 'error');
  };

  const transferAllowed = () =>
    guardPlan(
      entitlements(currentPlan()).drawingTransfer
        ? null
        : requiresPlan('خروجی و ورود ترسیم', 'mid'),
    );
  const items: Array<{ label: string; icon: IconName; shortcut?: string; run: () => void }> = [
    {
      label: t('Export drawings (JSON)'),
      icon: 'download',
      run: () => {
        if (!transferAllowed()) return;
        downloadText(`${symbol}.drawings.json`, app.drawingStore.exportJson());
      },
    },
    {
      label: t('Import drawings…'),
      icon: 'upload',
      run: () => {
        if (!transferAllowed()) return;
        fileInput?.click();
      },
    },
    { label: t('Themes…'), icon: 'palette', run: () => openDialog({ type: 'theme-editor' }) },
    {
      label: t('Keyboard shortcuts'),
      icon: 'keyboard',
      shortcut: '?',
      run: () => openDialog({ type: 'shortcuts' }),
    },
  ];

  return (
    <>
      <IconButton
        icon="more"
        label={t('More')}
        active={anchor !== null}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      />
      <input
        ref={setFileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void onImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {anchor ? (
        <Popover anchor={anchor} onClose={() => setAnchor(null)}>
          <div
            dir={fa ? 'rtl' : 'ltr'}
            className="-m-1.5 flex min-w-56 flex-col gap-0.5 p-1"
            role="menu"
          >
            {items.map((it, idx) => (
              <div key={it.label}>
                {idx === 2 ? <div role="separator" className="my-1 h-px bg-line/70" /> : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAnchor(null);
                    it.run();
                  }}
                  className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-start text-[12.5px] text-fg transition-colors hover:bg-hover"
                >
                  <Icon name={it.icon} size={15} className="text-muted" />
                  <span className="flex-1">{it.label}</span>
                  {it.shortcut ? (
                    <kbd className="rounded bg-chart/80 px-1.5 py-0.5 font-mono text-[10.5px] text-muted ring-1 ring-inset ring-line">
                      {it.shortcut}
                    </kbd>
                  ) : null}
                </button>
              </div>
            ))}
          </div>
        </Popover>
      ) : null}
    </>
  );
}
