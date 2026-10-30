import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingDoc } from '@/components/marketing/MarketingDoc';
import { caseStudiesOnly, guidePath, guidesOnly } from '@/lib/seo/guides';
import { absoluteUrl } from '@/lib/seo/site';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'راهنما و مقالات | Candelo',
  description:
    'راهنماهای فارسی بک‌تست، بازپخش کندل، ژورنال معامله، مدیریت ریسک و مطالعات موردی تمرین در Candelo.',
  alternates: { canonical: absoluteUrl('/guides') },
  openGraph: {
    title: 'راهنما و مقالات Candelo',
    description: 'آموزش تمرین معامله بدون سرمایه واقعی.',
    url: absoluteUrl('/guides'),
    locale: 'fa_IR',
    images: [{ url: absoluteUrl('/og.png'), width: 1200, height: 630 }],
  },
};

export default function GuidesIndexPage() {
  const guides = guidesOnly();
  const cases = caseStudiesOnly();

  return (
    <MarketingDoc title="راهنما و مقالات">
      <p>
        مجموعه‌ای از مطالب آموزشی برای تمرین ساختاریافته: از مفهوم بک‌تست تا ژورنال و تفاوت با حساب
        دمو. این صفحات برای یادگیری‌اند، نه سیگنال یا توصیه سرمایه‌گذاری.
      </p>

      <h2>راهنماها</h2>
      <ul>
        {guides.map((g) => (
          <li key={g.slug}>
            <Link href={guidePath(g.slug)}>{g.title}</Link>
            <span className="text-[#7d8bac]"> — {g.description}</span>
          </li>
        ))}
      </ul>

      <h2>مطالعات موردی</h2>
      <ul>
        {cases.map((g) => (
          <li key={g.slug}>
            <Link href={guidePath(g.slug)}>{g.title}</Link>
            <span className="text-[#7d8bac]"> — {g.description}</span>
          </li>
        ))}
      </ul>

      <p>
        <Link href="/lessons">مرکز آموزش Candelo</Link>
        {' · '}
        <Link href="/pricing">مشاهده قیمت‌ها</Link>
        {' · '}
        <Link href="/about">درباره Candelo</Link>
      </p>
    </MarketingDoc>
  );
}
