'use client';

import { useMemo, useRef, useState } from 'react';
import { drawingRegistry, type ChartPoint, type SerializedDrawing } from '@/lib/drawings';
import { SchemaForm } from '../schema-form/SchemaForm';
import { useApp } from '../state/app-context';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Tabs } from '../ui/Tabs';
import { CoordinatesTab } from './CoordinatesTab';
import { TemplateMenu } from './TemplateMenu';

const COORDS_TAB = 'coordinates';

/**
 * Per-drawing settings: the tool's schema tabs (plus derived fields) and an auto-generated
 * Coordinates tab. Edits preview live; OK commits one undoable step, Cancel restores.
 */
export function DrawingSettingsDialog({
  drawingId,
  initialTab,
  onClose,
}: {
  drawingId: string;
  initialTab?: string | undefined;
  onClose: () => void;
}) {
  const app = useApp();
  const drawing = app.drawings.store.get(drawingId);
  const [before] = useState<SerializedDrawing | null>(() => drawing?.serialize() ?? null);
  const [draft, setDraft] = useState<SerializedDrawing | null>(before);
  const draftRef = useRef(draft);
  const def = drawing ? drawingRegistry.get(drawing.type) : undefined;
  const tabs = useMemo(
    () => (def ? [...def.settings.tabs, { id: COORDS_TAB, label: 'Coordinates', groups: [] }] : []),
    [def],
  );
  const [tab, setTab] = useState(initialTab ?? tabs[0]?.id ?? COORDS_TAB);
  if (!drawing || !def || !draft || !before) return null;
  const symbol = app.engine.getSymbol();

  const apply = (next: SerializedDrawing) => {
    draftRef.current = next;
    setDraft(next);
    app.drawings.preview(drawingId, next);
  };
  const derived = def.derivedFields;
  const values = derived ? { ...draft.style, ...derived.get(draft, symbol) } : draft.style;
  // Colour controls report colour and opacity in one click. Each call must see the draft the
  // previous call just wrote, or the second one rebuilds style from the old snapshot and drops the colour.
  const setField = (key: string, value: unknown) => {
    const current = draftRef.current;
    if (!current) return;
    apply(
      derived?.keys.includes(key)
        ? derived.set(current, key, value, symbol)
        : { ...current, style: { ...current.style, [key]: value } },
    );
  };
  const setPoint = (i: number, p: Partial<ChartPoint>) => {
    const current = draftRef.current;
    if (!current) return;
    const points = current.points.map((q, j) => (j === i ? { ...q, ...p } : q));
    apply({ ...current, points: def.normalizePoints ? def.normalizePoints(points) : points });
  };

  const cancel = () => {
    app.drawings.preview(drawingId, before);
    onClose();
  };
  const ok = () => {
    app.drawings.commit(drawingId, before, `Edit ${def.label}`);
    onClose();
  };

  const current = tabs.find((t) => t.id === tab) ?? tabs[0]!;
  return (
    <Dialog
      title={def.label}
      onClose={cancel}
      width={580}
      footer={
        <>
          <TemplateMenu
            def={def}
            style={draft.style}
            onApply={(style) => {
              const current = draftRef.current;
              if (current) apply({ ...current, style });
            }}
          />
          <div className="flex-1" />
          <Button onClick={cancel}>Cancel</Button>
          <Button variant="primary" onClick={ok}>
            Ok
          </Button>
        </>
      }
    >
      <Tabs tabs={tabs} active={current.id} onChange={setTab} />
      <div role="tabpanel" className="min-h-[320px]">
        {current.id === COORDS_TAB ? (
          <CoordinatesTab
            def={def}
            draft={draft}
            coords={app.engine.coords}
            symbol={symbol}
            onPoint={setPoint}
          />
        ) : (
          <SchemaForm groups={current.groups} values={values} onChange={setField} />
        )}
      </div>
    </Dialog>
  );
}
