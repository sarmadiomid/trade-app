import Link from 'next/link';
import type { Guide, GuideBlock } from '@/lib/seo/guides';
import { guidePath, GUIDES } from '@/lib/seo/guides';
import { absoluteUrl } from '@/lib/seo/site';
import { MarketingDoc } from './MarketingDoc';

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case 'p':
      return <p>{block.text}</p>;
    case 'h2':
      return <h2>{block.text}</h2>;
    case 'ul':
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case 'callout':
      return (
        <p className="rounded-xl border border-[#2f7bff]/35 bg-[#2f7bff]/10 px-4 py-3 text-[#cfe0ff]">
          {block.text}
        </p>
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

export function GuideArticle({ guide }: { guide: Guide }) {
  const related = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);
  const kindLabel = guide.kind === 'case-study' ? 'مطالعه موردی' : 'راهنما';

  return (
    <>
      <GuideJsonLd guide={guide} />
      <MarketingDoc title={guide.title}>
        <p className="!mt-0 text-[13px] text-[#8b98b8]">
          {kindLabel}
          {' · '}
          حدود {guide.minutes} دقیقه مطالعه
          {' · '}
          به‌روزرسانی {guide.updated}
        </p>
        <p className="text-[#d5def5]">{guide.description}</p>
        {guide.body.map((block, i) => (
          <Block key={`${block.type}-${i}`} block={block} />
        ))}
        <h2>ادامه یادگیری</h2>
        <ul>
          {related.map((g) => (
            <li key={g.slug}>
              <Link href={guidePath(g.slug)}>{g.title}</Link>
            </li>
          ))}
        </ul>
        <p>
          <Link href="/guides">همه راهنماها</Link>
          {' · '}
          <Link href="/lessons">مرکز آموزش</Link>
          {' · '}
          <Link href="/pricing">قیمت‌ها</Link>
          {' · '}
          <Link href="/login">شروع تمرین</Link>
        </p>
      </MarketingDoc>
    </>
  );
}
