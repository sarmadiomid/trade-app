import type { MetadataRoute } from 'next';
import { GUIDES, guidePath } from '@/lib/seo/guides';
import { SITE_URL } from '@/lib/seo/site';

/** Public marketing + education URLs only. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const core: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/lessons`, lastModified, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${SITE_URL}/guides`, lastModified, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${SITE_URL}/about`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const articles: MetadataRoute.Sitemap = GUIDES.map((g) => ({
    url: `${SITE_URL}${guidePath(g.slug)}`,
    lastModified: new Date(g.updated),
    changeFrequency: 'monthly' as const,
    priority: 0.75,
  }));

  return [...core, ...articles];
}
