import { createAdminClient } from '@/lib/supabase-admin';
import { isAllowedPhone } from '@/lib/catalogModels';
import { productUrl } from '@/lib/productUrl';

// Un lien par modèle (variante au plus petit id = URL stable), même source et
// mêmes règles que sitemap.ts : v_catalog_products paginée par .range(),
// iPhone < 11 exclus. Sert la liste « Tous nos modèles » rendue côté serveur
// sous le catalogue client (les robots n'y voient sinon aucun lien fiche).
export interface CatalogModelLink {
  label: string;
  href: string;
}

export async function getCatalogModelLinks(): Promise<CatalogModelLink[]> {
  try {
    const supabase = createAdminClient();
    const PAGE = 1000;
    const rows: Array<{
      id: string;
      brand: string | null;
      model: string | null;
      storage_capacity: string | null;
      grade: string | null;
      color: string | null;
    }> = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('v_catalog_products')
        .select('id, brand, model, storage_capacity, grade, color')
        .eq('is_active', true)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }

    const seen = new Set<string>();
    const links: CatalogModelLink[] = [];
    for (const p of rows) {
      if (!p.model || !isAllowedPhone(p.brand, p.model)) continue;
      const key = `${p.brand}|${p.model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ label: p.model, href: productUrl(p) });
    }
    return links.sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true }));
  } catch {
    return [];
  }
}
