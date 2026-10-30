import type { Metadata } from 'next';
import { HomeJsonLd } from '@/components/marketing/JsonLd';
import { Landing } from '@/components/marketing/Landing';
import { SITE_DESCRIPTION, SITE_TITLE, absoluteUrl } from '@/lib/seo/site';

/** Anonymous marketing HTML is ISR-friendly; signed-in CTAs hydrate via /api/auth/session. */
export const revalidate = 600;

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: absoluteUrl('/') },
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    url: absoluteUrl('/'),
    siteName: 'Candelo',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: absoluteUrl('/og.png'),
        width: 1200,
        height: 630,
        alt: 'Candelo — بک‌تست و بازپخش بازار',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [absoluteUrl('/og.png')],
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return (
    <>
      <HomeJsonLd />
      <Landing />
    </>
  );
}
