import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase-admin';
import { isAllowedPhone } from '@/lib/catalogModels';
import { productUrl } from '@/lib/productUrl';
import { resolveProductImage } from '@/lib/productImage';
import type { RawProduct } from '@/lib/productVariants';

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

  // Fiches produit : 1 URL par modèle = variante au plus petit id (URL stable
  // d'un run à l'autre). Source = v_catalog_products, comme la fiche et le flux
  // Shopping. Pagination .range() par tranches de 1000 (plafond PostgREST) :
  // sans elle, les modèles au-delà de 1000 lignes (iPhone 11 à 16) disparaissaient.
  // Tolérant aux pannes : si la DB est injoignable (build sans env), on sert
  // au moins les routes statiques.
  try {
    const supabase = createAdminClient();
    const PAGE = 1000;
    const rows: RawProduct[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('v_catalog_products')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...((data as RawProduct[]) || []));
      if (!data || data.length < PAGE) break;
    }

    const seenModels = new Set<string>();
    const productRoutes: MetadataRoute.Sitemap = [];
    for (const p of rows) {
      if (!isAllowedPhone(p.brand, p.model)) continue; // iPhone < 11 exclus
      const key = `${p.brand}|${p.model}`;
      if (seenModels.has(key)) continue; // tri par id croissant → plus petit id gagne
      seenModels.add(key);
      const img = resolveProductImage(
        { brand: p.brand, model: p.model, images: p.images || [] },
        p.color,
      );
      const images = img.startsWith('data:')
        ? undefined
        : [img.startsWith('http') ? img : `${BASE_URL}${img}`];
      const updated = (p as { updated_at?: string | null }).updated_at;
      productRoutes.push({
        url: `${BASE_URL}${productUrl(p)}`, // slug canonique (plus d'UUID)
        lastModified: updated ? new Date(updated) : undefined,
        changeFrequency: 'weekly',
        priority: 0.8,
        images,
      });
    }
    return [...staticRoutes, ...productRoutes];
  } catch {
    return staticRoutes;
  }
}
