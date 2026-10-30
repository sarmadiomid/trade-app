import type { Metadata } from 'next';
import Link from 'next/link';
import { Vazirmatn } from 'next/font/google';
import { Logo } from '@/components/marketing/Logo';
import { caseStudiesOnly, guidePath, guidesOnly } from '@/lib/seo/guides';
import { absoluteUrl } from '@/lib/seo/site';
import './lessons-public.css';

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-vazirmatn',
});

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'آموزش معامله و بک‌تست | Candelo',
  description:
    'مرکز آموزش Candelo: راهنماهای بک‌تست و بازپخش، مطالعات موردی، و مسیر تمرین بدون سرمایه واقعی.',
  alternates: { canonical: absoluteUrl('/lessons') },
  openGraph: {
    title: 'مرکز آموزش Candelo',
    description: 'از مفهوم بک‌تست تا ژورنال و تمرین ساختاریافته.',
    url: absoluteUrl('/lessons'),
    locale: 'fa_IR',
    images: [{ url: absoluteUrl('/og.png'), width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
};

const WRAP = 'mx-auto w-full max-w-3xl px-5 py-12 lg:px-8 lg:py-16';

export default function LessonsHubPage() {
  const guides = guidesOnly();
  const cases = caseStudiesOnly();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'مرکز آموزش Candelo',
    description:
      'راهنماها و مطالعات موردی برای تمرین معامله با بازپخش و بک‌تست بدون سرمایه واقعی.',
    url: absoluteUrl('/lessons'),
    inLanguage: 'fa-IR',
    isPartOf: { '@type': 'WebSite', name: 'Candelo', url: absoluteUrl('/') },
    hasPart: GUIDES_MINI(),
  };

  return (
    <div
      className={`${vazirmatn.variable} ${vazirmatn.className} lessons-public h-full overflow-y-auto overflow-x-hidden bg-[#04070f] text-[#e8eefc]`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" aria-label="خانه">
            <Logo />
          </Link>
          <Link href="/login" className="text-[13px] font-semibold text-[#9cc4ff] hover:text-white">
            ورود
          </Link>
        </div>
      </header>

      <main className={WRAP}>
        <p className="text-xs font-semibold text-[#9cc4ff]">آموزش</p>
        <h1 className="mt-3 text-[28px] font-black leading-[1.4] text-white sm:text-[36px]">
          مرکز آموزش Candelo
        </h1>
        <p className="mt-5 text-[15px] leading-8 text-[#b7c3de]">
          اینجا مسیر یادگیری عمومی است: اول مفاهیم (بک‌تست، بازپخش، ژورنال، ریسک)، بعد مطالعات موردی،
          سپس تمرین داخل حساب با بازپخش بازار. درس‌های تعاملی روی نمودار به‌تدریج اضافه می‌شوند؛ تا آن
          زمان از راهنماها و بخش تمرین استفاده کنید.
        </p>

        <section className="mt-12">
          <h2 className="text-[18px] font-bold text-white">مسیر پیشنهادی</h2>
          <ol className="mt-4 list-decimal space-y-3 ps-5 text-[15px] leading-8 text-[#b7c3de]">
            <li>
              <Link href={guidePath('backtest-chist')} className="text-[#8cbcff] hover:text-white">
                بک‌تست چیست
              </Link>{' '}
              و{' '}
              <Link href={guidePath('replay-candle')} className="text-[#8cbcff] hover:text-white">
                بازپخش کندل
              </Link>
            </li>
            <li>
              <Link
                href={guidePath('risk-management-practice')}
                className="text-[#8cbcff] hover:text-white"
              >
                مدیریت ریسک در تمرین
              </Link>{' '}
              و{' '}
              <Link href={guidePath('trading-journal')} className="text-[#8cbcff] hover:text-white">
                ژورنال معامله
              </Link>
            </li>
            <li>
              یک مطالعه موردی بخوانید، بعد{' '}
              <Link href="/login" className="text-[#8cbcff] hover:text-white">
                وارد حساب شوید
              </Link>{' '}
              و یک جلسه کوتاه بسازید
            </li>
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-[18px] font-bold text-white">راهنماها</h2>
          <ul className="mt-4 space-y-3">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link
                  href={guidePath(g.slug)}
                  className="font-semibold text-[#8cbcff] hover:text-white"
                >
                  {g.title}
                </Link>
                <p className="mt-1 text-[13px] leading-7 text-[#7d8bac]">{g.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-[18px] font-bold text-white">مطالعات موردی</h2>
          <ul className="mt-4 space-y-3">
            {cases.map((g) => (
              <li key={g.slug}>
                <Link
                  href={guidePath(g.slug)}
                  className="font-semibold text-[#8cbcff] hover:text-white"
                >
                  {g.title}
                </Link>
                <p className="mt-1 text-[13px] leading-7 text-[#7d8bac]">{g.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-2xl border border-white/[0.08] bg-[#080c17] p-6">
          <h2 className="text-[18px] font-bold text-white">تمرین روی نمودار</h2>
          <p className="mt-3 text-[14px] leading-8 text-[#8b98b8]">
            برای ساخت جلسه بک‌تست و بازپخش، وارد حساب شوید. کارگاه تعاملی درس‌های نموداری (در حال
            توسعه) از مسیر جداگانه در دسترس تیم محصول است و برای موتورهای جستجو ایندکس نمی‌شود.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-xl bg-[#2f7bff] px-4 text-[13px] font-bold text-white"
            >
              شروع تمرین
            </Link>
            <Link
              href="/guides"
              className="inline-flex h-10 items-center rounded-xl border border-white/15 px-4 text-[13px] font-semibold text-[#dbe4f8]"
            >
              همه مقالات
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center rounded-xl border border-white/15 px-4 text-[13px] font-semibold text-[#dbe4f8]"
            >
              قیمت‌ها
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-5 py-6 text-[13px] text-[#7d8bac] lg:px-8">
          <Link href="/" className="hover:text-white">
            خانه
          </Link>
          <Link href="/about" className="hover:text-white">
            درباره ما
          </Link>
          <Link href="/privacy" className="hover:text-white">
            حریم خصوصی
          </Link>
          <Link href="/terms" className="hover:text-white">
            شرایط استفاده
          </Link>
        </div>
      </footer>
    </div>
  );
}

function GUIDES_MINI() {
  return [...guidesOnly(), ...caseStudiesOnly()].map((g) => ({
    '@type': 'CreativeWork',
    name: g.title,
    url: absoluteUrl(guidePath(g.slug)),
    description: g.description,
  }));
}
