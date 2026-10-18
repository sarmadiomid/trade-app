'use client';

import { useState } from 'react';
import { chordLabel } from '@/lib/app';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { useBacktest } from './context';
import { JalaliDateField } from './JalaliField';
import { faNum, lots, money, toDateInput, utcDateTime } from './format';
import { useBacktestStore } from './store';

const field =
  'h-8 w-full rounded-md border border-line bg-chart px-2 text-left tabular-nums text-fg outline-none focus:border-accent';

const SHORTCUT_FA: Readonly<Record<string, string>> = {
  Undo: 'برگرداندن',
  Redo: 'از نو',
  'Symbol search (or just start typing a symbol)': 'جستجوی نماد (یا شروع به تایپ نماد)',
  'Chart settings': 'تنظیمات نمودار',
  'Keyboard shortcuts': 'میانبرهای صفحه‌کلید',
  'Reset chart view': 'بازنشانی نمای نمودار',
  'Jump to the latest bar': 'پرش به آخرین کندل',
  'Toggle auto scale': 'مقیاس خودکار',
  'Toggle log scale': 'مقیاس لگاریتمی',
  'Toggle percent scale': 'مقیاس درصدی',
  'Invert scale': 'وارونه کردن مقیاس',
  'Toggle volume pane': 'نمایش حجم',
  'Scroll left': 'جابه‌جایی به چپ',
  'Scroll right': 'جابه‌جایی به راست',
  'Zoom in': 'بزرگ‌نمایی',
  'Zoom out': 'کوچک‌نمایی',
  'Step forward one bar': 'یک کندل به جلو',
  'Play / pause': 'پخش / مکث',
  'Cancel start-bar selection': 'لغو انتخاب کندل شروع',
  'Cancel tool / finish path / deselect': 'لغو ابزار / پایان مسیر / برداشتن انتخاب',
  'Finish path': 'پایان مسیر',
  'Remove selected drawing': 'حذف ترسیم انتخاب‌شده',
  'Copy drawing': 'کپی ترسیم',
  'Paste drawing': 'چسباندن ترسیم',
  'Duplicate drawing': 'تکثیر ترسیم',
  'Cycle magnet (off → weak → strong); hold Ctrl to toggle temporarily':
    'آهنربا: خاموش، ضعیف، قوی. با نگه‌داشتن Ctrl موقتی عوض می‌شود',
  'Hide / show all drawings': 'پنهان / نمایان کردن ترسیم‌ها',
  'Lock / unlock all drawings': 'قفل / باز کردن ترسیم‌ها',
};

const CATEGORY_FA: Readonly<Record<string, string>> = {
  General: 'عمومی',
  Chart: 'نمودار',
  'Drawing tools': 'ابزار رسم',
  Drawings: 'ترسیم‌ها',
  Replay: 'بازپخش',
  Backtest: 'بک‌تست',
};

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
      title="بازگشت و لغو معاملات؟"
      onClose={onClose}
      width={460}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>انصراف</Button>
          <Button
            variant="danger"
            onClick={() => {
              onClose();
              void c.rewindTo(time, true);
            }}
          >
            بازگشت
          </Button>
        </>
      }
    >
      <p className="p-5 text-[13px] leading-7">
        با برگشت به {utcDateTime(time)} (ساعت جهانی) هر کاری که بعد از آن کرده‌اید لغو می‌شود
        {removed > 0 ? `؛ ${faNum(removed)} سفارش ثبت‌شده` : ''}
        {removed > 0 && reopened > 0 ? ' و ' : ''}
        {reopened > 0 ? `${faNum(reopened)} معامله بسته‌شده به همراه یادداشت‌های دفتر` : ''}. حساب
        از ابتدای جلسه دوباره محاسبه می‌شود.
      </p>
    </Dialog>
  );
}

function GoToDialog({ onClose }: { onClose: () => void }) {
  const c = useBacktest();
  const seed = c.cursor + 3_600_000;
  const seedDate = new Date(seed);
  const [day, setDay] = useState(toDateInput(seed));
  const [hour, setHour] = useState(seedDate.getUTCHours());
  const [minute, setMinute] = useState(seedDate.getUTCMinutes());
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    const t = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, minute) : NaN;
    if (!Number.isFinite(t)) return setError('تاریخ و ساعت معتبر نیست');
    if (t <= c.cursor) return setError('پرش فقط به جلو است. برای برگشت از بازگردانی استفاده کنید.');
    onClose();
    const err = await c.goTo(t);
    if (err) c.notice('error', err);
  };
  return (
    <Dialog
      title="پرش به تاریخ و ساعت"
      onClose={onClose}
      width={440}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>انصراف</Button>
          <Button variant="primary" onClick={() => void submit()}>
            برو
          </Button>
        </>
      }
    >
      <div className="space-y-3 p-5 text-[13px]">
        <p className="leading-6 text-muted">
          به جلو می‌پرد و هر دقیقه بین این نقطه و مقصد بازپخش می‌شود؛ پس سفارش، حد ضرر و حد سود
          همچنان فعال می‌مانند. ساعت، ساعت جهانی است نه ساعت تهران.
        </p>
        <JalaliDateField
          ariaLabel="تاریخ پرش"
          value={day}
          min={toDateInput(c.cursor)}
          max={toDateInput(c.end)}
          onChange={setDay}
        />
        <div className="flex items-center gap-2" dir="ltr">
          <span className="text-muted" dir="rtl">
            ساعت
          </span>
          <select
            aria-label="ساعت"
            className={field}
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {faNum(h)}
              </option>
            ))}
          </select>
          <span>:</span>
          <select
            aria-label="دقیقه"
            className={field}
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
          >
            {Array.from({ length: 60 }, (_, m) => (
              <option key={m} value={m}>
                {faNum(m)}
              </option>
            ))}
          </select>
        </div>
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
      title={`بستن جزئی · #${id}`}
      onClose={onClose}
      width={380}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>انصراف</Button>
          <Button variant="primary" onClick={() => !c.trading.close(id, volume) && onClose()}>
            بستن {lots(volume)} لات
          </Button>
        </>
      }
    >
      <div className="space-y-3 p-5 text-[13px]">
        <p className="leading-6 text-muted">
          حجم باز {lots(pos.volume)} لات است. باقی‌مانده با همان حد ضرر و حد سود باز می‌ماند.
        </p>
        <div className="flex gap-1">
          {[25, 50, 75].map((p) => (
            <Button
              key={p}
              onClick={() => setVolume(Math.floor(((pos.volume * p) / 100) * 100) / 100)}
            >
              {faNum(p)}٪
            </Button>
          ))}
        </div>
        <input
          aria-label="حجمی که بسته می‌شود"
          dir="ltr"
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
      title={`${kind === 'position' ? 'ویرایش معامله' : 'ویرایش سفارش'} · #${id}`}
      onClose={onClose}
      width={420}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>انصراف</Button>
          <Button variant="primary" onClick={save}>
            ذخیره
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[7rem_1fr] items-center gap-2 p-5 text-[13px]">
        {kind === 'order' ? (
          <>
            <span className="text-muted">قیمت</span>
            <input
              aria-label="قیمت"
              dir="ltr"
              type="number"
              step={c.cfg.tickSize}
              className={field}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
            <span className="text-muted">حجم</span>
            <input
              aria-label="حجم"
              dir="ltr"
              type="number"
              step={c.cfg.lotStep}
              className={field}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </>
        ) : null}
        <span className="text-[#ff9800]">حد ضرر</span>
        <input
          aria-label="حد ضرر"
          dir="ltr"
          type="number"
          step={c.cfg.tickSize}
          placeholder="ندارد"
          className={field}
          value={sl}
          onChange={(e) => setSl(e.target.value)}
        />
        <span className="text-[#22ab94]">حد سود</span>
        <input
          aria-label="حد سود"
          dir="ltr"
          type="number"
          step={c.cfg.tickSize}
          placeholder="ندارد"
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
      title="تنظیمات جلسه"
      onClose={onClose}
      width={460}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>انصراف</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!name.trim()) return;
              c.updateSettings({ name: name.trim(), description, strategyTag: tag.trim() });
              onClose();
            }}
          >
            ذخیره
          </Button>
        </>
      }
    >
      <div className="space-y-3 p-5 text-[13px]">
        <label className="block space-y-1">
          <span className="text-muted">نام جلسه</span>
          <input
            className={field}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-muted">برچسب استراتژی</span>
          <input className={field} value={tag} onChange={(e) => setTag(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-muted">توضیح</span>
          <textarea
            className="min-h-20 w-full rounded-md border border-line bg-chart p-2 text-fg outline-none focus:border-accent"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <p className="rounded-md bg-chart p-2 text-[12px] leading-6 text-muted">
          موجودی شروع {money(s.startingBalance)} · {utcDateTime(s.startDate, false)} تا{' '}
          {utcDateTime(s.endDate, false)} · اسپرد{' '}
          {s.spreadEnabled ? faNum(s.spread) : 'خاموش'} · کارمزد{' '}
          {s.commissionEnabled ? `${faNum(s.commissionPerLot)} دلار برای هر لات، هر طرف` : 'خاموش'}.
          بعد از ثبت معامله این‌ها ثابت می‌مانند. برای آزمون مقدار دیگر، جلسه را از فهرست کپی کنید.
        </p>
      </div>
    </Dialog>
  );
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const c = useBacktest();
  const groups = [...c.app.shortcuts.byCategory()];
  return (
    <Dialog title="میانبرها" onClose={onClose} width={560}>
      <div className="space-y-4 p-5 text-[13px]">
        {groups.map(([category, list]) => (
          <section key={category}>
            <h3 className="mb-1 text-[12px] font-semibold text-muted">
              {CATEGORY_FA[category] ?? category}
            </h3>
            {list.map((s) => (
              <div
                key={s.id}
                className="flex min-h-7 items-center justify-between gap-3 border-b border-line/50 py-1"
              >
                <span>{SHORTCUT_FA[s.description] ?? s.description}</span>
                <span className="shrink-0 text-muted" dir="ltr">
                  {s.keys.map(chordLabel).join(' / ')}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Dialog>
  );
}
