export const MID_TOMAN = 199_000;
export const PRO_TOMAN = 399_000;

export type BillingCycle = 'month' | 'year';

export const SUBSCRIPTION_PLANS = [
  {
    id: 'beginner',
    name: 'مبتدی',
    blurb: 'تمرین را از همین‌جا شروع کنید',
    points: [
      '۲ جلسه بک‌تست',
      'فقط نماد طلا',
      'تاریخ تا یک ماه گذشتهٔ بازار',
      '۱ بار شرکت در نبرد',
      'دفتر معاملات',
    ],
    unlimited: false,
  },
  {
    id: 'mid',
    name: 'متوسط',
    blurb: 'تمرین را دقیق‌تر و منظم‌تر کنید',
    points: [
      '۱۵ جلسه بک‌تست',
      'کل تاریخ بازار',
      'فلزات، فارکس و کریپتو',
      'جلسه پراپ و آمار کامل',
      'نبرد رتبه‌ای',
      'ابزار ترسیم',
    ],
    unlimited: false,
  },
  {
    id: 'pro',
    name: 'حرفه‌ای',
    blurb: 'هرچه برای تمرین جدی لازم است',
    points: [
      'جلسه بک‌تست نامحدود',
      'کل تاریخ بازار',
      'فلزات، فارکس، کریپتو، شاخص‌ها و انواع نمودار',
      'آمار و شبیه‌ساز ریسک به ریوارد',
      'نبرد نامحدود',
    ],
    unlimited: true,
  },
] as const;

export const SUBSCRIPTION_SETTINGS_HREF = '/home/settings?tab=subscription';

export type PaidPlanId = 'mid' | 'pro';

export function isPaidPlan(id: string): id is PaidPlanId {
  return id === 'mid' || id === 'pro';
}

export function billingCycleOf(value: string | undefined): BillingCycle {
  return value === 'year' ? 'year' : 'month';
}

/** Monthly price before the yearly multiplier. */
export function monthlyAmount(planId: PaidPlanId): number {
  return planId === 'mid' ? MID_TOMAN : PRO_TOMAN;
}

export function subscriptionAmount(planId: PaidPlanId, cycle: BillingCycle): number {
  const base = monthlyAmount(planId);
  return cycle === 'year' ? base * 12 : base;
}

/** Code carried in the checkout URL. Empty when the query has none. */
export function discountCodeQuery(value: string | undefined): string {
  return (value ?? '').trim().slice(0, 32);
}

export function checkoutPath(planId: PaidPlanId, cycle: BillingCycle, code?: string): string {
  const params = new URLSearchParams({ plan: planId, cycle });
  const clean = discountCodeQuery(code);
  if (clean) params.set('code', clean);
  return `/home/checkout?${params.toString()}`;
}

/**
 * Where checkout sends the buyer. The bank gateway behind this path is not built yet;
 * the page only marks the handoff.
 */
export function paymentGatewayPath(planId: PaidPlanId, cycle: BillingCycle, code?: string): string {
  const params = new URLSearchParams({ plan: planId, cycle });
  const clean = discountCodeQuery(code);
  if (clean) params.set('code', clean);
  return `/home/checkout/pay?${params.toString()}`;
}
