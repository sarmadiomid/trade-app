import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingDoc } from '@/components/marketing/MarketingDoc';
import { SUPPORT_EMAIL } from '@/lib/support/catalog';
import { absoluteUrl } from '@/lib/seo/site';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'درباره ما | Candelo',
  description:
    'Candelo (کندلو) محیط تمرین معامله به زبان فارسی است: بازپخش بازار، حساب مجازی، ژورنال و آمار — بدون ریسک سرمایه واقعی.',
  alternates: { canonical: absoluteUrl('/about') },
  openGraph: {
    title: 'درباره Candelo',
    description: 'محیط تمرین معامله با بازپخش کندل‌به‌کندل و حساب مجازی.',
    url: absoluteUrl('/about'),
    locale: 'fa_IR',
    images: [{ url: absoluteUrl('/og.png'), width: 1200, height: 630 }],
  },
};

export default function AboutPage() {
  return (
    <MarketingDoc title="درباره Candelo">
      <p>
        <strong className="text-white">Candelo (کندلو)</strong> یک پلتفرم تحت وب برای تمرین معامله است.
        به‌جای ریسک روی سرمایه واقعی، بازار را به گذشته برمی‌گردانید، کندل‌به‌کندل پیش می‌روید و با حساب
        مجازی معامله می‌کنید تا ببینید استراتژی‌تان روی تاریخ چه می‌کند.
      </p>
      <h2>چه کاری انجام می‌دهیم</h2>
      <ul>
        <li>بازپخش تاریخی بازار روی نمادهایی مثل طلا، فارکس و کریپتو (بر اساس طرح)</li>
        <li>ثبت ورود، حد ضرر، حد سود و حجم با اسپرد روی قیمت</li>
        <li>ژورنال و آمار جلسه: نرخ برد، فاکتور سود، افت سرمایه</li>
        <li>مسابقه و نبرد روی همان بازه تاریخی با امتیاز الو</li>
      </ul>
      <h2>چه کاری انجام نمی‌دهیم</h2>
      <p>
        Candelo کارگزاری نیست، سیگنال فروش نمی‌دهد و توصیه سرمایه‌گذاری ارائه نمی‌کند. محیط تمرین و
        آموزش است. تصمیم‌های مالی شما بر عهده خودتان است.
      </p>
      <h2>تماس</h2>
      <p>
        برای پشتیبانی می‌توانید از بخش پشتیبانی داخل حساب استفاده کنید یا به{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> پیام بدهید.
      </p>
      <p>
        <Link href="/#pricing">مشاهده طرح‌ها و قیمت‌ها</Link>
        {' · '}
        <Link href="/privacy">حریم خصوصی</Link>
        {' · '}
        <Link href="/terms">شرایط استفاده</Link>
      </p>
    </MarketingDoc>
  );
}
