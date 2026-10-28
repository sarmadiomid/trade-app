'use client';

import { faNum, formatJalaliDateTime } from '@/lib/locale/jalali';
import { PageHead, Panel, useAdminQuery } from './ui';

interface BattleRow {
  readonly code: string;
  readonly symbol: string;
  readonly status: string;
  readonly mode: string;
  readonly createdAt: number;
  readonly traders: number;
}

interface SessionRow {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly updatedAt: number;
  readonly phone: string;
  readonly userName: string;
}

const BATTLE_STATUS: Record<string, string> = {
  standby: 'آماده',
  countdown: 'شمارش',
  live: 'زنده',
  paused: 'مکث',
  completed: 'تمام',
  cancelled: 'لغو',
};

export function BattlesDesk() {
  const { data, error, loading } = useAdminQuery<{ battles: BattleRow[] }>('/api/admin/battles');
  return (
    <div>
      <PageHead
        kicker="رقابت"
        title="نبردها"
        text="اتاق‌های اخیر، نماد، وضعیت و تعداد معامله‌گر. ساخت نبرد همچنان از خود پلتفرم انجام می‌شود."
      />
      {error ? <p className="mb-3 text-[13px] text-[#ffb3bf]">{error}</p> : null}
      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-right text-[13px]">
          <thead className="text-[12px] text-[var(--a-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">کد</th>
              <th className="px-4 py-3 font-medium">نماد</th>
              <th className="px-4 py-3 font-medium">حالت</th>
              <th className="px-4 py-3 font-medium">وضعیت</th>
              <th className="px-4 py-3 font-medium">نفرات</th>
              <th className="px-4 py-3 font-medium">زمان</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-[var(--a-muted)]">
                  در حال خواندن…
                </td>
              </tr>
            ) : null}
            {data?.battles.map((row) => (
              <tr key={row.code} className="border-t border-[var(--a-line)]">
                <td dir="ltr" className="px-4 py-3 text-end font-mono">
                  {row.code}
                </td>
                <td className="px-4 py-3">
                  <bdi>{row.symbol}</bdi>
                </td>
                <td className="px-4 py-3">{row.mode === 'ranked' ? 'رتبه‌ای' : 'آزاد'}</td>
                <td className="px-4 py-3">{BATTLE_STATUS[row.status] ?? row.status}</td>
                <td className="px-4 py-3 tabular-nums">{faNum(row.traders)}</td>
                <td className="px-4 py-3 text-[var(--a-muted)]">
                  {formatJalaliDateTime(row.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

export function SessionsDesk() {
  const { data, error, loading } = useAdminQuery<{ sessions: SessionRow[] }>('/api/admin/sessions');
  return (
    <div>
      <PageHead
        kicker="تمرین"
        title="جلسه‌های بک‌تست"
        text="آخرین جلسه‌هایی که کاربران ساخته‌اند. حذف جلسه از حساب خود کاربر انجام می‌شود."
      />
      {error ? <p className="mb-3 text-[13px] text-[#ffb3bf]">{error}</p> : null}
      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-right text-[13px]">
          <thead className="text-[12px] text-[var(--a-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">جلسه</th>
              <th className="px-4 py-3 font-medium">نماد</th>
              <th className="px-4 py-3 font-medium">کاربر</th>
              <th className="px-4 py-3 font-medium">به‌روزرسانی</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-[var(--a-muted)]">
                  در حال خواندن…
                </td>
              </tr>
            ) : null}
            {data?.sessions.map((row) => (
              <tr key={row.id} className="border-t border-[var(--a-line)]">
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3">
                  <bdi>{row.symbol}</bdi>
                </td>
                <td className="px-4 py-3">
                  <div>{row.userName}</div>
                  <div dir="ltr" className="text-end font-mono text-[12px] text-[var(--a-muted)]">
                    {row.phone}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--a-muted)]">
                  {formatJalaliDateTime(row.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
