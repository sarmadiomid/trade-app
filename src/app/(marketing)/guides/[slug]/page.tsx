import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuideArticle } from '@/components/marketing/GuideArticle';
import { GUIDES, getGuide, guidePath } from '@/lib/seo/guides';
import { absoluteUrl } from '@/lib/seo/site';

export const revalidate = 3600;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  const url = absoluteUrl(guidePath(guide.slug));
  return {
    title: `${guide.title} | Candelo`,
    description: guide.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      locale: 'fa_IR',
      url,
      title: guide.title,
      description: guide.description,
      publishedTime: guide.published,
      modifiedTime: guide.updated,
      images: [{ url: absoluteUrl('/og.png'), width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: guide.title,
      description: guide.description,
      images: [absoluteUrl('/og.png')],
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  return <GuideArticle guide={guide} />;
}
