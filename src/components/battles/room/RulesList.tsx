'use client';

import { faNum } from '@/lib/locale/jalali';
import type { BattleView } from '@/lib/battles';
import { ASSET_COLORS, WIN_FA, compactMoney, minutes } from '../format';

/** Every rule of a battle, as shown before joining and in the battle's sidebar. */
export function RulesList({ view }: { readonly view: BattleView }) {
  const s = view.settings;
  const rows: Array<[string, React.ReactNode]> = [
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
    [
      'سرعت بازپخش',
      `${faNum(s.speed)}× (هر کندل یک‌دقیقه‌ای، ${faNum(60 / s.speed)} ثانیه)`,
    ],
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
  return (
    <dl className="divide-y divide-line text-[12.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-3 py-2">
          <dt className="shrink-0 text-muted">{k}</dt>
          <dd className="text-end">{v}</dd>
        </div>
      ))}
      {!view.symbol ? (
        <p className="py-2 text-[11.5px] leading-5 text-muted">
          بازار از بین نمادهای انتخاب‌شده کشیده می‌شود و با شروع شمارش معلوم می‌شود. رد شدن از سقف
          افت یعنی حذف.
        </p>
      ) : null}
    </dl>
  );
}
