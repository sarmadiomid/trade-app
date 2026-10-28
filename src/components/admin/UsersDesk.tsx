'use client';

import { useState } from 'react';
import { PLAN_LABEL, type PlanId } from '@/lib/app';
import { faNum, formatJalaliDateTime } from '@/lib/locale/jalali';
import { ApiError, api } from '@/components/platform/api';
import { Notice, PageHead, Panel, fieldClass, useAdminQuery } from './ui';

interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly plan: PlanId;
  readonly createdAt: number;
  readonly lastLoginAt: number;
  readonly sessions: number;
  readonly battles: number;
}

const PLANS: PlanId[] = ['beginner', 'mid', 'pro'];

export function UsersDesk() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, loading, reload } = useAdminQuery<{ users: UserRow[] }>(
    `/api/admin/users?q=${encodeURIComponent(query)}`,
  );
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const changePlan = async (user: UserRow, plan: PlanId) => {
    setBusy(user.id);
    setNotice('');
    try {
      await api(`/api/admin/users/${user.id}/plan`, { method: 'POST', body: { plan } });
      setNotice(`طرح ${user.name || user.phone} به ${PLAN_LABEL[plan]} تغییر کرد.`);
      await reload();
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : 'تغییر طرح انجام نشد');
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <PageHead
        kicker="حساب‌ها"
        title="کاربران"
        text="جستجو با شماره یا نام، و تغییر طرح اشتراک. سقف جلسه و نبرد از روی طرح تازه محاسبه می‌شود."
      />
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="شماره یا نام"
          className={fieldClass}
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-xl bg-[var(--a-accent)] px-4 text-[13.5px] font-semibold text-white"
        >
          جستجو
        </button>
      </form>
      {notice ? (
        <div className="mb-3">
          <Notice tone={notice.includes('انجام نشد') || notice.includes('ندارید') ? 'bad' : 'ok'}>
            {notice}
          </Notice>
        </div>
      ) : null}
      {error ? <p className="mb-3 text-[13px] text-[#ffb3bf]">{error}</p> : null}
      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-right text-[13px]">
          <thead className="text-[12px] text-[var(--a-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">کاربر</th>
              <th className="px-4 py-3 font-medium">طرح</th>
              <th className="px-4 py-3 font-medium">تمرین</th>
              <th className="px-4 py-3 font-medium">نبرد</th>
              <th className="px-4 py-3 font-medium">آخرین ورود</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-[var(--a-muted)]">
                  در حال خواندن…
                </td>
              </tr>
            ) : data?.users.length ? (
              data.users.map((user) => (
                <tr key={user.id} className="border-t border-[var(--a-line)]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.name || 'بدون نام'}</div>
                    <div dir="ltr" className="text-end font-mono text-[12px] text-[var(--a-muted)]">
                      {user.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.plan}
                      disabled={busy === user.id}
                      onChange={(e) => void changePlan(user, e.target.value as PlanId)}
                      className="h-9 rounded-lg border border-white/10 bg-[#0c1018] px-2"
                    >
                      {PLANS.map((plan) => (
                        <option key={plan} value={plan}>
                          {PLAN_LABEL[plan]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{faNum(user.sessions)}</td>
                  <td className="px-4 py-3 tabular-nums">{faNum(user.battles)}</td>
                  <td className="px-4 py-3 text-[var(--a-muted)]">
                    {formatJalaliDateTime(user.lastLoginAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-[var(--a-muted)]">
                  کاربری پیدا نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
