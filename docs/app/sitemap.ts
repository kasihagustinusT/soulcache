import { MetadataRoute } from 'next';
import { source } from '@/lib/source';

const BASE_URL = 'https://soulcache.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/docs/installation`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/docs/quick-start`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
  ];

  const docPages: MetadataRoute.Sitemap = source
    .generateParams()
    .map((param) => {
      const slug = (param.slug ?? []).join('/');
      return {
        url: `${BASE_URL}/docs/${slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      };
    })
    .filter((entry) => !entry.url.endsWith('/docs/'));

  return [...staticPages, ...docPages];
}
