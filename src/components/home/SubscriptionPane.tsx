'use client';

import { useEffect, useRef, useState } from 'react';
import { faNum } from '@/lib/locale/jalali';
import { Icon } from '../ui/Icon';

const MID_TOMAN = 199_000;
const PRO_TOMAN = 399_000;

type Cycle = 'month' | 'year';
type Cell = 'yes' | 'no' | string;

const PLANS = [
  {
    id: 'beginner',
    name: 'مبتدی',
    blurb: 'تمرین را از همین‌جا شروع کنید',
    points: ['۲ جلسه بک‌تست', 'بازپخش روی طلا', 'دفتر معاملات'],
    unlimited: false,
  },
  {
    id: 'mid',
    name: 'متوسط',
    blurb: 'تمرین را دقیق‌تر و منظم‌تر کنید',
    points: ['۱۰ جلسه بک‌تست', 'جلسه پراپ و آمار کامل', 'نبرد رتبه‌ای', 'ابزار ترسیم'],
    unlimited: false,
  },
  {
    id: 'pro',
    name: 'حرفه‌ای',
    blurb: 'هرچه برای تمرین جدی لازم است',
    points: [
      'جلسه بک‌تست نامحدود',
      'همه نمادها و انواع نمودار',
      'آمار و شبیه‌ساز ریسک به ریوارد',
      'نبرد نامحدود',
    ],
    unlimited: true,
  },
] as const;

const GROUPS: ReadonlyArray<{
  id: string;
  title: string;
  rows: ReadonlyArray<{ label: string; cells: readonly [Cell, Cell, Cell] }>;
}> = [
  {
    id: 'backtest',
    title: 'امکانات بک‌تست',
    rows: [
      { label: 'جلسات بک‌تست', cells: ['۲', '۱۰', 'نامحدود'] },
      { label: 'جلسه پراپ', cells: ['no', 'yes', 'yes'] },
      { label: 'بازپخش کندل‌به‌کندل', cells: ['yes', 'yes', 'yes'] },
      { label: 'شروع با انتخاب کندل', cells: ['yes', 'yes', 'yes'] },
      { label: 'شروع با تاریخ', cells: ['yes', 'yes', 'yes'] },
      { label: 'شروع از اولین کندل', cells: ['yes', 'yes', 'yes'] },
      { label: 'کندل تصادفی', cells: ['no', 'yes', 'yes'] },
      { label: 'پرش قیمت', cells: ['no', 'yes', 'yes'] },
      { label: 'تغییر تایم‌فریم وسط جلسه', cells: ['yes', 'yes', 'yes'] },
      { label: 'حد ضرر و حد سود', cells: ['yes', 'yes', 'yes'] },
      { label: 'حجم و لات', cells: ['yes', 'yes', 'yes'] },
      { label: 'اسپرد', cells: ['yes', 'yes', 'yes'] },
      { label: 'کارمزد', cells: ['no', 'yes', 'yes'] },
      { label: 'موجودی دلخواه', cells: ['no', 'yes', 'yes'] },
      { label: 'برچسب استراتژی', cells: ['no', '۳', 'نامحدود'] },
      { label: 'طلا', cells: ['yes', 'yes', 'yes'] },
      { label: 'یورو، پوند و دلار استرالیا', cells: ['no', 'yes', 'yes'] },
      { label: 'شاخص نزدک', cells: ['no', 'no', 'yes'] },
    ],
  },
  {
    id: 'chart',
    title: 'نمودار و ابزار',
    rows: [
      { label: 'کندل، میله، خط و ناحیه', cells: ['yes', 'yes', 'yes'] },
      { label: 'هیکن آشی', cells: ['yes', 'yes', 'yes'] },
      { label: 'رنکو، کاگی، نقطه و رقم و رنج', cells: ['no', 'yes', 'yes'] },
      { label: 'جریان سفارش: فوت‌پرینت، پروفایل حجم و TPO', cells: ['no', 'no', 'yes'] },
      { label: 'حجم معاملات', cells: ['yes', 'yes', 'yes'] },
      { label: 'خط روند، پرتو و کانال', cells: ['yes', 'yes', 'yes'] },
      { label: 'فیبوناچی', cells: ['no', 'yes', 'yes'] },
      { label: 'پوزیشن خرید و فروش', cells: ['yes', 'yes', 'yes'] },
      { label: 'متن، شکل و هایلایت', cells: ['yes', 'yes', 'yes'] },
      { label: 'پوسته نمودار', cells: ['yes', 'yes', 'yes'] },
      { label: 'چیدمان ذخیره‌شده', cells: ['۱', '۵', 'نامحدود'] },
      { label: 'خروجی و ورود ترسیم', cells: ['no', 'yes', 'yes'] },
    ],
  },
  {
    id: 'analytics',
    title: 'آمار',
    rows: [
      { label: 'داشبورد آمار', cells: ['خلاصه', 'کامل', 'کامل'] },
      { label: 'منحنی موجودی', cells: ['yes', 'yes', 'yes'] },
      { label: 'افت سرمایه', cells: ['no', 'yes', 'yes'] },
      { label: 'خرید در برابر فروش', cells: ['yes', 'yes', 'yes'] },
      { label: 'تقویم سود و زیان', cells: ['no', 'yes', 'yes'] },
      { label: 'عملکرد روزهای هفته', cells: ['no', 'yes', 'yes'] },
      { label: 'عملکرد ساعت ورود', cells: ['no', 'yes', 'yes'] },
      { label: 'عملکرد سشن‌ها', cells: ['no', 'yes', 'yes'] },
      { label: 'میانگین دوره‌ای', cells: ['no', 'yes', 'yes'] },
      { label: 'توزیع سود و زیان', cells: ['no', 'yes', 'yes'] },
      { label: 'توزیع ضریب R', cells: ['no', 'yes', 'yes'] },
      { label: 'شبیه‌ساز ریسک به ریوارد', cells: ['no', 'yes', 'yes'] },
      { label: 'فیلتر جهت، برچسب و سشن', cells: ['no', 'yes', 'yes'] },
    ],
  },
  {
    id: 'journal',
    title: 'دفتر معاملات',
    rows: [
      { label: 'ثبت خودکار معامله', cells: ['yes', 'yes', 'yes'] },
      { label: 'یادداشت', cells: ['yes', 'yes', 'yes'] },
      { label: 'برچسب', cells: ['۱', 'نامحدود', 'نامحدود'] },
      { label: 'عکس تحلیل', cells: ['۱', '۱۰', 'نامحدود'] },
      { label: 'امتیاز اطمینان', cells: ['no', 'yes', 'yes'] },
      { label: 'جستجو', cells: ['no', 'yes', 'yes'] },
      { label: 'فیلتر جهت، نتیجه و سشن', cells: ['no', 'yes', 'yes'] },
    ],
  },
  {
    id: 'battle',
    title: 'نبرد',
    rows: [
      { label: 'شرکت در نبرد', cells: ['no', 'yes', 'yes'] },
      { label: 'رتبه با امتیاز الو', cells: ['no', 'yes', 'yes'] },
      { label: 'گفتگوی اتاق', cells: ['no', 'yes', 'yes'] },
    ],
  },
];

const LABEL_FR = 1.45;
const PLAN_FR = 1;
const TOTAL_FR = LABEL_FR + PLAN_FR * 3;
const GRID = `${LABEL_FR}fr repeat(3, ${PLAN_FR}fr)`;

function amount(base: number, cycle: Cycle): number {
  return cycle === 'year' ? base * 12 : base;
}

/** Subscription tab: plan cards and comparison, display only. */
export function SubscriptionPane() {
  const [cycle, setCycle] = useState<Cycle>('month');
  const [menu, setMenu] = useState(false);
  const [closed, setClosed] = useState<Readonly<Record<string, boolean>>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const seePlans = () => {
    setMenu(false);
    document.getElementById('subscription-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="max-w-[1080px] pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] px-5 py-4">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-[18px] font-semibold">مبتدی</span>
            <span className="text-[18px] font-bold">رایگان</span>
          </div>
          <p className="mt-1 text-[13px] text-[var(--h-muted)]">مهارت معامله‌گری‌تان را بهتر کنید</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 items-center rounded-full bg-[var(--h-accent)] px-3.5 text-[12.5px] font-semibold text-white">
            طرح رایگان
          </span>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-expanded={menu}
              aria-haspopup="menu"
              onClick={() => setMenu((v) => !v)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--h-line)] bg-[var(--h-chip)] px-3 text-[13px] font-medium transition hover:bg-[var(--h-soft)]"
            >
              مدیریت طرح
              <Icon
                name="chevronDown"
                size={14}
                className={`text-[var(--h-muted)] transition ${menu ? 'rotate-180' : ''}`}
              />
            </button>
            {menu ? (
              <div
                role="menu"
                className="absolute end-0 z-30 mt-2 w-48 rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-1.5 shadow-2xl"
              >
                <p className="px-2.5 py-1.5 text-[12px] text-[var(--h-muted)]">طرح فعلی: مبتدی</p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={seePlans}
                  className="flex h-9 w-full items-center rounded-lg px-2.5 text-[13px] transition hover:bg-[var(--h-chip)]"
                >
                  مشاهده طرح‌ها
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="دوره پرداخت"
        className="mx-auto mt-8 flex w-fit rounded-full border border-[var(--h-line)] bg-[var(--h-field)] p-1"
      >
        {(
          [
            ['month', 'ماهانه'],
            ['year', 'سالانه'],
          ] as const
        ).map(([id, label]) => {
          const on = cycle === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setCycle(id)}
              className={`h-8 rounded-full px-5 text-[13px] font-medium transition ${
                on
                  ? 'bg-[var(--h-soft)] text-[var(--h-text)]'
                  : 'text-[var(--h-muted)] hover:text-[var(--h-text)]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div id="subscription-plans" className="mt-6 grid scroll-mt-6 gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <article
            key={plan.id}
            className="relative flex flex-col overflow-hidden rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] p-6"
          >
            {plan.id === 'pro' ? (
              <>
                <span className="pointer-events-none absolute -end-8 top-16 h-36 w-36 rounded-full bg-[#3b78ff]/45 blur-3xl" />
                <span className="pointer-events-none absolute -end-4 bottom-20 h-24 w-24 rounded-full bg-[#2ad4c0]/35 blur-3xl" />
              </>
            ) : null}
            <h2 className="relative text-[15px] font-semibold">{plan.name}</h2>
            {plan.id === 'beginner' ? (
              <p className="relative mt-4 text-[40px] font-bold leading-none">رایگان</p>
            ) : (
              <div className="relative mt-4 flex items-start gap-1.5">
                <span className="text-[40px] font-bold leading-none tracking-tight tabular-nums">
                  {faNum(amount(plan.id === 'mid' ? MID_TOMAN : PRO_TOMAN, cycle))}
                </span>
                <span className="mt-1.5 text-[13px] text-[var(--h-muted)]">تومان</span>
              </div>
            )}
            {plan.id === 'beginner' ? (
              <p className="relative mt-2 text-[12.5px] text-[var(--h-muted)]">برای شروع</p>
            ) : (
              <p className="relative mt-2 text-[12.5px] text-[var(--h-muted)]">
                {cycle === 'month' ? 'ماهانه' : 'سالانه'}
              </p>
            )}
            <p className="relative mt-3 text-[13.5px] leading-6 text-[var(--h-muted)]">{plan.blurb}</p>
            <ul className="relative mt-5 flex flex-col gap-2.5">
              {plan.points.map((point) => (
                <li key={point} className="flex items-center gap-2.5 text-[13.5px]">
                  {plan.unlimited ? (
                    <span className="w-4 shrink-0 text-center text-[16px] leading-none text-[var(--h-accent)]">
                      ∞
                    </span>
                  ) : (
                    <Icon name="check" size={15} className="shrink-0" />
                  )}
                  {point}
                </li>
              ))}
            </ul>
            {plan.id === 'beginner' ? null : (
              <div className="relative mt-auto pt-6">
                <button
                  type="button"
                  className="h-11 w-full rounded-full border border-[var(--h-line)] text-[14px] font-medium transition hover:bg-[var(--h-chip)]"
                >
                  ارتقا
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-8">
        {GROUPS.map((group) => {
          const open = !closed[group.id];
          return (
            <section
              key={group.id}
              className="rounded-2xl border border-[var(--h-line)] px-4 py-3 sm:px-5"
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setClosed((cur) => ({ ...cur, [group.id]: open }))}
                className="flex w-full items-center justify-between py-2 text-start"
              >
                <span className="text-[16px] font-semibold">{group.title}</span>
                <Icon
                  name="chevronDown"
                  size={18}
                  className={`text-[var(--h-muted)] transition ${open ? 'rotate-180' : ''}`}
                />
              </button>
              {open ? <Compare rows={group.rows} /> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Compare({
  rows,
}: {
  readonly rows: ReadonlyArray<{ label: string; cells: readonly [Cell, Cell, Cell] }>;
}) {
  const names = ['مبتدی', 'متوسط', 'حرفه‌ای'] as const;
  return (
    <div className="mt-2 overflow-x-auto">
      <div className="relative min-w-[720px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 z-[1] rounded-2xl border-2 border-[var(--h-accent)]"
          style={{
            insetInlineStart: `${(LABEL_FR / TOTAL_FR) * 100}%`,
            width: `${(PLAN_FR / TOTAL_FR) * 100}%`,
          }}
        />
        <div role="table" className="grid" style={{ gridTemplateColumns: GRID }}>
          <div role="row" className="contents">
            <div role="columnheader" className="border-b border-[var(--h-line)]" />
            {names.map((name) => (
              <div
                key={name}
                role="columnheader"
                className="border-b border-[var(--h-line)] px-2 py-3.5 text-center text-[14px] font-semibold"
              >
                {name}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.label} role="row" className="contents">
              <div
                role="rowheader"
                className="flex min-h-12 items-center border-b border-[var(--h-line)] pe-3 text-[13.5px] text-[var(--h-muted)]"
              >
                {row.label}
              </div>
              {row.cells.map((cell, i) => (
                <div
                  key={names[i]}
                  role="cell"
                  className="flex min-h-12 items-center justify-center border-b border-[var(--h-line)] px-2 text-[13.5px]"
                >
                  <Mark value={cell} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Mark({ value }: { readonly value: Cell }) {
  if (value === 'yes') return <Icon name="check" size={16} />;
  if (value === 'no') {
    return <span className="text-[16px] leading-none text-[var(--h-muted)]">×</span>;
  }
  return <span>{value}</span>;
}
