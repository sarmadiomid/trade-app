import Link from 'next/link';
import type { Guide, GuideBlock } from '@/lib/seo/guides';
import { guidePath, GUIDES } from '@/lib/seo/guides';
import { absoluteUrl } from '@/lib/seo/site';
import { GuideCard } from '@/components/marketing/guides/GuideCard';
import { GuidesShell } from '@/components/marketing/guides/GuidesShell';
import { CopyLinkButton } from '@/components/marketing/guides/CopyLinkButton';
import {
  IconArrowLeft,
  IconBook,
  IconCalendar,
  IconCandles,
  IconCase,
  IconClock,
  IconList,
  IconShare,
} from '@/components/marketing/guides/GuideIcons';
import {
  GUIDE_BTN_GHOST,
  GUIDE_BTN_PRIMARY,
  GUIDE_PROSE_WRAP,
  GUIDE_WRAP,
  coverTone,
  guideDateLabel,
  kindLabel,
  minutesLabel,
} from '@/components/marketing/guides/guides-ui';

function slugifyHeading(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g, '')
    .slice(0, 80);
}

function tocFromBody(body: GuideBlock[]): { id: string; text: string }[] {
  const seen = new Map<string, number>();
  return body
    .filter((b): b is Extract<GuideBlock, { type: 'h2' }> => b.type === 'h2')
    .map((b) => {
      const base = slugifyHeading(b.text) || 'section';
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return { id: n > 1 ? `${base}-${n}` : base, text: b.text };
    });
}

function Block({
  block,
  headingId,
}: {
  block: GuideBlock;
  headingId?: string;
}) {
  switch (block.type) {
    case 'p':
      return <p className="text-[15.5px] leading-9 text-[#b7c3de]">{block.text}</p>;
    case 'h2':
      return (
        <h2
          id={headingId}
          className="scroll-mt-28 text-[20px] font-bold leading-9 text-balance text-white sm:text-[22px]"
        >
          {block.text}
        </h2>
      );
    case 'ul':
      return (
        <ul className="space-y-2.5 ps-5 text-[15px] leading-8 text-[#b7c3de]">
          {block.items.map((item) => (
            <li key={item} className="list-disc marker:text-[#5aa2ff]">
              {item}
            </li>
          ))}
        </ul>
      );
    case 'callout':
      return (
        <aside className="rounded-2xl border border-[#2f7bff]/30 bg-[#2f7bff]/10 px-4 py-3.5 text-[14.5px] leading-8 text-[#cfe0ff]">
          {block.text}
        </aside>
      );
    default:
      return null;
  }
}

export function GuideJsonLd({ guide }: { guide: Guide }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': guide.kind === 'case-study' ? 'Article' : 'TechArticle',
    headline: guide.title,
    description: guide.description,
    datePublished: guide.published,
    dateModified: guide.updated,
    inLanguage: 'fa-IR',
    mainEntityOfPage: absoluteUrl(guidePath(guide.slug)),
    author: {
      '@type': 'Organization',
      name: 'Candelo',
      url: absoluteUrl('/'),
    },
    publisher: {
      '@type': 'Organization',
      name: 'Candelo',
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/logo.png'),
      },
    },
    image: absoluteUrl('/og.png'),
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

function TocNav({
  items,
  showTitle = true,
}: {
  items: { id: string; text: string }[];
  showTitle?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="فهرست مطالب">
      {showTitle ? (
        <p className="mb-3 flex items-center gap-2 text-[12px] font-bold tracking-wide text-[#9cc4ff]">
          <IconList className="h-3.5 w-3.5" />
          فهرست مطالب
        </p>
      ) : null}
      <ol className="space-y-2 border-s border-white/[0.08] ps-3">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="block text-[13px] leading-6 text-[#8b98b8] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70"
            >
              <span className="me-1.5 tabular-nums text-[#5aa2ff]">{i + 1}.</span>
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function GuideArticle({ guide }: { guide: Guide }) {
  const related = GUIDES.filter((g) => g.slug !== guide.slug && g.kind === guide.kind).slice(0, 3);
  const relatedFallback =
    related.length >= 3
      ? related
      : [
          ...related,
          ...GUIDES.filter((g) => g.slug !== guide.slug && !related.some((r) => r.slug === g.slug)),
        ].slice(0, 3);
  const toc = tocFromBody(guide.body);
  const url = absoluteUrl(guidePath(guide.slug));
  const isCase = guide.kind === 'case-study';
  const telegramShare = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(guide.title)}`;

  let h2Index = 0;

  return (
    <>
      <GuideJsonLd guide={guide} />
      <GuidesShell active="guides">
        <section className={`relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-br ${coverTone(guide)}`}>
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden="true"
            style={{
              backgroundImage:
                'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)',
              backgroundSize: '18px 18px',
              maskImage: 'radial-gradient(ellipse 70% 80% at 50% 40%, #000 30%, transparent 80%)',
            }}
          />
          <div
            className={`pointer-events-none absolute -start-20 top-0 h-64 w-64 rounded-full blur-3xl ${
              isCase ? 'bg-[#f5c451]/20' : 'bg-[#2f7bff]/35'
            }`}
            aria-hidden="true"
          />
          <div
            className={`pointer-events-none absolute -end-16 bottom-0 h-56 w-56 rounded-full blur-3xl ${
              isCase ? 'bg-[#ef5b7a]/15' : 'bg-[#38d3ff]/20'
            }`}
            aria-hidden="true"
          />

          <div className={`${GUIDE_PROSE_WRAP} relative py-10 text-center sm:py-12`}>
            <span
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border ${
                isCase
                  ? 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]'
                  : 'border-[#5aa2ff]/35 bg-[#2f7bff]/15 text-[#9cc4ff]'
              }`}
            >
              {isCase ? <IconCase className="h-6 w-6" /> : <IconCandles className="h-6 w-6" />}
            </span>
            <span
              className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                isCase
                  ? 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]'
                  : 'border-white/15 bg-white/10 text-[#cfe0ff]'
              }`}
            >
              <IconBook className="h-3.5 w-3.5" />
              {kindLabel(guide.kind)}
            </span>
            <h1 className="mx-auto mt-4 max-w-3xl text-[26px] font-black leading-[1.4] text-balance tracking-tight text-white sm:text-[34px] sm:leading-[1.35]">
              {guide.title}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-8 text-[#c3d0ec]">
              {guide.description}
            </p>
          </div>
        </section>

        <div className={`${GUIDE_PROSE_WRAP} pt-6`}>
          <nav aria-label="مسیر صفحه" className="flex flex-wrap items-center gap-2 text-[13px] text-[#7d8bac]">
            <Link
              href="/"
              className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70"
            >
              خانه
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              href="/guides"
              className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70"
            >
              راهنماها
            </Link>
            <span aria-hidden="true">/</span>
            <span className="line-clamp-1 text-[#b7c3de]">{kindLabel(guide.kind)}</span>
          </nav>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#080c17] px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#5aa2ff]/25 bg-[#2f7bff]/15 text-[14px] font-bold text-[#9cc4ff]"
                aria-hidden="true"
                translate="no"
              >
                C
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-white" translate="no">
                  تیم Candelo
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#7d8bac]">
                  <span className="inline-flex items-center gap-1.5">
                    <IconCalendar className="h-3.5 w-3.5" />
                    <time dateTime={guide.updated}>{guideDateLabel(guide.updated)}</time>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <IconClock className="h-3.5 w-3.5" />
                    {minutesLabel(guide.minutes)} مطالعه
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={telegramShare}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] text-[#9cc4ff] transition-[background-color,border-color,color] duration-200 hover:border-white/25 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70"
                aria-label="اشتراک در تلگرام"
              >
                <IconShare className="h-4 w-4" />
              </a>
              <CopyLinkButton url={url} />
            </div>
          </div>
        </div>

        <div className={`${GUIDE_WRAP} grid gap-10 py-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12 lg:py-12`}>
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-8">
              <TocNav items={toc} />
              <Link
                href="/guides"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#8cbcff] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70"
              >
                <IconArrowLeft className="h-4 w-4" />
                همه راهنماها
              </Link>
            </div>
          </aside>

          <article className="min-w-0">
            {toc.length > 0 ? (
              <details className="mb-8 rounded-2xl border border-white/[0.08] bg-[#080c17] p-4 lg:hidden">
                <summary className="cursor-pointer list-none text-[14px] font-bold text-white marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-2">
                    <IconList className="h-4 w-4 text-[#9cc4ff]" />
                    فهرست مطالب
                  </span>
                </summary>
                <div className="mt-4">
                  <TocNav items={toc} showTitle={false} />
                </div>
              </details>
            ) : null}

            <div className="space-y-6">
              {guide.body.map((block, i) => {
                if (block.type === 'h2') {
                  const headingId = toc[h2Index++]?.id;
                  return (
                    <Block
                      key={`${block.type}-${i}`}
                      block={block}
                      {...(headingId ? { headingId } : {})}
                    />
                  );
                }
                return <Block key={`${block.type}-${i}`} block={block} />;
              })}
            </div>

            <section className="relative mt-12 overflow-hidden rounded-[20px] border border-white/10 bg-[#070b16] p-6 sm:p-8">
              <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
                style={{
                  background:
                    'radial-gradient(55% 80% at 100% 0%, rgba(47,123,255,0.2), transparent 65%)',
                }}
              />
              <div className="relative">
                <h2 className="text-[20px] font-black text-white text-balance">
                  تمرین را روی نمودار ادامه بده
                </h2>
                <p className="mt-3 text-[14px] leading-8 text-[#8b98b8]">
                  مفاهیم را خواندی؛ حالا یک جلسه بازپخش کوتاه بساز و همان قوانین را بدون ریسک سرمایه
                  واقعی تمرین کن.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/login" className={GUIDE_BTN_PRIMARY}>
                    شروع تمرین
                  </Link>
                  <Link href="/lessons" className={GUIDE_BTN_GHOST}>
                    مرکز آموزش
                  </Link>
                </div>
              </div>
            </section>
          </article>
        </div>

        {relatedFallback.length > 0 ? (
          <section className={`${GUIDE_WRAP} border-t border-white/[0.06] py-12`}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-[22px] font-black text-white">مطالب مرتبط</h2>
              <Link
                href="/guides"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#8cbcff] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7bff]/70"
              >
                مشاهده همه مطالب
                <IconArrowLeft className="h-4 w-4" />
              </Link>
            </div>
            <ul className="mt-7 grid list-none grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedFallback.map((g) => (
                <li key={g.slug}>
                  <GuideCard guide={g} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </GuidesShell>
    </>
  );
}
