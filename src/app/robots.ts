import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/api', '/checkout', '/cart', '/auth'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
