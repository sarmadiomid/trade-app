'use client';

import { useState } from 'react';
import { faNum, formatJalaliDateTime } from '@/lib/locale/jalali';
import { api } from '../platform/api';
import { PageHead, Panel, useAdminQuery } from './ui';

interface BattleRow {
  readonly code: string;
  readonly symbol: string;
  readonly status: string;
  readonly mode: string;
  readonly createdAt: number;
  readonly traders: number;
  readonly bots: number;
  readonly origin: string | null;
}

interface BotConfigView {
  readonly enabled: boolean;
  readonly level: number;
  readonly phaseOutHumans: number;
  readonly world: boolean;
  readonly fill: boolean;
  readonly duel: boolean;
}

interface BotStatusView {
  readonly config: BotConfigView;
  readonly humans: number;
  readonly presence: number;
  readonly activity: number;
  readonly worldBattles: number;
  readonly botSeats: number;
  readonly mixedBattles: number;
}

const ORIGIN: Record<string, string> = { world: 'ربات', fill: 'کاربر + ربات', duel: 'دوئل' };

/** Bot presence: on/off, level, phase-out point and which kinds of bot activity run. */
function BotsPanel() {
  const { data, error, reload } = useAdminQuery<BotStatusView>('/api/admin/bots');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const save = async (patch: Partial<BotConfigView>) => {
    setBusy(true);
    setSaveError('');
    try {
      await api('/api/admin/bots', { method: 'PATCH', body: patch });
      reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'ذخیره نشد');
    } finally {
      setBusy(false);
    }
  };
  const c = data?.config;
  const toggle = (key: 'enabled' | 'world' | 'fill' | 'duel', label: string) => (
    <label className="inline-flex items-center gap-2 text-[13px]">
      <input
        type="checkbox"
        checked={Boolean(c?.[key])}
        disabled={!c || busy}
        onChange={(e) => void save({ [key]: e.target.checked })}
      />
      {label}
    </label>
  );
  return (
    <Panel className="mb-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold">حضور ربات‌ها</h2>
        {data ? (
          <p className="text-[12px] text-[var(--a-muted)]">
            کاربر واقعی فعال: {faNum(data.humans)} · حضور فعلی:{' '}
            {faNum(Math.round(data.presence * 100))}٪ · نبرد رباتی باز: {faNum(data.worldBattles)} ·
            صندلی ربات: {faNum(data.botSeats)} · نبرد با کاربر: {faNum(data.mixedBattles)}
          </p>
        ) : null}
      </div>
      {error || saveError ? (
        <p className="mt-2 text-[12px] text-[#ffb3bf]">{error || saveError}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        {toggle('enabled', 'فعال')}
        {toggle('world', 'نبردهای عمومی ربات')}
        {toggle('fill', 'پرکردن لابی کاربران')}
        {toggle('duel', 'دوئل آزاد بعد از صف رتبه‌ای')}
        <label className="inline-flex items-center gap-2 text-[13px]">
          سطح
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            defaultValue={Math.round((c?.level ?? 1) * 100)}
            key={`level-${c?.level}`}
            disabled={!c || busy}
            onMouseUp={(e) => void save({ level: Number(e.currentTarget.value) / 100 })}
            onKeyUp={(e) => void save({ level: Number(e.currentTarget.value) / 100 })}
          />
          <span className="tabular-nums">{faNum(Math.round((c?.level ?? 0) * 100))}٪</span>
        </label>
        <label className="inline-flex items-center gap-2 text-[13px]">
          حذف کامل در
          <input
            type="number"
            min={1}
            defaultValue={c?.phaseOutHumans ?? 40}
            key={`po-${c?.phaseOutHumans}`}
            disabled={!c || busy}
            onBlur={(e) => void save({ phaseOutHumans: Number(e.currentTarget.value) })}
            className="h-8 w-20 rounded-md border border-[var(--a-line)] bg-transparent px-2 tabular-nums"
          />
          کاربر هم‌زمان
        </label>
      </div>
    </Panel>
  );
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
      <BotsPanel />
      {error ? <p className="mb-3 text-[13px] text-[#ffb3bf]">{error}</p> : null}
      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-right text-[13px]">
          <thead className="text-[12px] text-[var(--a-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">کد</th>
              <th className="px-4 py-3 font-medium">نماد</th>
              <th className="px-4 py-3 font-medium">حالت</th>
              <th className="px-4 py-3 font-medium">وضعیت</th>
              <th className="px-4 py-3 font-medium">کاربر</th>
              <th className="px-4 py-3 font-medium">ربات</th>
              <th className="px-4 py-3 font-medium">زمان</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-[var(--a-muted)]">
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
                <td className="px-4 py-3">
                  {row.mode === 'ranked' ? 'رتبه‌ای' : 'آزاد'}
                  {row.origin ? (
                    <span className="ms-1 text-[11px] text-[var(--a-muted)]">
                      ({ORIGIN[row.origin] ?? row.origin})
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{BATTLE_STATUS[row.status] ?? row.status}</td>
                <td className="px-4 py-3 tabular-nums">{faNum(row.traders)}</td>
                <td className="px-4 py-3 tabular-nums">{faNum(row.bots)}</td>
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
