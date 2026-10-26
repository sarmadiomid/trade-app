'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatIranianMobile } from '@/auth/phone';
import { faNum } from '@/lib/locale/jalali';
import { HomeShell, ShellMenuButton, ShellTools } from '../home/HomeShell';
import type { Me } from '../platform/api';
import { Icon } from '../ui/Icon';
import { usePlan, usePlanReady } from './usePlan';
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_SETTINGS_HREF,
  checkoutPath,
  monthlyAmount,
  paymentGatewayPath,
  subscriptionAmount,
  type BillingCycle,
  type PaidPlanId,
} from './plans';

const CYCLE_LABEL: Record<BillingCycle, string> = {
  month: 'ماهانه',
  year: 'سالانه',
};

export function CheckoutView({
  user,
  planId,
  cycle: cycleFromUrl,
}: {
  readonly user: Me;
  readonly planId: PaidPlanId;
  readonly cycle: BillingCycle;
}) {
  const router = useRouter();
  const activePlan = usePlan();
  const planReady = usePlanReady();
  const [cycle, setCycle] = useState(cycleFromUrl);
  const [seenCycle, setSeenCycle] = useState(cycleFromUrl);
  if (cycleFromUrl !== seenCycle) {
    setSeenCycle(cycleFromUrl);
    setCycle(cycleFromUrl);
  }

  const plan = SUBSCRIPTION_PLANS.find((item) => item.id === planId) ?? SUBSCRIPTION_PLANS[1]!;
  const amount = subscriptionAmount(planId, cycle);
  const monthly = monthlyAmount(planId);
  const alreadyOnPlan = planReady && activePlan === planId;
  const payHref = paymentGatewayPath(planId, cycle);

  const pickCycle = (next: BillingCycle) => {
    if (next === cycle) return;
    setCycle(next);
    router.replace(checkoutPath(planId, next), { scroll: false });
  };

  return (
    <HomeShell user={user} notices={0} noticeMenu={null}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-3 px-4 pt-4 sm:px-8 sm:pt-5">
          <ShellMenuButton />
          <div className="order-last min-w-0 w-full sm:order-none sm:w-auto sm:flex-1">
            <h1 className="text-[22px] font-bold leading-none sm:text-[26px]">تسویه حساب</h1>
            <p className="mt-1.5 text-[13px] leading-6 text-[var(--h-muted)]">
              جزئیات طرح را ببینید، بعد برای پرداخت به درگاه بروید.
            </p>
          </div>
          <div className="ms-auto">
            <ShellTools />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-16 pt-5 sm:px-8">
          <div className="mx-auto flex max-w-[1080px] flex-col gap-4">
            <nav aria-label="مراحل خرید" className="flex flex-wrap items-center gap-2 text-[13px]">
              <Link
                href={SUBSCRIPTION_SETTINGS_HREF}
                className="inline-flex items-center gap-1 font-medium text-[var(--h-muted)] transition hover:text-[var(--h-text)]"
              >
                <Icon name="chevronLeft" size={15} className="rtl:-scale-x-100" />
                انتخاب طرح
              </Link>
              <span aria-hidden="true" className="text-[var(--h-muted)]">
                /
              </span>
              <span aria-current="step" className="font-semibold">
                تسویه حساب
              </span>
              <span aria-hidden="true" className="text-[var(--h-muted)]">
                /
              </span>
              <span className="text-[var(--h-muted)]">درگاه پرداخت</span>
            </nav>
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
              <section className="order-2 flex flex-col gap-4 lg:order-1">
                <article className="relative overflow-hidden rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] p-5 sm:p-6">
                  {planId === 'pro' ? (
                    <span className="pointer-events-none absolute -end-10 -top-8 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--h-accent)_35%,transparent)] blur-3xl" />
                  ) : null}
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--h-accent)_16%,transparent)] text-[var(--h-accent)] ring-1 ring-[color-mix(in_srgb,var(--h-accent)_35%,transparent)]">
                        <Icon name="crown" size={20} />
                      </span>
                      <div>
                        <h2 className="text-[18px] font-bold">طرح {plan.name}</h2>
                        <p className="mt-0.5 text-[13px] text-[var(--h-muted)]">{plan.blurb}</p>
                      </div>
                    </div>
                    {planId === 'pro' ? (
                      <span className="shrink-0 rounded-full bg-[var(--h-accent)] px-2.5 py-1 text-[11px] font-bold text-white">
                        پیشنهادی
                      </span>
                    ) : null}
                  </div>

                  <div
                    role="radiogroup"
                    aria-label="دوره پرداخت"
                    className="relative mt-5 flex w-fit rounded-full border border-[var(--h-line)] bg-[var(--h-field)] p-1"
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
                          onClick={() => pickCycle(id)}
                          className={`h-8 rounded-full px-4 text-[13px] font-medium transition ${
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

                  <div className="relative mt-5 flex items-end gap-2">
                    <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums sm:text-[40px]">
                      {faNum(amount)}
                    </span>
                    <span className="mb-1 text-[13px] text-[var(--h-muted)]">تومان</span>
                  </div>
                  <p className="relative mt-2 text-[13px] text-[var(--h-muted)]">
                    {cycle === 'month'
                      ? 'برای یک ماه'
                      : `برای ۱۲ ماه، معادل ${faNum(monthly)} تومان در هر ماه`}
                  </p>

                  <div className="relative my-5 h-px bg-[var(--h-line)]" />

                  <h3 className="relative text-[13px] font-semibold text-[var(--h-muted)]">
                    با این طرح فعال می‌شود
                  </h3>
                  <ul className="relative mt-3 flex flex-col gap-2.5">
                    {plan.points.map((point) => (
                      <li key={point} className="flex items-center gap-2.5 text-[14px]">
                        {plan.unlimited ? (
                          <span className="w-4 shrink-0 text-center text-[16px] leading-none text-[var(--h-accent)]">
                            ∞
                          </span>
                        ) : (
                          <Icon
                            name="check"
                            size={15}
                            className="shrink-0 text-[var(--h-accent)]"
                          />
                        )}
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] p-5 sm:p-6">
                  <h2 className="text-[15px] font-semibold">حساب خریدار</h2>
                  <p className="mt-1 text-[13px] leading-6 text-[var(--h-muted)]">
                    اشتراک بعد از تأیید پرداخت روی همین حساب فعال می‌شود.
                  </p>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--h-line)] bg-[var(--h-field)] px-3.5 py-3">
                      <dt className="text-[12px] text-[var(--h-muted)]">نام</dt>
                      <dd className="mt-1 truncate text-[14px] font-semibold">{user.name}</dd>
                    </div>
                    <div className="rounded-xl border border-[var(--h-line)] bg-[var(--h-field)] px-3.5 py-3">
                      <dt className="text-[12px] text-[var(--h-muted)]">شماره</dt>
                      <dd
                        dir="ltr"
                        className="mt-1 w-full text-right text-[14px] font-semibold tabular-nums"
                      >
                        {formatIranianMobile(user.phone)}
                      </dd>
                    </div>
                  </dl>
                </article>
              </section>

              <aside className="order-1 lg:sticky lg:top-0 lg:order-2">
                <div className="rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] p-5 sm:p-6">
                  <h2 className="text-[15px] font-semibold">خلاصه سفارش</h2>
                  <dl className="mt-4 flex flex-col gap-3 text-[13.5px]">
                    <Row k="طرح" v={plan.name} />
                    <Row k="دوره" v={cycle === 'year' ? 'سالانه · ۱۲ ماه' : CYCLE_LABEL.month} />
                    {cycle === 'year' ? (
                      <Row k="مبلغ هر ماه" v={`${faNum(monthly)} تومان`} />
                    ) : null}
                  </dl>
                  <div className="my-4 h-px bg-[var(--h-line)]" />
                  <div className="flex items-end justify-between gap-3">
                    <span className="text-[13px] text-[var(--h-muted)]">قابل پرداخت</span>
                    <p className="text-end" aria-live="polite">
                      <span className="text-[22px] font-bold leading-none tabular-nums">
                        {faNum(amount)}
                      </span>
                      <span className="ms-1.5 text-[12px] text-[var(--h-muted)]">تومان</span>
                    </p>
                  </div>

                  {alreadyOnPlan ? (
                    <p className="mt-4 rounded-xl border border-[var(--h-line)] bg-[var(--h-chip)] px-3 py-2.5 text-[13px] leading-6 text-[var(--h-muted)]">
                      طرح {plan.name} همین حالا روی حساب شماست. برای خرید، طرح دیگری را انتخاب کنید.
                    </p>
                  ) : null}

                  {alreadyOnPlan ? (
                    <Link
                      href={SUBSCRIPTION_SETTINGS_HREF}
                      className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full border border-[var(--h-line)] text-[14px] font-semibold transition hover:bg-[var(--h-chip)]"
                    >
                      بازگشت به طرح‌ها
                    </Link>
                  ) : (
                    <Link
                      href={payHref}
                      data-testid="checkout-pay"
                      className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--h-accent)] text-[14.5px] font-bold text-white shadow-lg shadow-accent/40 transition hover:brightness-110 motion-safe:active:scale-[0.99]"
                    >
                      پرداخت و رفتن به درگاه
                      <Icon name="chevronRight" size={16} className="rtl:-scale-x-100" />
                    </Link>
                  )}

                  <ul className="mt-4 flex flex-col gap-2.5 text-[12.5px] leading-5 text-[var(--h-muted)]">
                    <li className="flex items-start gap-2">
                      <Icon name="shield" size={15} className="mt-0.5 shrink-0" />
                      پرداخت داخل درگاه بانکی انجام می‌شود.
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon name="lock" size={15} className="mt-0.5 shrink-0" />
                      اطلاعات کارت در کندلو وارد نمی‌شود.
                    </li>
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </HomeShell>
  );
}

/** Destination of the pay button. No bank call — the gateway is not connected. */
export function PaymentGatewayPending({
  user,
  planId,
  cycle,
}: {
  readonly user: Me;
  readonly planId: PaidPlanId | null;
  readonly cycle: BillingCycle;
}) {
  const back = planId ? checkoutPath(planId, cycle) : SUBSCRIPTION_SETTINGS_HREF;
  return (
    <HomeShell user={user} notices={0} noticeMenu={null}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-3 px-4 pt-4 sm:px-8 sm:pt-5">
          <ShellMenuButton />
          <h1 className="order-last w-full text-[22px] font-bold leading-none sm:order-none sm:w-auto sm:flex-1 sm:text-[26px]">
            درگاه پرداخت
          </h1>
          <div className="ms-auto">
            <ShellTools />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="flex max-w-md flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] text-[var(--h-accent)]">
              <Icon name="lock" size={28} />
            </span>
            <span className="mt-5 rounded-md border border-[var(--h-line)] bg-[var(--h-chip)] px-2.5 py-1 text-[12px] font-bold text-[var(--h-muted)]">
              به‌زودی
            </span>
            <h2 className="mt-4 text-[24px] font-extrabold leading-tight sm:text-[28px]">
              درگاه پرداخت هنوز وصل نشده
            </h2>
            <p className="mt-3 text-[15px] leading-8 text-[var(--h-muted)]">
              اینجا همان جایی است که بعد از تسویه حساب به بانک می‌روید. اتصال هنوز برقرار نیست و
              مبلغی از حساب شما کم نشده.
            </p>
            <Link
              href={back}
              className="mt-6 inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--h-accent)] px-5 text-[14px] font-semibold text-white"
            >
              <Icon name="chevronLeft" size={15} className="rtl:-scale-x-100" />
              بازگشت به تسویه حساب
            </Link>
          </div>
        </div>
      </div>
    </HomeShell>
  );
}

function Row({ k, v }: { readonly k: string; readonly v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--h-muted)]">{k}</dt>
      <dd className="text-end font-medium tabular-nums">{v}</dd>
    </div>
  );
}
