'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { browserBacktestServices } from '@/lib/app';
import { accountConfig, computeStats, equityCurve, type SessionSummary } from '@/lib/backtest';
import { faDigits, JALALI_MONTHS, JALALI_WEEKDAYS, utcToJalali } from '@/lib/locale/jalali';
import { faNum, money, signedMoney, utcDate } from '../backtest/format';
import { remainingDays } from './overview';
import { journalHref } from './journal-href';
import { statsHref } from './stats-href';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';

const DAY = 86_400_000;
const card = 'rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)]';

interface Point {
  readonly time: number;
  readonly balance: number;
}

interface TradeRow {
  readonly id: string;
  readonly closeTime: number;
  readonly netPnl: number;
}

interface Detail {
  readonly description: string;
  readonly strategyTag: string;
  readonly name: string;
  readonly trades: readonly TradeRow[];
  readonly equity: readonly Point[];
  readonly winRate: number;
  readonly avgRR: number | null;
}

/**
 * Sessions tab: one session at a time, with its balance, charts and recent trades.
 */
export function SessionsBoard({
  sessions,
  onCreate,
  onChanged,
}: {
  readonly sessions: SessionSummary[] | null | 'error';
  readonly onCreate: () => void;
  readonly onChanged: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [openList, setOpenList] = useState(false);
  const [menu, setMenu] = useState(false);
  const [loaded, setLoaded] = useState<{ id: string; detail: Detail } | null>(null);
  const [settings, setSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pageState, setPageState] = useState<{ id: string | null; page: number }>({
    id: null,
    page: 0,
  });
  const [pageSize, setPageSize] = useState(5);
  const [rev, setRev] = useState(0);

  const currentId =
    sessions && sessions !== 'error'
      ? sessions.some((s) => s.id === selected)
        ? selected
        : (sessions[0]?.id ?? null)
      : null;
  const summary =
    sessions && sessions !== 'error' ? (sessions.find((s) => s.id === currentId) ?? null) : null;
  const detail = loaded?.id === currentId ? loaded.detail : null;
  const page = pageState.id === currentId ? pageState.page : 0;
  const setPage = (next: number | ((page: number) => number)) => {
    setPageState((prev) => {
      const current = prev.id === currentId ? prev.page : 0;
      return { id: currentId, page: typeof next === 'function' ? next(current) : next };
    });
  };

  useEffect(() => {
    if (!currentId) return;
    let cancel = false;
    const id = currentId;
    const services = browserBacktestServices();
    void services.repo.load(id).then((session) => {
      if (cancel || !session) return;
      const spec = services.spec(session.settings.symbol);
      const cfg = accountConfig(session.settings, spec);
      const stats = computeStats(cfg, session.account.trades);
      const curve = equityCurve(cfg, session.account.trades, session.settings.startDate);
      setLoaded({
        id,
        detail: {
          description: session.settings.description,
          strategyTag: session.settings.strategyTag,
          name: session.settings.name,
          trades: session.account.trades.map((t) => ({
            id: t.id,
            closeTime: t.closeTime,
            netPnl: t.netPnl,
          })),
          equity: curve.map((p) => ({ time: p.time, balance: p.balance })),
          winRate: stats.winRate,
          avgRR: stats.avgRR,
        },
      });
    });
    return () => {
      cancel = true;
    };
  }, [currentId, rev]);

  useEffect(() => {
    if (!openList && !menu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest('[data-session-menu]')) {
        setOpenList(false);
        setMenu(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [openList, menu]);

  if (sessions === null) {
    return (
      <div className="flex flex-col gap-3 px-4 py-6 sm:px-8">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--h-chip)]" />
        ))}
      </div>
    );
  }
  if (sessions === 'error') {
    return (
      <p className="px-8 py-16 text-center text-[14px] text-[var(--h-muted)]">
        جلسه‌ها بارگذاری نشد.
      </p>
    );
  }
  if (!summary || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
        <p className="max-w-sm text-[14px] leading-7 text-[var(--h-muted)]">
          هنوز جلسه‌ای نساخته‌اید. نماد، موجودی و بازهٔ تاریخ را انتخاب کنید.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--h-accent)] px-4 text-[13px] font-semibold text-white"
        >
          <Icon name="plus" size={15} /> جلسه جدید
        </button>
      </div>
    );
  }

  const pnl = summary.balance - summary.startingBalance;
  const left = remainingDays(summary);
  const trades = detail?.trades ?? [];
  const monthPnl = sumWhere(trades, (t) => sameMonth(t.closeTime, summary.cursor));
  const weekPnl = sumWhere(
    trades,
    (t) => t.closeTime >= summary.cursor - 7 * DAY && t.closeTime <= summary.cursor,
  );
  const dayPnl = sumWhere(trades, (t) => sameUtcDay(t.closeTime, summary.cursor));
  const pages = Math.max(1, Math.ceil(trades.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const slice = [...trades]
    .sort((a, b) => b.closeTime - a.closeTime)
    .slice(safePage * pageSize, safePage * pageSize + pageSize);

  const remove = async () => {
    setDeleting(false);
    await browserBacktestServices().repo.remove(summary.id);
    onChanged();
  };

  return (
    <div data-testid="sessions-board" className="px-4 py-5 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="relative min-w-[240px] flex-1" data-session-menu="">
          <p className="mb-1.5 text-[12px] text-[var(--h-muted)]">انتخاب جلسه</p>
          <button
            type="button"
            aria-expanded={openList}
            onClick={() => setOpenList((v) => !v)}
            className={`${card} flex w-full max-w-md items-center gap-3 px-4 py-3 text-start`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">{summary.name}</span>
              <span className="mt-0.5 block text-[12px] text-[var(--h-muted)]" dir="ltr">
                {summary.symbol}
              </span>
              <span className="mt-1 block text-[12px] text-[var(--h-muted)]">
                موجودی فعلی: <bdi dir="ltr">{money(summary.balance, 2)}</bdi>
              </span>
              <span className="mt-0.5 block text-[12px] text-[var(--h-muted)]">
                {utcDate(summary.startDate)} – {utcDate(summary.endDate)}
              </span>
            </span>
            <Icon name="chevronDown" size={16} className="text-[var(--h-muted)]" />
          </button>
          {openList ? (
            <ul className="absolute z-20 mt-1 max-h-72 w-full max-w-md overflow-auto rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-1 shadow-2xl">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(s.id);
                      setOpenList(false);
                    }}
                    className={`flex w-full flex-col rounded-lg px-3 py-2 text-start ${
                      s.id === summary.id ? 'bg-[var(--h-soft)]' : 'hover:bg-[var(--h-chip)]'
                    }`}
                  >
                    <span className="text-[13px] font-semibold">{s.name}</span>
                    <span className="text-[11px] text-[var(--h-muted)]" dir="ltr">
                      {s.symbol}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#2f6bff] px-3.5 text-[13px] font-semibold text-white"
          >
            <Icon name="plus" size={15} /> جلسه جدید
          </button>
          <div className="relative" data-session-menu="">
            <button
              type="button"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--h-line)] px-3 text-[13px] font-medium"
            >
              آمار
              <Icon name="chevronDown" size={14} />
            </button>
            {menu ? (
              <div className="absolute end-0 z-20 mt-1 w-40 rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-1 shadow-2xl">
                <Link
                  href={statsHref(summary.id)}
                  className="block rounded-lg px-3 py-2 text-[13px] hover:bg-[var(--h-chip)]"
                  onClick={() => setMenu(false)}
                >
                  آمار جلسه
                </Link>
                <Link
                  href={journalHref(summary.id)}
                  className="block rounded-lg px-3 py-2 text-[13px] hover:bg-[var(--h-chip)]"
                  onClick={() => setMenu(false)}
                >
                  دفتر
                </Link>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setSettings(true)}
            className="h-9 rounded-full px-3 text-[13px] font-medium text-[var(--h-muted)] hover:text-[var(--h-text)]"
          >
            تنظیمات جلسه
          </button>
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className="h-9 rounded-full bg-[#ff5c7a]/15 px-3 text-[13px] font-semibold text-[#ff8b9a]"
          >
            حذف جلسه
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.8fr)]">
        <section className={`${card} p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-[22px] font-bold">{summary.name}</h2>
              <p className="mt-1 text-[13px] text-[var(--h-muted)]">
                {detail?.strategyTag ? detail.strategyTag : 'بدون استراتژی'}
                {' · '}
                <bdi dir="ltr">{summary.symbol}</bdi>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className="text-[var(--h-muted)]" dir="ltr">
                  {utcDate(summary.startDate)} – {utcDate(summary.endDate)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3dcea0]/15 px-2 py-0.5 font-medium text-[#3dcea0]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3dcea0]" />
                  {summary.status === 'in-progress'
                    ? `${faNum(left)} روز باقی‌مانده`
                    : summary.status === 'failed'
                      ? 'ناموفق'
                      : 'تمام‌شده'}
                </span>
              </div>
              <Link
                href={`/backtest/${summary.id}`}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-[#2f6bff] px-4 text-[13px] font-semibold text-white"
              >
                رفتن به نمودار
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l12-7z" fill="currentColor" />
                </svg>
              </Link>
            </div>
            <div className="text-end">
              <p className="text-[12px] text-[var(--h-muted)]">موجودی حساب</p>
              <p className="mt-1 text-[28px] font-bold tabular-nums" dir="ltr">
                {money(summary.balance)}
              </p>
            </div>
          </div>
        </section>
        <DescriptionCard
          key={`${summary.id}:${detail?.description ?? ''}`}
          text={detail?.description ?? ''}
          ready={detail !== null}
          onSave={async (description) => {
            await saveFields(summary.id, { description });
            setLoaded((cur) =>
              cur && cur.id === summary.id
                ? { id: cur.id, detail: { ...cur.detail, description } }
                : cur,
            );
          }}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <ChartCard title="موجودی">
          <EquityChart
            points={detail?.equity ?? []}
            start={summary.startDate}
            end={summary.endDate}
          />
        </ChartCard>
        <ChartCard title="عملکرد ماهانه">
          <BarChart bars={monthBars(trades)} emptyLabel={monthName(summary.cursor)} />
        </ChartCard>
        <ChartCard title="عملکرد روزانه">
          <BarChart
            bars={dayBars(trades, summary.cursor)}
            emptyLabel={JALALI_WEEKDAYS[new Date(summary.cursor).getUTCDay()] ?? ''}
          />
        </ChartCard>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="سود و زیان کل" value={signedMoney(pnl)} hint="نسبت به موجودی شروع" />
        <Stat
          label="نرخ برد"
          value={detail ? (trades.length ? `${faNum(detail.winRate * 100, 0)}٪` : '۰٪') : '…'}
          hint="سهم معاملات سودده"
        />
        <Stat
          label="ریسک به ریوارد"
          value={detail ? (detail.avgRR === null ? '—' : faNum(detail.avgRR, 2)) : '…'}
          hint="میانگین نسبت برنامه‌ریزی‌شده"
        />
        <Stat label="سود و زیان ماه" value={signedMoney(monthPnl)} hint="معاملات ماه جاری بازپخش" />
        <Stat label="سود و زیان هفته" value={signedMoney(weekPnl)} hint="هفت روز بازار تا نشانگر" />
        <Stat label="سود و زیان روز" value={signedMoney(dayPnl)} hint="همان روز نشانگر بازپخش" />
      </div>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">معاملات اخیر</h3>
          <Link
            href={journalHref(summary.id)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--h-line)] px-3 text-[12px]"
          >
            <Icon name="journal" size={14} /> دفتر
          </Link>
        </div>
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="text-[12px] text-[var(--h-muted)]">
                <th className="px-4 py-3 text-start font-medium">نام</th>
                <th className="px-3 py-3 text-start font-medium">تاریخ</th>
                <th className="px-3 py-3 text-start font-medium">نماد</th>
                <th className="px-4 py-3 text-end font-medium">بازده</th>
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--h-muted)]">
                    {detail ? 'معاملهٔ بسته‌شده‌ای نیست.' : '…'}
                  </td>
                </tr>
              ) : (
                slice.map((t) => (
                  <tr key={t.id} className="border-t border-[var(--h-line)]">
                    <td className="px-4 py-3">{summary.name}</td>
                    <td className="px-3 py-3 text-[var(--h-muted)]">{tradeWhen(t.closeTime)}</td>
                    <td className="px-3 py-3" dir="ltr">
                      {summary.symbol}
                    </td>
                    <td className={`px-4 py-3 text-end font-medium tabular-nums ${tone(t.netPnl)}`}>
                      {signedMoney(t.netPnl)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--h-line)] px-4 py-2.5 text-[12px] text-[var(--h-muted)]">
            <label className="inline-flex items-center gap-2">
              ردیف در صفحه
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="h-7 rounded-full border border-[var(--h-line)] bg-transparent px-2 text-[var(--h-text)]"
              >
                {[5, 10, 20].map((n) => (
                  <option key={n} value={n}>
                    {faNum(n)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="صفحه قبل"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--h-line)] disabled:opacity-40"
              >
                <Icon name="chevronRight" size={14} />
              </button>
              <span>
                {faNum(safePage + 1)} از {faNum(pages)}
              </span>
              <button
                type="button"
                aria-label="صفحه بعد"
                disabled={safePage >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--h-line)] disabled:opacity-40"
              >
                <Icon name="chevronLeft" size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {settings && detail ? (
        <SettingsDialog
          key={summary.id}
          id={summary.id}
          name={detail.name}
          description={detail.description}
          strategyTag={detail.strategyTag}
          onClose={() => setSettings(false)}
          onSaved={() => {
            setSettings(false);
            onChanged();
            setRev((n) => n + 1);
          }}
        />
      ) : null}
      {deleting ? (
        <Dialog
          title="جلسه حذف شود؟"
          onClose={() => setDeleting(false)}
          width={420}
          footer={
            <>
              <div className="flex-1" />
              <Button onClick={() => setDeleting(false)}>انصراف</Button>
              <Button variant="danger" onClick={() => void remove()}>
                حذف
              </Button>
            </>
          }
        >
          <p className="p-5 text-[13px] leading-6">
            «{summary.name}» به همراه {faNum(summary.trades)} معامله پاک می‌شود. این کار برگشت‌پذیر
            نیست.
          </p>
        </Dialog>
      ) : null}
    </div>
  );
}

function DescriptionCard({
  text,
  ready,
  onSave,
}: {
  readonly text: string;
  readonly ready: boolean;
  readonly onSave: (text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  return (
    <section className={`${card} flex min-h-[180px] flex-col p-5`}>
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold">توضیح</h3>
        <button
          type="button"
          aria-label="ویرایش توضیح"
          disabled={!ready}
          onClick={() => setEditing(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--h-line)] text-[var(--h-muted)] hover:text-[var(--h-text)] disabled:opacity-40"
        >
          <Icon name="edit" size={14} />
        </button>
      </div>
      {editing ? (
        <form
          className="mt-3 flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void onSave(draft).then(() => setEditing(false));
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full flex-1 resize-none rounded-lg border border-[var(--h-line)] bg-[var(--h-field)] px-3 py-2 text-[13px] outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[12px] text-[var(--h-muted)]"
            >
              انصراف
            </button>
            <button type="submit" className="text-[12px] font-semibold text-[#8eb6ff]">
              ذخیره
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 flex-1 text-[13px] leading-7 text-[var(--h-muted)]">
          {text.trim() ? text : 'توضیحی نوشته نشده.'}
        </p>
      )}
    </section>
  );
}

function SettingsDialog({
  id,
  name,
  description,
  strategyTag,
  onClose,
  onSaved,
}: {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly strategyTag: string;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const [n, setN] = useState(name);
  const [d, setD] = useState(description);
  const [tag, setTag] = useState(strategyTag);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const next = n.trim();
    if (!next) return setError('نام جلسه را وارد کنید');
    if (next.length > 60) return setError('نام جلسه حداکثر ۶۰ نویسه است');
    setBusy(true);
    await saveFields(id, { name: next, description: d, strategyTag: tag.trim() });
    onSaved();
  };
  return (
    <Dialog
      title="تنظیمات جلسه"
      onClose={onClose}
      width={460}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>انصراف</Button>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            ذخیره
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        <Field label="نام" value={n} onChange={setN} />
        <Field label="استراتژی" value={tag} onChange={setTag} />
        <label className="block text-[13px]">
          <span className="text-[var(--h-muted)]">توضیح</span>
          <textarea
            value={d}
            onChange={(e) => setD(e.target.value)}
            rows={4}
            className="mt-1 w-full resize-none rounded-lg border border-[var(--h-line)] bg-[var(--h-field)] px-3 py-2 outline-none"
          />
        </label>
        {error ? <p className="text-[12px] text-[#ff6b81]">{error}</p> : null}
      </div>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
}) {
  return (
    <label className="block text-[13px]">
      <span className="text-[var(--h-muted)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-[var(--h-line)] bg-[var(--h-field)] px-3 outline-none"
      />
    </label>
  );
}

async function saveFields(
  id: string,
  patch: { name?: string; description?: string; strategyTag?: string },
  after?: () => void,
): Promise<void> {
  const repo = browserBacktestServices().repo;
  const fresh = await repo.load(id);
  if (!fresh) return;
  fresh.settings = { ...fresh.settings, ...patch };
  fresh.updatedAt = Date.now();
  await repo.save(fresh);
  after?.();
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <section className={`${card} relative px-4 py-3`}>
      <div className="flex items-center justify-between gap-2 text-[12px] text-[var(--h-muted)]">
        <span>{label}</span>
        <span title={hint}>
          <Icon name="info" size={13} />
        </span>
      </div>
      <p className="mt-2 text-[22px] font-bold tabular-nums">{value}</p>
    </section>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${card} p-4`}>
      <h3 className="text-[14px] font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EquityChart({
  points,
  start,
  end,
}: {
  readonly points: readonly Point[];
  readonly start: number;
  readonly end: number;
}) {
  const data = points.length > 0 ? points : [{ time: start, balance: 0 }];
  const balances = data.map((p) => p.balance);
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const span = max - min || 1;
  const w = 320;
  const h = 140;
  const pad = 8;
  const coords = data.map((p, i) => {
    const x = data.length === 1 ? w / 2 : pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (p.balance - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  const ticks = [max, (max + min) / 2, min];
  return (
    <svg
      viewBox={`0 0 ${w} ${h + 22}`}
      className="h-40 w-full text-[var(--h-muted)]"
      aria-hidden="true"
    >
      {ticks.map((t, i) => {
        const y = pad + (i / 2) * (h - pad * 2);
        return (
          <g key={t}>
            <line
              x1="36"
              x2={w}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeDasharray="4 6"
            />
            <text x="0" y={y + 4} fill="currentColor" fontSize="11">
              {compactAxis(t)}
            </text>
          </g>
        );
      })}
      <polyline fill="none" stroke="#8eb6ff" strokeWidth="1.6" points={coords.join(' ')} />
      {data.length === 1 ? (
        <circle cx={w / 2} cy={pad + (h - pad * 2) / 2} r="3" fill="#8eb6ff" />
      ) : null}
      <text x="40" y={h + 16} fill="currentColor" fontSize="11">
        {shortDay(start)}
      </text>
      <text x={w - 36} y={h + 16} fill="currentColor" fontSize="11" textAnchor="end">
        {shortDay(end)}
      </text>
    </svg>
  );
}

function BarChart({
  bars,
  emptyLabel,
}: {
  readonly bars: readonly { label: string; value: number }[];
  readonly emptyLabel: string;
}) {
  const shown = bars.length > 0 ? bars : [{ label: emptyLabel, value: 0 }];
  const peak = Math.max(1, ...shown.map((b) => Math.abs(b.value)));
  return (
    <svg viewBox="0 0 320 150" className="h-40 w-full text-[var(--h-muted)]" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 12 + i * 24;
        return (
          <g key={i}>
            <line
              x1="28"
              x2="310"
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.22"
              strokeDasharray="4 6"
            />
            <text x="0" y={y + 3} fill="currentColor" fontSize="10">
              {faNum(+(peak * (1 - i / 4)).toFixed(1))}
            </text>
          </g>
        );
      })}
      {shown.map((b, i) => {
        const slot = 280 / shown.length;
        const bh = Math.max(2, (Math.abs(b.value) / peak) * 90);
        const x = 36 + i * slot + slot / 2 - 8;
        return (
          <g key={`${b.label}-${i}`}>
            <rect x={x} y={108 - bh} width="16" height={bh} rx="3" fill="#3b82f6" />
            <text x={x + 8} y="132" textAnchor="middle" fill="currentColor" fontSize="10">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function monthBars(trades: readonly TradeRow[]): { label: string; value: number }[] {
  const map = new Map<string, { label: string; value: number }>();
  for (const t of trades) {
    const j = utcToJalali(t.closeTime);
    const key = `${j.jy}-${j.jm}`;
    const prev = map.get(key);
    map.set(key, {
      label: JALALI_MONTHS[j.jm - 1] ?? '',
      value: (prev?.value ?? 0) + t.netPnl,
    });
  }
  return [...map.values()];
}

function dayBars(trades: readonly TradeRow[], cursor: number): { label: string; value: number }[] {
  const map = new Map<number, number>();
  for (const t of trades) {
    const day = new Date(t.closeTime).getUTCDay();
    map.set(day, (map.get(day) ?? 0) + t.netPnl);
  }
  if (map.size === 0) {
    const day = new Date(cursor).getUTCDay();
    return [{ label: JALALI_WEEKDAYS[day] ?? '', value: 0 }];
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, value]) => ({ label: JALALI_WEEKDAYS[day] ?? '', value }));
}

function sumWhere(trades: readonly TradeRow[], pred: (t: TradeRow) => boolean): number {
  return trades.reduce((n, t) => (pred(t) ? n + t.netPnl : n), 0);
}

function sameUtcDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

function sameMonth(time: number, cursor: number): boolean {
  const a = utcToJalali(time);
  const b = utcToJalali(cursor);
  return a.jy === b.jy && a.jm === b.jm;
}

function monthName(time: number): string {
  const j = utcToJalali(time);
  return JALALI_MONTHS[j.jm - 1] ?? '';
}

function shortDay(time: number): string {
  const j = utcToJalali(time);
  return `${faNum(j.jd)} ${JALALI_MONTHS[j.jm - 1] ?? ''}`;
}

function tradeWhen(t: number): string {
  const j = utcToJalali(t);
  const d = new Date(t);
  const p = (n: number) => faDigits(String(n).padStart(2, '0'));
  return `${faDigits(j.jy)}/${p(j.jm)}/${p(j.jd)}، ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function compactAxis(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return faNum(Math.round(v / 1000)) + 'ه';
  return faNum(Math.round(v));
}

function tone(v: number): string {
  if (v > 0.004) return 'text-[#3dcea0]';
  if (v < -0.004) return 'text-[#ff6b81]';
  return 'text-[var(--h-text)]';
}
