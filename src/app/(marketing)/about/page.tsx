import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingDoc } from '@/components/marketing/MarketingDoc';
import { SUPPORT_EMAIL } from '@/lib/support/catalog';
import { absoluteUrl } from '@/lib/seo/site';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'درباره ما | Candelo',
  description:
    'Candelo (کندلو) محیط تمرین معامله به زبان فارسی است: بازپخش بازار، حساب مجازی، ژورنال و آمار — بدون ریسک سرمایه واقعی. با نرم‌افزارهای همنام اشتباه گرفته نشود.',
  alternates: { canonical: absoluteUrl('/about') },
  openGraph: {
    title: 'درباره Candelo (کندلو)',
    description: 'پلتفرم وب تمرین معامله با بازپخش کندل‌به‌کندل — candelo.ir',
    url: absoluteUrl('/about'),
    locale: 'fa_IR',
    images: [{ url: absoluteUrl('/og.png'), width: 1200, height: 630 }],
  },
};

export default function AboutPage() {
  return (
    <MarketingDoc title="درباره Candelo (کندلو)">
      <p>
        <strong className="text-white">Candelo</strong> با نام فارسی <strong className="text-white">کندلو</strong>{' '}
        یک پلتفرم تحت وب در دامنه <span dir="ltr">candelo.ir</span> است برای تمرین معامله. به‌جای ریسک
        روی سرمایه واقعی، بازار را به گذشته برمی‌گردانید، کندل‌به‌کندل پیش می‌روید و با حساب مجازی
        معامله می‌کنید تا ببینید استراتژی‌تان روی تاریخ چه می‌کند.
      </p>

      <h2>هویت برند (برای جلوگیری از اشتباه)</h2>
      <ul>
        <li>
          نام رسمی محصول: <strong className="text-white">Candelo / کندلو</strong>
        </li>
        <li>
          وب‌سایت رسمی: <Link href="/">https://candelo.ir</Link>
        </li>
        <li>زبان محصول: فارسی (رابط و آموزش)</li>
        <li>تمرکز: بازپخش تاریخی، بک‌تست تمرینی، ژورنال، مسابقه/نبرد آموزشی</li>
        <li>پشتیبانی: {SUPPORT_EMAIL}</li>
      </ul>
      <p>
        Candelo با ابزارها یا سایت‌های دیگری که نام شبیه «کندل»، «CandleTest» یا بک‌تست عمومی دارند
        یکی نیست. اگر از لینک یا صفحه دیگری آمده‌اید، دامنه را با{' '}
        <span dir="ltr" className="text-white">
          candelo.ir
        </span>{' '}
        تطبیق دهید.
      </p>

      <h2>چه کاری انجام می‌دهیم</h2>
      <ul>
        <li>بازپخش تاریخی بازار روی نمادهایی مثل طلا، فارکس و کریپتو (بر اساس طرح)</li>
        <li>ثبت ورود، حد ضرر، حد سود و حجم با اسپرد روی قیمت</li>
        <li>ژورنال و آمار جلسه: نرخ برد، فاکتور سود، افت سرمایه</li>
        <li>مسابقه و نبرد روی همان بازه تاریخی با امتیاز رتبه‌ای</li>
        <li>
          محتوای آموزشی عمومی در <Link href="/lessons">مرکز آموزش</Link> و{' '}
          <Link href="/guides">راهنماها</Link>
        </li>
      </ul>

      <h2>چه کاری انجام نمی‌دهیم</h2>
      <p>
        Candelo کارگزاری نیست، سیگنال فروش نمی‌دهد، مدیریت دارایی نمی‌کند و توصیه سرمایه‌گذاری ارائه
        نمی‌کند. محیط تمرین و آموزش است. تصمیم‌های مالی شما بر عهده خودتان است.
      </p>

      <h2>تماس</h2>
      <p>
        برای پشتیبانی از بخش پشتیبانی داخل حساب استفاده کنید یا به{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> پیام بدهید.
      </p>
      <p>
        <Link href="/pricing">قیمت و طرح‌ها</Link>
        {' · '}
        <Link href="/privacy">حریم خصوصی</Link>
        {' · '}
        <Link href="/terms">شرایط استفاده</Link>
      </p>
    </MarketingDoc>
  );
}
