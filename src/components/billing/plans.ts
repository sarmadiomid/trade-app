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

export function subscriptionAmount(planId: 'mid' | 'pro', cycle: BillingCycle): number {
  const base = planId === 'mid' ? MID_TOMAN : PRO_TOMAN;
  return cycle === 'year' ? base * 12 : base;
}
