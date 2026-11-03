import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideCard } from '@/components/marketing/guides/GuideCard';
import { GuidesShell } from '@/components/marketing/guides/GuidesShell';
import { IconBook } from '@/components/marketing/guides/GuideIcons';
import {
  GUIDE_BTN_GHOST,
  GUIDE_BTN_PRIMARY,
  GUIDE_WRAP,
} from '@/components/marketing/guides/guides-ui';
import { caseStudiesOnly, guidePath, guidesOnly, GUIDES } from '@/lib/seo/guides';
import { absoluteUrl } from '@/lib/seo/site';
import { faNum } from '@/lib/locale/jalali';

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

type KindFilter = 'all' | 'guide' | 'case-study';

function parseKind(raw: string | string[] | undefined): KindFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'guide' || value === 'case-study') return value;
  return 'all';
}

const FILTERS: { id: KindFilter; label: string; href: string }[] = [
  { id: 'all', label: 'همه مطالب', href: '/guides' },
  { id: 'guide', label: 'راهنماها', href: '/guides?kind=guide' },
  { id: 'case-study', label: 'مطالعات موردی', href: '/guides?kind=case-study' },
];

export default async function GuidesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string | string[] }>;
}) {
  const { kind: kindRaw } = await searchParams;
  const kind = parseKind(kindRaw);
  const guides = guidesOnly();
  const cases = caseStudiesOnly();
  const items = kind === 'all' ? [...guides, ...cases] : kind === 'guide' ? guides : cases;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'راهنما و مقالات Candelo',
    description:
      'راهنماهای فارسی بک‌تست، بازپخش کندل، ژورنال معامله، مدیریت ریسک و مطالعات موردی تمرین.',
    url: absoluteUrl('/guides'),
    inLanguage: 'fa-IR',
    isPartOf: { '@type': 'WebSite', name: 'Candelo', url: absoluteUrl('/') },
    hasPart: GUIDES.map((g) => ({
      '@type': 'CreativeWork',
      name: g.title,
      url: absoluteUrl(guidePath(g.slug)),
      description: g.description,
    })),
  };

  return (
    <GuidesShell active="guides">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(50% 60% at 80% 0%, rgba(47,123,255,0.28), transparent 70%), radial-gradient(40% 45% at 10% 20%, rgba(56,211,255,0.12), transparent 70%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 75% 65% at 50% 0%, #000 25%, transparent 100%)',
          }}
        />
        <div className={`${GUIDE_WRAP} relative py-10 sm:py-12 lg:py-14`}>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-[#9cc4ff]">
            <IconBook className="h-3.5 w-3.5" />
            بلاگ و آموزش
          </span>
          <h1 className="mt-4 max-w-2xl text-[30px] font-black leading-[1.35] text-balance tracking-tight text-white sm:text-[40px] sm:leading-[1.3]">
            راهنما و مقالات{' '}
            <span className="bg-gradient-to-l from-[#8cbcff] via-[#38d3ff] to-[#2f7bff] bg-clip-text text-transparent">
              Candelo
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-8 text-[#8b98b8] sm:text-[16px] sm:leading-9">
            مطالب آموزشی برای تمرین ساختاریافته: از بک‌تست و بازپخش تا ژورنال و مدیریت ریسک. این صفحات
            برای یادگیری‌اند، نه سیگنال یا توصیه سرمایه‌گذاری.
          </p>
          <p className="mt-3 text-[13px] text-[#7d8bac]">{faNum(GUIDES.length)} مطلب منتشرشده</p>
        </div>
      </section>

      <div className={`${GUIDE_WRAP} py-10 lg:py-12`}>
        <nav className="flex flex-wrap gap-2" aria-label="فیلتر نوع مطلب">
          {FILTERS.map((filter) => {
            const selected = kind === filter.id;
            const count =
              filter.id === 'all'
                ? GUIDES.length
                : filter.id === 'guide'
                  ? guides.length
                  : cases.length;
            return (
              <Link
                key={filter.id}
                href={filter.href}
                aria-current={selected ? 'page' : undefined}
                className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-[background-color,border-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70 ${
                  selected
                    ? 'border-[#2f7bff] bg-[#2f7bff] text-white'
                    : 'border-white/[0.1] bg-white/[0.02] text-[#b7c3de] hover:border-white/20 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {filter.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                    selected ? 'bg-white/20' : 'bg-white/[0.06] text-[#8b98b8]'
                  }`}
                >
                  {faNum(count)}
                </span>
              </Link>
            );
          })}
        </nav>

        {items.length === 0 ? (
          <p className="mt-12 text-[15px] text-[#8b98b8]">مطلبی در این دسته نیست.</p>
        ) : (
          <ul className="mt-8 grid list-none grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {items.map((g, i) => (
              <li key={g.slug}>
                <GuideCard guide={g} priority={i < 3} />
              </li>
            ))}
          </ul>
        )}

        <section className="relative mt-16 overflow-hidden rounded-[20px] border border-white/10 bg-[#070b16] p-7 sm:p-9">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                'radial-gradient(60% 80% at 100% 0%, rgba(47,123,255,0.22), transparent 65%)',
            }}
          />
          <div className="relative max-w-xl">
            <h2 className="text-[22px] font-black text-white text-balance sm:text-[26px]">
              آماده‌ای تمرین را شروع کنی؟
            </h2>
            <p className="mt-3 text-[14px] leading-8 text-[#8b98b8]">
              بعد از خواندن راهنما، یک جلسه بازپخش کوتاه بساز و قوانین را روی نمودار تمرین کن — بدون
              سرمایه واقعی.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login" className={GUIDE_BTN_PRIMARY}>
                شروع تمرین
              </Link>
              <Link href="/lessons" className={GUIDE_BTN_GHOST}>
                مرکز آموزش
              </Link>
              <Link href="/pricing" className={GUIDE_BTN_GHOST}>
                مشاهده قیمت‌ها
              </Link>
            </div>
          </div>
        </section>
      </div>
    </GuidesShell>
  );
}
