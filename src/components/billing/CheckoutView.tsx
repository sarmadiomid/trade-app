'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { formatIranianMobile } from '@/auth/phone';
import { isPaymentRedirect, type DiscountQuote, type PaymentGatewayId } from '@/lib/app';
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
  subscriptionAmount,
  type BillingCycle,
  type PaidPlanId,
} from './plans';

const CYCLE_LABEL: Record<BillingCycle, string> = {
  month: 'ماهانه',
  year: 'سالانه',
};

const GATEWAYS: readonly {
  readonly id: PaymentGatewayId;
  readonly name: string;
  readonly detail: string;
  readonly mark: string;
  readonly ready: boolean;
}[] = [
  {
    id: 'zarinpal',
    name: 'زرین‌پال',
    detail: 'پرداخت با همه کارت‌های شتاب',
    mark: 'زر',
    ready: true,
  },
  {
    id: 'sep',
    name: 'سپ (سامان)',
    detail: 'پرداخت از درگاه بانک سامان',
    mark: 'سپ',
    ready: false,
  },
];

export function CheckoutView({
  user,
  planId,
  cycle: cycleFromUrl,
  initialCode,
  initialQuote,
  initialError,
  sandbox,
}: {
  readonly user: Me;
  readonly planId: PaidPlanId;
  readonly cycle: BillingCycle;
  readonly initialCode: string;
  readonly initialQuote: DiscountQuote | null;
  readonly initialError: string | null;
  /** Zarinpal sandbox is on, so a successful test does not charge a card. */
  readonly sandbox: boolean;
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

  const serverKey = `${planId}|${cycleFromUrl}|${initialCode}|${initialQuote?.code ?? ''}|${initialQuote?.total ?? ''}|${initialError ?? ''}`;
  const [seenKey, setSeenKey] = useState(serverKey);
  const [seenCode, setSeenCode] = useState(initialCode);
  const [draft, setDraft] = useState(initialCode);
  const [applied, setApplied] = useState(initialQuote);
  const [discountError, setDiscountError] = useState(initialError);
  const [discountPending, setDiscountPending] = useState(false);
  const [gateway, setGateway] = useState<PaymentGatewayId>('zarinpal');
  const [payPending, setPayPending] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  if (serverKey !== seenKey) {
    setSeenKey(serverKey);
    setApplied(initialQuote);
    setDiscountError(initialError);
    setDiscountPending(false);
    if (initialCode !== seenCode) {
      setSeenCode(initialCode);
      setDraft(initialCode);
    }
  }

  const plan = SUBSCRIPTION_PLANS.find((item) => item.id === planId) ?? SUBSCRIPTION_PLANS[1]!;
  const amount = subscriptionAmount(planId, cycle);
  const monthly = monthlyAmount(planId);
  const alreadyOnPlan = planReady && activePlan === planId;
  const quote = alreadyOnPlan || cycle !== cycleFromUrl ? null : applied;
  const payable = quote?.total ?? amount;
  const holdPay = discountPending && !alreadyOnPlan;

  const startPay = async () => {
    if (payPending || gateway !== 'zarinpal') return;
    setPayPending(true);
    setPayError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          cycle,
          code: quote?.code ?? '',
          gateway,
        }),
      });
      const body = (await res.json()) as { url?: unknown; error?: string };
      const url = typeof body.url === 'string' ? body.url : '';
      if (!res.ok || !isPaymentRedirect(url)) {
        setPayError(body.error ?? 'اتصال به درگاه انجام نشد');
        setPayPending(false);
        return;
      }
      window.location.assign(url);
    } catch {
      setPayError('اتصال به درگاه انجام نشد');
      setPayPending(false);
    }
  };

  const pickCycle = (next: BillingCycle) => {
    if (next === cycle) return;
    setCycle(next);
    if (initialCode) setDiscountPending(true);
    router.replace(checkoutPath(planId, next, initialCode || undefined), { scroll: false });
  };

  const applyDiscount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draft.trim();
    if (!next) {
      setDiscountError('کد تخفیف را وارد کنید');
      return;
    }
    const href = checkoutPath(planId, cycle, next);
    if (href === checkoutPath(planId, cycle, initialCode)) {
      router.refresh();
      return;
    }
    setDiscountError(null);
    setDiscountPending(true);
    router.replace(href, { scroll: false });
  };

  const clearDiscount = () => {
    setDraft('');
    setApplied(null);
    setDiscountError(null);
    setDiscountPending(false);
    if (initialCode) router.replace(checkoutPath(planId, cycle), { scroll: false });
  };

  return (
    <HomeShell user={user} notices={0} noticeMenu={null}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-3 px-4 pt-4 sm:px-8 sm:pt-5">
          <ShellMenuButton />
          <div className="order-last min-w-0 w-full sm:order-none sm:w-auto sm:flex-1">
            <h1 className="text-[22px] font-bold leading-none sm:text-[26px]">تسویه حساب</h1>
            <p className="mt-1.5 text-[13px] leading-6 text-[var(--h-muted)]">
              جزئیات طرح را ببینید، روش پرداخت را انتخاب کنید و به درگاه بروید.
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
                      {faNum(payable)}
                    </span>
                    <span className="mb-1 text-[13px] text-[var(--h-muted)]">تومان</span>
                  </div>
                  <p className="relative mt-2 text-[13px] text-[var(--h-muted)]">
                    {quote ? (
                      <>
                        <span className="tabular-nums line-through">{faNum(amount)}</span>
                        <span className="ms-2 text-[var(--h-accent)]">
                          {discountCaption(quote)}
                        </span>
                      </>
                    ) : cycle === 'month' ? (
                      'برای یک ماه'
                    ) : (
                      `برای ۱۲ ماه، معادل ${faNum(monthly)} تومان در هر ماه`
                    )}
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
                    {quote ? <Row k="مبلغ سفارش" v={`${faNum(quote.subtotal)} تومان`} /> : null}
                    {quote ? (
                      <Row k="تخفیف" v={`−${faNum(quote.discount)} تومان`} tone="accent" />
                    ) : null}
                  </dl>

                  {alreadyOnPlan ? null : (
                    <DiscountCodeBox
                      draft={draft}
                      pending={discountPending}
                      error={discountError}
                      quote={quote}
                      onDraft={(value) => {
                        setDraft(value);
                        if (discountError) setDiscountError(null);
                      }}
                      onApply={applyDiscount}
                      onClear={clearDiscount}
                    />
                  )}

                  <div className="my-4 h-px bg-[var(--h-line)]" />
                  <div className="flex items-end justify-between gap-3">
                    <span className="text-[13px] text-[var(--h-muted)]">قابل پرداخت</span>
                    <p className="text-end" aria-live="polite">
                      <span
                        data-testid="checkout-payable"
                        className="text-[22px] font-bold leading-none tabular-nums"
                      >
                        {faNum(payable)}
                      </span>
                      <span className="ms-1.5 text-[12px] text-[var(--h-muted)]">تومان</span>
                    </p>
                  </div>

                  {alreadyOnPlan ? null : (
                    <GatewayPicker
                      gateway={gateway}
                      sandbox={sandbox}
                      onPick={(next) => {
                        setGateway(next);
                        setPayError(null);
                      }}
                    />
                  )}

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
                  ) : holdPay ? (
                    <span
                      aria-disabled="true"
                      className="mt-4 inline-flex h-12 w-full cursor-default items-center justify-center rounded-full bg-[var(--h-accent)] text-[14.5px] font-bold text-white opacity-60"
                    >
                      در حال بررسی کد
                    </span>
                  ) : gateway === 'sep' ? (
                    <button
                      type="button"
                      disabled
                      className="mt-4 inline-flex h-12 w-full cursor-default items-center justify-center rounded-full bg-[var(--h-accent)] text-[14.5px] font-bold text-white opacity-60"
                    >
                      درگاه سپ به‌زودی فعال می‌شود
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid="checkout-pay"
                      disabled={payPending}
                      onClick={() => void startPay()}
                      className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-[var(--h-accent)] px-4 text-[14.5px] font-bold text-white shadow-lg shadow-accent/40 transition hover:brightness-110 disabled:cursor-default disabled:opacity-70 motion-safe:active:scale-[0.99]"
                    >
                      {payPending ? null : <ZarinpalLogo />}
                      {payPending ? 'در حال اتصال به درگاه' : 'پرداخت با زرین‌پال'}
                      {payPending ? null : (
                        <Icon name="chevronRight" size={16} className="rtl:-scale-x-100" />
                      )}
                    </button>
                  )}

                  {payError ? (
                    <p role="alert" className="mt-3 text-[12.5px] leading-5 text-[var(--tc-down)]">
                      {payError}
                    </p>
                  ) : null}

                  <ul className="mt-4 flex flex-col gap-2.5 text-[12.5px] leading-5 text-[var(--h-muted)]">
                    <li className="flex items-start gap-2">
                      <Icon name="shield" size={15} className="mt-0.5 shrink-0" />
                      پرداخت داخل درگاه انتخاب‌شده انجام می‌شود.
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

/** Official Zarinpal wordmark from their docs. Dark type needs the white chip. */
function ZarinpalLogo() {
  return (
    <span className="inline-flex h-7 shrink-0 items-center rounded-md bg-white px-1.5 ring-1 ring-black/10">
      <Image
        src="/billing/zarinpal.svg"
        alt=""
        width={108}
        height={24}
        unoptimized
        className="h-4 w-auto"
      />
    </span>
  );
}

function GatewayPicker({
  gateway,
  sandbox,
  onPick,
}: {
  readonly gateway: PaymentGatewayId;
  readonly sandbox: boolean;
  readonly onPick: (gateway: PaymentGatewayId) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-[13px] font-medium">روش پرداخت</p>
      <div role="radiogroup" aria-label="روش پرداخت" className="mt-2 flex flex-col gap-2">
        {GATEWAYS.map((option) => {
          const on = gateway === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={on}
              data-testid={`checkout-gateway-${option.id}`}
              onClick={() => onPick(option.id)}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-start transition ${
                on
                  ? 'border-[var(--h-accent)] bg-[color-mix(in_srgb,var(--h-accent)_10%,transparent)]'
                  : 'border-[var(--h-line)] bg-[var(--h-field)] hover:border-[color-mix(in_srgb,var(--h-accent)_45%,var(--h-line))]'
              }`}
            >
              {option.id === 'zarinpal' ? (
                <ZarinpalLogo />
              ) : (
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold ${
                    on
                      ? 'bg-[var(--h-accent)] text-white'
                      : 'bg-[var(--h-chip)] text-[var(--h-muted)]'
                  }`}
                >
                  {option.mark}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold">{option.name}</span>
                  {option.ready ? null : (
                    <span className="rounded-md bg-[var(--h-chip)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--h-muted)]">
                      به‌زودی
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[12px] leading-5 text-[var(--h-muted)]">
                  {option.detail}
                </span>
              </span>
              <span
                className={`h-4 w-4 shrink-0 rounded-full border ${
                  on
                    ? 'border-[var(--h-accent)] bg-[var(--h-accent)] shadow-[inset_0_0_0_3px_var(--h-card)]'
                    : 'border-[var(--h-line)]'
                }`}
              />
            </button>
          );
        })}
      </div>
      {sandbox && gateway === 'zarinpal' ? (
        <p className="mt-2 text-[12px] leading-5 text-[var(--h-muted)]">
          حالت آزمایشی زرین‌پال روشن است و مبلغی از کارت کم نمی‌شود.
        </p>
      ) : null}
    </div>
  );
}

function Row({
  k,
  v,
  tone = 'default',
}: {
  readonly k: string;
  readonly v: string;
  readonly tone?: 'default' | 'accent';
}) {
  const accent = tone === 'accent';
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={accent ? 'text-[var(--h-accent)]' : 'text-[var(--h-muted)]'}>{k}</dt>
      <dd className={`text-end font-medium tabular-nums ${accent ? 'text-[var(--h-accent)]' : ''}`}>
        {v}
      </dd>
    </div>
  );
}

function DiscountCodeBox({
  draft,
  pending,
  error,
  quote,
  onDraft,
  onApply,
  onClear,
}: {
  readonly draft: string;
  readonly pending: boolean;
  readonly error: string | null;
  readonly quote: DiscountQuote | null;
  readonly onDraft: (value: string) => void;
  readonly onApply: (event: FormEvent<HTMLFormElement>) => void;
  readonly onClear: () => void;
}) {
  if (quote) {
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--h-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--h-accent)_10%,transparent)] px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon name="tag" size={16} className="shrink-0 text-[var(--h-accent)]" />
          <div className="min-w-0">
            <p dir="ltr" className="truncate text-right text-[14px] font-semibold">
              {quote.code}
            </p>
            <p className="text-[12px] text-[var(--h-accent)]">{discountCaption(quote)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-[var(--h-muted)] transition hover:bg-[var(--h-chip)] hover:text-[var(--h-text)]"
        >
          حذف
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onApply} className="mt-4" aria-busy={pending}>
      <label htmlFor="discount-code" className="text-[13px] font-medium">
        کد تخفیف
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="discount-code"
          data-testid="checkout-discount"
          value={draft}
          maxLength={32}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          placeholder="OFF20"
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'discount-code-error' : undefined}
          onChange={(event) => onDraft(event.target.value)}
          className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--h-line)] bg-[var(--h-field)] px-3.5 text-left text-[14px] text-[var(--h-text)] outline-none transition placeholder:text-[var(--h-muted)] focus:border-[var(--h-accent)] disabled:opacity-60"
        />
        <button
          type="submit"
          data-testid="checkout-discount-apply"
          disabled={pending || draft.trim().length === 0}
          className="h-11 shrink-0 rounded-full border border-[var(--h-line)] bg-[var(--h-chip)] px-4 text-[13px] font-semibold transition hover:bg-[var(--h-soft)] disabled:cursor-default disabled:opacity-50"
        >
          {pending ? 'بررسی' : 'اعمال'}
        </button>
      </div>
      {pending ? (
        <p className="mt-2 text-[12.5px] leading-5 text-[var(--h-muted)]" aria-live="polite">
          در حال بررسی کد…
        </p>
      ) : null}
      {error ? (
        <p
          id="discount-code-error"
          role="alert"
          className="mt-2 text-[12.5px] leading-5 text-[var(--tc-down)]"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}

function discountCaption(quote: DiscountQuote): string {
  if (quote.label) return quote.label;
  return quote.kind === 'percent'
    ? `${faNum(quote.value)}٪ تخفیف`
    : `${faNum(quote.value)} تومان تخفیف`;
}
