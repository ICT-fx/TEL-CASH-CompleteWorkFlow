import { createAdminClient } from '@/lib/supabase-admin';
import { buildVariantMatrix, type RawProduct } from '@/lib/productVariants';
import { resolveProductImage } from '@/lib/productImage';
import { isAllowedPhone } from '@/lib/catalogModels';
import { productUrl } from '@/lib/productUrl';
import { displayGradeLabelFr } from '@/lib/products';
import { SHIPPING_FEE_EUR } from '@/lib/shipping';

// Flux RSS 2.0 (namespace g:) pour Google Merchant Center : une entrée par
// variante vendable (stockage × grade × couleur) des smartphones du magasin.
// Même source de données et mêmes règles que la fiche produit
// (v_catalog_products, iPhone < 11 exclus, accessoires exclus, prix > 0 et non
// grisé fournisseur). À brancher dans Merchant Center : « Flux programmé » →
// https://telandcash.fr/google-shopping.xml

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';

export const revalidate = 3600;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isAccessory(p: RawProduct): boolean {
  const cat = String((p as { category?: string | null }).category || '').toLowerCase();
  const catId = String((p as { category_id?: string | null }).category_id || '');
  return cat === 'accessoires' || catId === 'a0000000-0000-0000-0000-000000000002';
}

export async function GET() {
  let rows: RawProduct[] = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('v_catalog_products')
      .select('*')
      .eq('is_active', true);
    rows = (data as RawProduct[]) || [];
  } catch {
    rows = [];
  }

  const byModel = new Map<string, RawProduct[]>();
  for (const p of rows) {
    if (!p.brand || !p.model || isAccessory(p) || !isAllowedPhone(p.brand, p.model)) continue;
    const key = `${p.brand}|${p.model}`;
    const bucket = byModel.get(key);
    if (bucket) bucket.push(p);
    else byModel.set(key, [p]);
  }

  const items: string[] = [];
  for (const siblings of byModel.values()) {
    const matrix = buildVariantMatrix(siblings);
    for (const v of matrix.variants) {
      if (!(v.price > 0) || v.greyedBySupplier) continue;
      const sku = siblings.find((s) => s.id === v.skuId);
      if (!sku) continue;
      const image = resolveProductImage(
        { brand: sku.brand, model: sku.model, images: sku.images || [] },
        sku.color,
      );
      if (image.startsWith('data:')) continue; // Merchant Center exige une vraie image
      const imageUrl = image.startsWith('http') ? image : `${BASE_URL}${image}`;
      const name = `${sku.brand} ${sku.model}`.trim();
      const parts = [v.storage, v.color].filter((x) => x && x !== '—');
      const gradeLabel = displayGradeLabelFr(v.grade);
      const title = `${name}${parts.length ? ' ' + parts.join(' ') : ''} reconditionné - ${gradeLabel}`;
      const description = `${name} reconditionné${v.storage !== '—' ? ' ' + v.storage : ''}, état ${gradeLabel} (Grade ${v.grade}). Testé et certifié en France, garanti 24 mois, livraison suivie.`;
      items.push(`    <item>
      <g:id>${esc(v.skuId)}</g:id>
      <g:title>${esc(title)}</g:title>
      <g:description>${esc(description)}</g:description>
      <g:link>${esc(BASE_URL + productUrl(sku))}</g:link>
      <g:image_link>${esc(imageUrl)}</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:condition>refurbished</g:condition>
      <g:price>${v.price.toFixed(2)} EUR</g:price>
      <g:brand>${esc(String(sku.brand))}</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:item_group_id>${esc(`${sku.brand}-${sku.model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}</g:item_group_id>${v.color !== '—' ? `\n      <g:color>${esc(v.color)}</g:color>` : ''}
      <g:shipping>
        <g:country>FR</g:country>
        <g:service>Livraison à domicile</g:service>
        <g:price>${SHIPPING_FEE_EUR.toFixed(2)} EUR</g:price>
      </g:shipping>
    </item>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>TEL &amp; CASH</title>
    <link>${esc(BASE_URL)}</link>
    <description>Smartphones reconditionnés testés et certifiés en France</description>
${items.join('\n')}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
