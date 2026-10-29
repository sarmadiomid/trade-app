import Link from 'next/link';
import { faNum } from '@/lib/locale/jalali';
import { HomeShell, ShellMenuButton, ShellTools } from '../home/HomeShell';
import type { Me } from '../platform/api';
import { Icon } from '../ui/Icon';
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_SETTINGS_HREF,
  checkoutPath,
  type BillingCycle,
  type PaidPlanId,
} from './plans';

export interface ShownReceipt {
  readonly status: 'pending' | 'paid' | 'canceled' | 'failed';
  readonly planId: PaidPlanId;
  readonly cycle: BillingCycle;
  readonly amount: number;
  readonly refId: string | null;
  readonly cardPan: string | null;
  readonly failureMessage: string | null;
}

export function PaymentResult({
  user,
  receipt,
  problem,
}: {
  readonly user: Me;
  readonly receipt: ShownReceipt | null;
  /** Set when the bank return could not be matched to an order. */
  readonly problem: 'missing' | 'error' | null;
}) {
  const plan = SUBSCRIPTION_PLANS.find((item) => item.id === receipt?.planId);
  const back = receipt ? checkoutPath(receipt.planId, receipt.cycle) : SUBSCRIPTION_SETTINGS_HREF;
  const paid = receipt?.status === 'paid';
  const pending = receipt?.status === 'pending' || problem === 'error';

  return (
    <HomeShell user={user} notices={0} noticeMenu={null}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-3 px-4 pt-4 sm:px-8 sm:pt-5">
          <ShellMenuButton />
          <h1 className="order-last w-full text-[22px] font-bold leading-none sm:order-none sm:w-auto sm:flex-1 sm:text-[26px]">
            نتیجه پرداخت
          </h1>
          <div className="ms-auto">
            <ShellTools />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="flex w-full max-w-md flex-col items-center text-center">
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] ${
                paid ? 'text-[var(--tc-up)]' : 'text-[var(--h-accent)]'
              }`}
            >
              <Icon name={paid ? 'check' : pending ? 'clock' : 'close'} size={28} />
            </span>
            <h2 className="mt-5 text-[24px] font-extrabold leading-tight sm:text-[28px]">
              {titleOf(receipt, problem)}
            </h2>
            <p className="mt-3 text-[15px] leading-8 text-[var(--h-muted)]">
              {bodyOf(receipt, problem, plan?.name ?? null)}
            </p>
            {paid && receipt ? (
              <dl className="mt-5 w-full rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] px-4 py-3 text-[13.5px]">
                <ResultRow
                  k="مبلغ"
                  v={receipt.amount === 0 ? 'رایگان' : `${faNum(receipt.amount)} تومان`}
                />
                {receipt.refId ? <ResultRow k="شماره تراکنش" v={receipt.refId} ltr /> : null}
                {receipt.cardPan ? <ResultRow k="کارت" v={receipt.cardPan} ltr /> : null}
              </dl>
            ) : null}
            <Link
              href={paid || !receipt ? SUBSCRIPTION_SETTINGS_HREF : back}
              className="mt-6 inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--h-accent)] px-5 text-[14px] font-semibold text-white"
            >
              <Icon name="chevronLeft" size={15} className="rtl:-scale-x-100" />
              {paid ? 'رفتن به اشتراک' : receipt ? 'بازگشت به تسویه حساب' : 'بازگشت به طرح‌ها'}
            </Link>
          </div>
        </div>
      </div>
    </HomeShell>
  );
}

function titleOf(receipt: ShownReceipt | null, problem: 'missing' | 'error' | null): string {
  if (!receipt) return problem === 'error' ? 'تأیید پرداخت انجام نشد' : 'پرداخت پیدا نشد';
  if (receipt.status === 'paid') return 'پرداخت انجام شد';
  if (receipt.status === 'canceled') return 'پرداخت لغو شد';
  if (receipt.status === 'pending') return 'پرداخت هنوز تأیید نشده';
  return 'پرداخت ناموفق بود';
}

function bodyOf(
  receipt: ShownReceipt | null,
  problem: 'missing' | 'error' | null,
  planName: string | null,
): string {
  if (!receipt) {
    return problem === 'error'
      ? 'اگر پرداخت را انجام داده‌اید، یک بار دیگر از صفحه درگاه به کندلو برگردید.'
      : 'این پرداخت برای حساب شما پیدا نشد.';
  }
  if (receipt.status === 'paid') {
    return planName ? `طرح ${planName} روی حساب شما فعال شد.` : 'طرح روی حساب شما فعال شد.';
  }
  if (receipt.status === 'canceled') return 'مبلغی از حساب شما کم نشده است.';
  if (receipt.status === 'pending') {
    return 'اگر مبلغ کم شده، چند دقیقه دیگر از لینک بازگشت درگاه دوباره وارد شوید.';
  }
  return receipt.failureMessage ?? 'مبلغی از حساب شما کم نشده است.';
}

function ResultRow({
  k,
  v,
  ltr = false,
}: {
  readonly k: string;
  readonly v: string;
  readonly ltr?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-[var(--h-muted)]">{k}</dt>
      <dd dir={ltr ? 'ltr' : undefined} className="text-end font-semibold tabular-nums">
        {v}
      </dd>
    </div>
  );
}
