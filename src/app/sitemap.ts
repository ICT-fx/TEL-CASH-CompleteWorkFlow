import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase-admin';
import { isAllowedPhone } from '@/lib/catalogModels';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';

export const revalidate = 3600; // régénéré au plus toutes les heures

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/engagements`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/reconditionnement`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/qui-sommes-nous`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/contact`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/retours`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/cgv`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/mentions`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/confidentialite`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  // Fiches produit : meilleure URL connue = 1 SKU représentatif par modèle.
  // Tolérant aux pannes : si la DB est injoignable (build sans env), on sert
  // au moins les routes statiques.
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('products')
      .select('id, brand, model, updated_at, stock')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const seenModels = new Set<string>();
    const productRoutes: MetadataRoute.Sitemap = [];
    for (const p of data || []) {
      if (!isAllowedPhone(p.brand, p.model)) continue; // iPhone < 11 exclus
      const key = `${p.brand}|${p.model}`;
      if (seenModels.has(key)) continue;
      seenModels.add(key);
      productRoutes.push({
        url: `${BASE_URL}/products/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
    return [...staticRoutes, ...productRoutes];
  } catch {
    return staticRoutes;
  }
}
