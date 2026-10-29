'use client';

import { useState } from 'react';
import { JalaliDateField } from '@/components/backtest/JalaliField';
import { faNum, formatJalaliDateTime } from '@/lib/locale/jalali';
import { ApiError, api } from '@/components/platform/api';
import { Notice, PageHead, Panel, fieldClass, labelClass, useAdminQuery } from './ui';

const expiryField =
  'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0c1018] px-3 text-[13.5px] text-[var(--a-text)] outline-none transition hover:border-white/20 focus:border-[#3b78ff] focus:ring-4 focus:ring-[#3b78ff]/15';

interface DiscountRow {
  readonly code: string;
  readonly kind: 'percent' | 'fixed';
  readonly value: number;
  readonly plans: readonly string[];
  readonly cycles: readonly string[];
  readonly active: boolean;
  readonly expiresAt: number | null;
  readonly maxUses: number | null;
  readonly perUser: number | null;
  readonly used: number;
  readonly label: string;
}

const EMPTY = {
  code: '',
  kind: 'percent' as 'percent' | 'fixed',
  value: '10',
  label: '',
  plans: '' as '' | 'mid' | 'pro',
  cycles: '' as '' | 'month' | 'year',
  maxUses: '',
  perUser: '',
  expiresAt: '',
};

export function DiscountsDesk() {
  const { data, error, loading, reload } = useAdminQuery<{ discounts: DiscountRow[] }>(
    '/api/admin/discounts',
  );
  const [form, setForm] = useState(EMPTY);
  const [notice, setNotice] = useState('');
  const [bad, setBad] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setBad('');
    setNotice('');
    try {
      await api('/api/admin/discounts', {
        method: 'POST',
        body: {
          code: form.code,
          kind: form.kind,
          value: Number(form.value),
          label: form.label,
          plans: form.plans ? [form.plans] : [],
          cycles: form.cycles ? [form.cycles] : [],
          maxUses: form.maxUses === '' ? null : Number(form.maxUses),
          perUser: form.perUser === '' ? null : Number(form.perUser),
          expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
          active: true,
        },
      });
      setForm(EMPTY);
      setNotice('کد تخفیف ذخیره شد.');
      await reload();
    } catch (e) {
      setBad(e instanceof ApiError ? e.message : 'ذخیره انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row: DiscountRow) => {
    setBad('');
    try {
      await api(`/api/admin/discounts/${encodeURIComponent(row.code)}`, {
        method: 'POST',
        body: { active: !row.active },
      });
      await reload();
    } catch (e) {
      setBad(e instanceof ApiError ? e.message : 'تغییر وضعیت انجام نشد');
    }
  };

  return (
    <div>
      <PageHead
        kicker="پرداخت"
        title="کدهای تخفیف"
        text="درصد یا مبلغ ثابت، با سقف استفاده و محدودیت هر کاربر. کدهای محیط سرور اگر هم‌نام باشند، هنگام پرداخت روی این رکورد نوشته می‌شوند."
      />
      {bad ? (
        <div className="mb-3">
          <Notice tone="bad">{bad}</Notice>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-3">
          <Notice tone="ok">{notice}</Notice>
        </div>
      ) : null}
      {error ? <p className="mb-3 text-[13px] text-[#ffb3bf]">{error}</p> : null}
      <Panel className="mb-4 p-5">
        <h3 className="text-[15px] font-semibold">کد جدید</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className={labelClass}>کد</span>
            <input
              dir="ltr"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className={fieldClass}
              placeholder="WELCOME20"
            />
          </label>
          <label>
            <span className={labelClass}>نوع</span>
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as 'percent' | 'fixed' })}
              className={fieldClass}
            >
              <option value="percent">درصد</option>
              <option value="fixed">مبلغ ثابت (تومان)</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>مقدار</span>
            <input
              dir="ltr"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label>
            <span className={labelClass}>برچسب</span>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label>
            <span className={labelClass}>طرح</span>
            <select
              value={form.plans}
              onChange={(e) => setForm({ ...form, plans: e.target.value as typeof form.plans })}
              className={fieldClass}
            >
              <option value="">هر دو طرح پولی</option>
              <option value="mid">متوسط</option>
              <option value="pro">حرفه‌ای</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>دوره</span>
            <select
              value={form.cycles}
              onChange={(e) => setForm({ ...form, cycles: e.target.value as typeof form.cycles })}
              className={fieldClass}
            >
              <option value="">ماهانه و سالانه</option>
              <option value="month">ماهانه</option>
              <option value="year">سالانه</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>سقف استفاده</span>
            <input
              dir="ltr"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
              placeholder="نامحدود"
              className={fieldClass}
            />
          </label>
          <label>
            <span className={labelClass}>سقف هر کاربر</span>
            <input
              dir="ltr"
              value={form.perUser}
              onChange={(e) => setForm({ ...form, perUser: e.target.value })}
              placeholder="نامحدود"
              className={fieldClass}
            />
          </label>
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-[12px] font-medium text-[var(--a-muted)]">انقضا</span>
              {form.expiresAt ? (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, expiresAt: '' })}
                  className="text-[12px] text-[var(--a-muted)] transition hover:text-white"
                >
                  بدون انقضا
                </button>
              ) : null}
            </div>
            <JalaliDateField
              ariaLabel="تاریخ انقضا"
              className={expiryField}
              value={form.expiresAt}
              placeholder="بدون انقضا"
              onChange={(expiresAt) => setForm({ ...form, expiresAt })}
            />
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="mt-4 h-11 rounded-xl bg-[var(--a-accent)] px-4 text-[13.5px] font-semibold text-white disabled:opacity-50"
        >
          ذخیره کد
        </button>
      </Panel>
      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-right text-[13px]">
          <thead className="text-[12px] text-[var(--a-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">کد</th>
              <th className="px-4 py-3 font-medium">تخفیف</th>
              <th className="px-4 py-3 font-medium">مصرف</th>
              <th className="px-4 py-3 font-medium">انقضا</th>
              <th className="px-4 py-3 font-medium">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-[var(--a-muted)]">
                  در حال خواندن…
                </td>
              </tr>
            ) : null}
            {data?.discounts.map((row) => (
              <tr key={row.code} className="border-t border-[var(--a-line)]">
                <td className="px-4 py-3">
                  <div dir="ltr" className="text-end font-mono font-semibold">
                    {row.code}
                  </div>
                  <div className="text-[12px] text-[var(--a-muted)]">{row.label}</div>
                </td>
                <td className="px-4 py-3">
                  {row.kind === 'percent' ? `${faNum(row.value)}٪` : `${faNum(row.value)} تومان`}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {faNum(row.used)}
                  {row.maxUses !== null ? ` / ${faNum(row.maxUses)}` : ''}
                </td>
                <td className="px-4 py-3 text-[var(--a-muted)]">
                  {row.expiresAt ? formatJalaliDateTime(row.expiresAt, false) : 'ندارد'}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void toggle(row)}
                    className="text-[13px] text-[var(--a-gold)]"
                  >
                    {row.active ? 'فعال' : 'خاموش'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
