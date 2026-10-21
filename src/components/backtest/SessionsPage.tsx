'use client';

import Link from 'next/link';
import { AppHeader } from '../platform/AppHeader';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { browserBacktestServices } from '@/lib/app';
import type { SessionSettings, SessionSummary } from '@/lib/backtest';
import { useThemeCssVars } from '../hooks/useThemeCssVars';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { CreateSessionDialog } from './CreateSessionDialog';
import { faNum, money, pnlClass, signedMoney, utcDate, utcDateTime } from './format';

const STATUS = {
  'in-progress': ['در جریان', 'bg-accent/15 text-accent'],
  completed: ['تمام‌شده', 'bg-up/15 text-up'],
  failed: ['ناموفق', 'bg-down/15 text-down'],
} as const;

/** `/backtest`: every session as a card, and "New session". */
export default function SessionsPage() {
  const services = browserBacktestServices();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [creating, setCreating] = useState<{ initial?: SessionSettings } | null>(null);
  const [deleting, setDeleting] = useState<SessionSummary | null>(null);
  useThemeCssVars();

  const refresh = useCallback(() => {
    void services.repo.list().then(setSessions);
  }, [services]);
  useEffect(refresh, [refresh]);

  const duplicate = async (id: string) => {
    const s = await services.repo.load(id);
    if (s) setCreating({ initial: s.settings });
  };

  return (
    <div className="h-full overflow-y-auto bg-chart text-fg">
      <AppHeader fa />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold">بک‌تست</h1>
          <p className="text-[13px] leading-6 text-muted">
            بازار را کندل‌به‌کندل بازپخش کنید و با حساب مجازی معامله کنید
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating({})} data-testid="new-session">
          <Icon name="plus" size={16} /> جلسه جدید
        </Button>
      </div>
      <main className="mx-auto max-w-6xl p-5">
        {sessions === null ? (
          <div className="flex h-60 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <Icon name="replay" size={36} />
            <h1 className="text-lg font-semibold">هنوز جلسه‌ای نساخته‌اید</h1>
            <p className="max-w-md text-[13px] leading-6 text-muted">
              هر جلسه یک بازه از بازار را با حساب مجازی بازپخش می‌کند. نماد، موجودی شروع و تاریخ را
              انتخاب کنید.
            </p>
            <Button variant="primary" onClick={() => setCreating({})}>
              <Icon name="plus" size={16} /> ساخت اولین جلسه
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => {
              const pnl = s.balance - s.startingBalance;
              const progress = Math.max(
                0,
                Math.min(1, (s.cursor - s.startDate) / (s.endDate + 86_400_000 - s.startDate)),
              );
              const [label, cls] = STATUS[s.status];
              return (
                <article
                  key={s.id}
                  className="flex flex-col rounded-xl border border-line bg-panel p-4"
                  data-testid="session-card"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-[15px] font-semibold" title={s.name}>
                        {s.name}
                      </h2>
                      <p className="text-[12px] text-muted">
                        <bdi dir="ltr">{s.symbol}</bdi>
                        {' · '}
                        {s.type === 'prop' ? 'جلسه پراپ' : 'بک‌تست'}
                        {s.strategyTag ? ` · ${s.strategyTag}` : ''}
                      </p>
                    </div>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
                      {label}
                    </span>
                  </div>
                  <p className="mt-3 text-[12px] leading-6 text-muted">
                    {utcDate(s.startDate)} تا {utcDate(s.endDate)}
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[11.5px] leading-5 text-muted">
                    بازپخش در {utcDateTime(s.cursor)}
                    <span className="text-[11px]"> · ساعت جهانی</span>
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                    <div>
                      <dt className="text-muted">موجودی</dt>
                      <dd className="font-semibold tabular-nums">{money(s.balance)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">سود و زیان</dt>
                      <dd className={`font-semibold tabular-nums ${pnlClass(pnl)}`}>
                        {signedMoney(pnl)} ({faNum((pnl / s.startingBalance) * 100, 2)}٪)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">معاملات</dt>
                      <dd className="font-semibold tabular-nums">{faNum(s.trades)}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Link
                      href={`/backtest/${s.id}`}
                      className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg hover:brightness-110"
                      data-testid="open-session"
                    >
                      {s.status === 'in-progress' ? 'ادامه' : 'باز کردن'}
                    </Link>
                    <Link
                      href={`/backtest/${s.id}/analytics`}
                      className="inline-flex h-8 items-center rounded-md border border-line px-3 text-[13px] hover:bg-hover"
                    >
                      عملکرد
                    </Link>
                    <Link
                      href={`/backtest/${s.id}/journal`}
                      className="inline-flex h-8 items-center rounded-md border border-line px-3 text-[13px] hover:bg-hover"
                    >
                      دفتر
                    </Link>
                    <div className="flex-1" />
                    <button
                      type="button"
                      title="کپی جلسه"
                      aria-label={`کپی ${s.name}`}
                      onClick={() => void duplicate(s.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
                    >
                      <Icon name="clone" size={16} />
                    </button>
                    <button
                      type="button"
                      title="حذف"
                      aria-label={`حذف ${s.name}`}
                      onClick={() => setDeleting(s)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-down"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      {creating ? (
        <CreateSessionDialog
          services={services}
          initial={creating.initial}
          onClose={() => setCreating(null)}
          onCreated={(id) => router.push(`/backtest/${id}`)}
        />
      ) : null}
      {deleting ? (
        <Dialog
          title="جلسه حذف شود؟"
          onClose={() => setDeleting(null)}
          width={420}
          footer={
            <>
              <div className="flex-1" />
              <Button onClick={() => setDeleting(null)}>انصراف</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const id = deleting.id;
                  setDeleting(null);
                  void services.repo.remove(id).then(refresh);
                }}
              >
                حذف
              </Button>
            </>
          }
        >
          <p className="p-5 text-[13px] leading-6">
            «{deleting.name}» به همراه {faNum(deleting.trades)} معامله، یادداشت‌ها و تصویرها پاک
            می‌شود. این کار برگشت‌پذیر نیست.
          </p>
        </Dialog>
      ) : null}
    </div>
  );
}
