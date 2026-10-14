'use client';

import { useState } from 'react';
import { chordLabel } from '@/lib/app';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { useBacktest } from './context';
import { fromDateTimeInput, lots, money, toDateTimeInput, utcDateTime } from './format';
import { useBacktestStore } from './store';

const field =
  'h-8 w-full rounded-md border border-line bg-chart px-2 tabular-nums text-fg outline-none focus:border-accent';

/** Every dialog of the session view, driven by the backtest store. */
export function BacktestModals() {
  const modal = useBacktestStore((s) => s.modal);
  const openModal = useBacktestStore((s) => s.openModal);
  const close = () => openModal(null);
  if (!modal) return null;
  switch (modal.type) {
    case 'confirm-rewind':
      return (
        <ConfirmRewind
          time={modal.time}
          removed={modal.check.removed}
          reopened={modal.check.reopened}
          onClose={close}
        />
      );
    case 'go-to':
      return <GoToDialog onClose={close} />;
    case 'partial-close':
      return <PartialClose id={modal.positionId} onClose={close} />;
    case 'edit-position':
      return <EditLevels id={modal.positionId} kind="position" onClose={close} />;
    case 'edit-order':
      return <EditLevels id={modal.orderId} kind="order" onClose={close} />;
    case 'settings':
      return <SettingsDialog onClose={close} />;
    case 'shortcuts':
      return <ShortcutsDialog onClose={close} />;
  }
}

function ConfirmRewind({
  time,
  removed,
  reopened,
  onClose,
}: {
  time: number;
  removed: number;
  reopened: number;
  onClose: () => void;
}) {
  const c = useBacktest();
  return (
    <Dialog
      title="Rewind and undo trades?"
      onClose={onClose}
      width={460}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              onClose();
              void c.rewindTo(time, true);
            }}
          >
            Rewind
          </Button>
        </>
      }
    >
      <p className="p-5 text-[13px]">
        Rewinding to {utcDateTime(time)} UTC undoes everything you did after it:{' '}
        {removed > 0 ? `${removed} order${removed > 1 ? 's' : ''} placed` : ''}
        {removed > 0 && reopened > 0 ? ' and ' : ''}
        {reopened > 0
          ? `${reopened} closed trade${reopened > 1 ? 's' : ''} (with their journal notes)`
          : ''}
        . The account is re-simulated from the session start.
      </p>
    </Dialog>
  );
}

function GoToDialog({ onClose }: { onClose: () => void }) {
  const c = useBacktest();
  const [value, setValue] = useState(toDateTimeInput(c.cursor + 3_600_000));
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const t = fromDateTimeInput(value);
    if (t === null) return setError('Enter a valid date and time');
    if (t <= c.cursor) return setError('Go to only moves forward. Use rewind to go back.');
    // Close first: reaching the session end leaves this page for analytics.
    onClose();
    const err = await c.goTo(t);
    if (err) c.notice('error', err);
  };
  return (
    <Dialog
      title="Go to date & time"
      onClose={onClose}
      width={400}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void submit()}>
            Go
          </Button>
        </>
      }
    >
      <div className="space-y-2 p-5 text-[13px]">
        <p className="text-muted">
          Skips forward; every minute in between is replayed, so orders, SL and TP still trigger.
          Times are UTC.
        </p>
        <input
          aria-label="Date and time (UTC)"
          type="datetime-local"
          className={field}
          value={value}
          min={toDateTimeInput(c.cursor)}
          max={toDateTimeInput(c.end)}
          onChange={(e) => setValue(e.target.value)}
        />
        {error ? <p className="text-down">{error}</p> : null}
      </div>
    </Dialog>
  );
}

function PartialClose({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useBacktest();
  const pos = useBacktestStore((s) => s.snap?.positions.find((p) => p.id === id));
  const [volume, setVolume] = useState(
    pos ? Math.max(c.cfg.lotMin, Math.round((pos.volume / 2) * 100) / 100) : 0,
  );
  if (!pos) return null;
  return (
    <Dialog
      title={`Partial close · #${id}`}
      onClose={onClose}
      width={380}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => !c.trading.close(id, volume) && onClose()}>
            Close {lots(volume)} lots
          </Button>
        </>
      }
    >
      <div className="space-y-3 p-5 text-[13px]">
        <p className="text-muted">
          Open volume {lots(pos.volume)} lots. The rest stays open with the same SL and TP.
        </p>
        <div className="flex gap-1">
          {[25, 50, 75].map((p) => (
            <Button
              key={p}
              onClick={() => setVolume(Math.floor(((pos.volume * p) / 100) * 100) / 100)}
            >
              {p}%
            </Button>
          ))}
        </div>
        <input
          aria-label="Volume to close"
          type="number"
          min={c.cfg.lotMin}
          max={pos.volume}
          step={c.cfg.lotStep}
          className={field}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </div>
    </Dialog>
  );
}

function EditLevels({
  id,
  kind,
  onClose,
}: {
  id: string;
  kind: 'position' | 'order';
  onClose: () => void;
}) {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  const item =
    kind === 'position'
      ? snap?.positions.find((p) => p.id === id)
      : snap?.orders.find((o) => o.id === id);
  const [price, setPrice] = useState(item && 'price' in item ? item.price : 0);
  const [volume, setVolume] = useState(item?.volume ?? 0);
  const [sl, setSl] = useState(item?.sl === null || item?.sl === undefined ? '' : String(item.sl));
  const [tp, setTp] = useState(item?.tp === null || item?.tp === undefined ? '' : String(item.tp));
  if (!item) return null;
  const parse = (v: string) => (v.trim() === '' ? null : Number(v));
  const save = () => {
    const err =
      kind === 'position'
        ? c.trading.modifyPosition(id, { sl: parse(sl), tp: parse(tp) })
        : c.trading.modifyOrder(id, { price, volume, sl: parse(sl), tp: parse(tp) });
    if (!err) onClose();
  };
  return (
    <Dialog
      title={`${kind === 'position' ? 'Edit position' : 'Edit order'} · #${id}`}
      onClose={onClose}
      width={380}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[110px_1fr] items-center gap-2 p-5 text-[13px]">
        {kind === 'order' ? (
          <>
            <span className="text-muted">Price</span>
            <input
              aria-label="Price"
              type="number"
              step={c.cfg.tickSize}
              className={field}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
            <span className="text-muted">Volume</span>
            <input
              aria-label="Volume"
              type="number"
              step={c.cfg.lotStep}
              className={field}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </>
        ) : null}
        <span className="text-[#ff9800]">Stop loss</span>
        <input
          aria-label="Stop loss"
          type="number"
          step={c.cfg.tickSize}
          placeholder="none"
          className={field}
          value={sl}
          onChange={(e) => setSl(e.target.value)}
        />
        <span className="text-[#22ab94]">Take profit</span>
        <input
          aria-label="Take profit"
          type="number"
          step={c.cfg.tickSize}
          placeholder="none"
          className={field}
          value={tp}
          onChange={(e) => setTp(e.target.value)}
        />
      </div>
    </Dialog>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const c = useBacktest();
  const s = c.session.settings;
  const [name, setName] = useState(s.name);
  const [description, setDescription] = useState(s.description);
  const [tag, setTag] = useState(s.strategyTag);
  return (
    <Dialog
      title="Session settings"
      onClose={onClose}
      width={460}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!name.trim()) return;
              c.updateSettings({ name: name.trim(), description, strategyTag: tag.trim() });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3 p-5 text-[13px]">
        <label className="block space-y-1">
          <span className="text-muted">Session name</span>
          <input
            className={field}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-muted">Strategy tag</span>
          <input className={field} value={tag} onChange={(e) => setTag(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-muted">Description</span>
          <textarea
            className="min-h-20 w-full rounded-md border border-line bg-chart p-2 text-fg outline-none focus:border-accent"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <p className="rounded-md bg-chart p-2 text-[12px] text-muted">
          Balance {money(s.startingBalance)} · {utcDateTime(s.startDate, false)} →{' '}
          {utcDateTime(s.endDate, false)} · spread {s.spreadEnabled ? s.spread : 'off'} · commission{' '}
          {s.commissionEnabled ? `$${s.commissionPerLot}/lot/side` : 'off'}. These are fixed once
          the session has trades; duplicate the session from the sessions page to test other values.
        </p>
      </div>
    </Dialog>
  );
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const c = useBacktest();
  const groups = [...c.app.shortcuts.byCategory()];
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} width={560}>
      <div className="space-y-4 p-5 text-[13px]">
        {groups.map(([category, list]) => (
          <section key={category}>
            <h3 className="mb-1 text-[12px] font-semibold uppercase text-muted">{category}</h3>
            {list.map((s) => (
              <div
                key={s.id}
                className="flex h-7 items-center justify-between border-b border-line/50"
              >
                <span>{s.description}</span>
                <span className="text-muted">{s.keys.map(chordLabel).join(' / ')}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Dialog>
  );
}
