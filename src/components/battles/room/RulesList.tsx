'use client';

import { type ReactNode } from 'react';
import { faNum } from '@/lib/locale/jalali';
import type { BattleView } from '@/lib/battles';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/icons';
import { ASSET_COLORS, WIN_FA, compactMoney, minutes } from '../format';

const GROUPS: ReadonlyArray<{ title: string; icon: IconName; keys: readonly string[] }> = [
  {
    title: 'نبرد',
    icon: 'swords',
    keys: [
      'حالت',
      'نوع نبرد',
      'شرط برد',
      'بازار',
      'میزبان',
      'معامله‌گرها',
      'ورود دیرهنگام',
      'نمایش',
      'شناسه',
    ],
  },
  {
    title: 'زمان و حساب',
    icon: 'clock',
    keys: ['موجودی اولیه', 'مدت', 'سرعت بازپخش', 'هدف سود'],
  },
  {
    title: 'سقف ریسک',
    icon: 'shield',
    keys: ['حداکثر افت', 'حداکثر افت روزانه'],
  },
];

/** Every rule of a battle, as shown before joining and in the battle's sidebar. */
export function RulesList({
  view,
  variant = 'plain',
}: {
  readonly view: BattleView;
  readonly variant?: 'plain' | 'cards';
}) {
  const s = view.settings;
  const rows: Array<[string, ReactNode]> = [
    ['حالت', view.mode === 'ranked' ? 'رتبه‌ای (الو عوض می‌شود)' : 'آزاد (بدون الو)'],
    ['نوع نبرد', WIN_FA[s.winCondition].name],
    ['شرط برد', WIN_FA[s.winCondition].short],
    [
      'بازار',
      view.symbol ? (
        <bdi dir="ltr" className="font-semibold">
          {view.symbol}
        </bdi>
      ) : (
        <span className="flex flex-wrap justify-end gap-1">
          {s.assets.map((a) => (
            <bdi
              key={a}
              dir="ltr"
              className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
              style={{
                background: `${ASSET_COLORS[a] ?? '#5b8cff'}22`,
                color: ASSET_COLORS[a] ?? '#5b8cff',
              }}
            >
              {a}
            </bdi>
          ))}
        </span>
      ),
    ],
    ['موجودی اولیه', compactMoney(s.startingBalance)],
    ['مدت', minutes(s.durationMin)],
    ['سرعت بازپخش', `${faNum(s.speed)}× (هر کندل یک‌دقیقه‌ای، ${faNum(60 / s.speed)} ثانیه)`],
    ['هدف سود', s.profitTargetPct === null ? 'تعیین نشده' : `${faNum(s.profitTargetPct)}٪`],
    ['حداکثر افت', s.maxDrawdownPct === null ? 'تعیین نشده' : `${faNum(s.maxDrawdownPct)}٪`],
    [
      'حداکثر افت روزانه',
      s.maxDailyDrawdownPct === null ? 'تعیین نشده' : `${faNum(s.maxDailyDrawdownPct)}٪`,
    ],
    ['معامله‌گرها', `${faNum(view.standings.length)} از ${faNum(s.maxParticipants)}`],
    ['ورود دیرهنگام', s.allowLateJoin ? 'مجاز' : 'غیرمجاز'],
    ['نمایش', s.visibility === 'public' ? 'عمومی' : 'خصوصی (با شناسه)'],
  ];
  if (view.host) rows.splice(1, 0, ['میزبان', view.host.name]);
  if (s.visibility === 'private') {
    rows.push([
      'شناسه',
      <bdi key="code" dir="ltr" className="font-mono font-semibold">
        {view.code}
      </bdi>,
    ]);
  }

  const note = !view.symbol ? (
    <p className="px-0.5 py-2 text-[11.5px] leading-5 text-fg/75">
      بازار از بین نمادهای انتخاب‌شده کشیده می‌شود و با شروع شمارش معلوم می‌شود. رد شدن از سقف افت
      یعنی حذف.
    </p>
  ) : null;

  if (variant === 'cards') {
    const byKey = new Map(rows.map((row) => [row[0], row[1]]));
    return (
      <div className="flex flex-col gap-3 py-3">
        {GROUPS.map((group) => {
          const items = group.keys.flatMap((key) => {
            const value = byKey.get(key);
            return value === undefined ? [] : [[key, value] as const];
          });
          if (items.length === 0) return null;
          return (
            <section key={group.title}>
              <h3 className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11.5px] font-semibold text-fg/80">
                <Icon name={group.icon} size={14} />
                {group.title}
              </h3>
              <dl className="overflow-hidden rounded-xl border border-line bg-chart/50">
                {items.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-start justify-between gap-3 border-t border-line px-2.5 py-2 first:border-t-0"
                  >
                    <dt className="shrink-0 text-[12px] text-fg/70">{k}</dt>
                    <dd className="text-end text-[12.5px] font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
        {note}
      </div>
    );
  }

  return (
    <div>
      <dl className="divide-y divide-line text-[12.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3 py-2">
            <dt className="shrink-0 text-muted">{k}</dt>
            <dd className="text-end">{v}</dd>
          </div>
        ))}
      </dl>
      {note}
    </div>
  );
}
