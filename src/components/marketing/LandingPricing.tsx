'use client';

import Link from 'next/link';
import { useState } from 'react';
import { faNum } from '@/lib/locale/jalali';
import {
  SUBSCRIPTION_PLANS,
  checkoutPath,
  subscriptionAmount,
  type BillingCycle,
} from '../billing/plans';

const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f7bff] font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.14)_inset,0_12px_32px_-12px_rgba(47,123,255,0.9)] transition hover:bg-[#4388ff]';
const BTN_GHOST =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] font-semibold text-[#dbe4f8] transition hover:border-white/25 hover:bg-white/[0.07]';

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

/** Plan cards shown in account settings, restyled for the landing. */
function buyHref(
  planId: 'beginner' | 'mid' | 'pro',
  cycle: BillingCycle,
  signedIn: boolean,
): string {
  if (planId === 'beginner') return signedIn ? '/home' : '/login';
  const next = checkoutPath(planId, cycle);
  return signedIn ? next : `/login?next=${encodeURIComponent(next)}`;
}

export function LandingPricing({ signedIn }: { signedIn: boolean }) {
  const [cycle, setCycle] = useState<BillingCycle>('month');

  return (
    <div className="mt-12">
      <div
        role="radiogroup"
        aria-label="دوره پرداخت"
        className="mx-auto flex w-fit rounded-full border border-white/10 bg-white/[0.03] p-1"
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
              className={`h-9 rounded-full px-5 text-[13px] font-semibold transition ${
                on ? 'bg-white text-[#071330]' : 'text-[#8b98b8] hover:text-white'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid items-stretch gap-4 lg:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const featured = plan.id === 'pro';
          return (
            <article
              key={plan.id}
              className={`relative flex flex-col overflow-hidden rounded-[25px] p-6 sm:p-8 ${
                featured
                  ? 'border border-[#5aa2ff]/50 bg-[#070c1a] shadow-[0_0_80px_-28px_rgba(47,123,255,0.7)]'
                  : 'border border-white/[0.08] bg-[#080c17]'
              }`}
            >
              {featured ? (
                <span className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(60%_100%_at_80%_0%,rgba(47,123,255,0.28),transparent_70%)]" />
              ) : null}
              <h3 className="relative text-[17px] font-extrabold text-white">{plan.name}</h3>
              {plan.id === 'beginner' ? (
                <p className="relative mt-5 text-[44px] font-black leading-none text-white">
                  رایگان
                </p>
              ) : (
                <div className="relative mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
                  <span className="text-[32px] font-black leading-none tracking-tight text-white tabular-nums lg:text-[40px]">
                    {faNum(subscriptionAmount(plan.id, cycle))}
                  </span>
                  <span className="mb-1 text-sm font-bold text-[#7d8bac]">تومان</span>
                </div>
              )}
              <p className="relative mt-2 text-[13px] text-[#7d8bac]">
                {plan.id === 'beginner' ? 'برای شروع' : cycle === 'month' ? 'ماهانه' : 'سالانه'}
              </p>
              <p className="relative mt-4 text-[14px] leading-7 text-[#8b98b8]">{plan.blurb}</p>
              <ul className="relative mt-6 flex flex-col gap-3">
                {plan.points.map((point) => (
                  <li key={point} className="flex items-center gap-3 text-[14px] text-[#dbe4f8]">
                    {plan.unlimited ? (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[16px] leading-none text-[#38d3ff]">
                        ∞
                      </span>
                    ) : (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#38d3ff]/[0.12] text-[#38d3ff]">
                        <Check />
                      </span>
                    )}
                    {point}
                  </li>
                ))}
              </ul>
              <div className="relative mt-auto pt-8">
                <Link
                  href={buyHref(plan.id, cycle, signedIn)}
                  className={`${featured ? BTN_PRIMARY : BTN_GHOST} h-12 w-full text-[14.5px]`}
                >
                  {plan.id === 'beginner'
                    ? signedIn
                      ? 'ورود به داشبورد'
                      : 'شروع رایگان'
                    : signedIn
                      ? 'خرید طرح'
                      : 'انتخاب طرح'}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
