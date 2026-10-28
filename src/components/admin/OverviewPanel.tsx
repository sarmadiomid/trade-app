'use client';

import Link from 'next/link';
import { PLAN_LABEL, type PlanId } from '@/lib/app';
import { faNum, formatJalaliDateTime } from '@/lib/locale/jalali';
import { subjectById } from '@/lib/support/catalog';
import { PageHead, Panel, useAdminQuery } from './ui';

interface Overview {
  readonly userCount: number;
  readonly openTickets: number;
  readonly liveBattles: number;
  readonly sessionCount: number;
  readonly symbolCount: number;
  readonly discounts: number;
  readonly redemptions: number;
  readonly plans: Record<PlanId, number>;
  readonly recentUsers: ReadonlyArray<{
    id: string;
    name: string;
    phone: string;
    plan: PlanId;
    createdAt: number;
  }>;
  readonly waiting: ReadonlyArray<{
    id: string;
    number: number;
    title: string;
    subject: string;
    userName: string;
    updatedAt: number;
  }>;
}

const CARDS = [
  { key: 'userCount', label: 'کاربران', href: '/admin/users' },
  { key: 'openTickets', label: 'درخواست باز', href: '/admin/support' },
  { key: 'symbolCount', label: 'نماد سفارشی', href: '/admin/symbols' },
  { key: 'sessionCount', label: 'جلسه تمرین', href: '/admin/sessions' },
  { key: 'liveBattles', label: 'نبرد فعال', href: '/admin/battles' },
  { key: 'discounts', label: 'کد تخفیف فعال', href: '/admin/discounts' },
] as const;

export function OverviewPanel() {
  const { data, error, loading } = useAdminQuery<Overview>('/api/admin/overview');
  return (
    <div>
      <PageHead
        kicker="عملیات"
        title="نمای کلی کندلو"
        text="کاربران، پشتیبانی، نمادها، تمرین، نبرد و تخفیف از همین‌جا اداره می‌شوند. نماد تازه بعد از دادهٔ یک‌دقیقه‌ای در تمرین دیده می‌شود."
      />
      {error ? <p className="mb-4 text-[13px] text-[#ffb3bf]">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => (
          <Link key={card.key} href={card.href}>
            <Panel className="p-4 transition hover:border-[#3b78ff]/50">
              <p className="text-[12.5px] text-[var(--a-muted)]">{card.label}</p>
              <p className="mt-2 text-[28px] font-bold tabular-nums">
                {loading || !data ? '—' : faNum(data[card.key])}
              </p>
            </Panel>
          </Link>
        ))}
      </div>
      {data ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel className="p-4">
            <h3 className="text-[14px] font-semibold">طرح‌ها</h3>
            <ul className="mt-3 space-y-2">
              {(Object.keys(data.plans) as PlanId[]).map((plan) => (
                <li key={plan} className="flex items-center justify-between text-[13.5px]">
                  <span>{PLAN_LABEL[plan]}</span>
                  <span className="tabular-nums text-[var(--a-muted)]">
                    {faNum(data.plans[plan])}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-[var(--a-line)] pt-2 text-[13.5px]">
                <span>استفاده از کد تخفیف</span>
                <span className="tabular-nums text-[var(--a-muted)]">
                  {faNum(data.redemptions)}
                </span>
              </li>
            </ul>
          </Panel>
          <Panel className="p-4">
            <h3 className="text-[14px] font-semibold">در انتظار پاسخ</h3>
            <ul className="mt-3 divide-y divide-[var(--a-line)]">
              {data.waiting.length === 0 ? (
                <li className="py-3 text-[13px] text-[var(--a-muted)]">درخواست بازی نمانده.</li>
              ) : (
                data.waiting.map((ticket) => (
                  <li key={ticket.id}>
                    <Link href={`/admin/support?id=${ticket.id}`} className="block py-2.5">
                      <span className="text-[13.5px] font-medium">
                        #{faNum(ticket.number)} {ticket.title || subjectById(ticket.subject)?.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-[var(--a-muted)]">
                        {ticket.userName} · {formatJalaliDateTime(ticket.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </Panel>
          <Panel className="p-4 lg:col-span-2">
            <h3 className="text-[14px] font-semibold">عضویت‌های تازه</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-right text-[13px]">
                <tbody>
                  {data.recentUsers.map((user) => (
                    <tr key={user.id} className="border-t border-[var(--a-line)]">
                      <td className="py-2.5 font-medium">{user.name}</td>
                      <td dir="ltr" className="py-2.5 text-end font-mono text-[var(--a-muted)]">
                        {user.phone}
                      </td>
                      <td className="py-2.5 text-[var(--a-muted)]">{PLAN_LABEL[user.plan]}</td>
                      <td className="py-2.5 text-[var(--a-muted)]">
                        {formatJalaliDateTime(user.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
