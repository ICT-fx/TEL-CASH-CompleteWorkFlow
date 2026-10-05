import { createAdminClient } from '@/lib/supabase-admin';
import { isAllowedPhone } from '@/lib/catalogModels';
import { resolveProductImage } from '@/lib/productImage';
import { productUrl } from '@/lib/productUrl';
import { displayGradeLabelFr } from '@/lib/products';
import { SHIPPING_FEE_EUR } from '@/lib/shipping';
import type { RawProduct } from '@/lib/productVariants';

// Flux RSS 2.0 / Google Merchant Center : une entrée par SKU vendable (prix > 0,
// non grisé fournisseur — la vue v_catalog_products ne contient que source='manual').
// Lecture seule, aucune écriture. À brancher dans Merchant Center par Yanis.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';

export const revalidate = 3600;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

  const items: string[] = [];
  for (const p of rows) {
    const cat = String(p.category || '').toLowerCase();
    if (cat === 'accessoires' || p.category_id === 'a0000000-0000-0000-0000-000000000002') continue;
    if (!isAllowedPhone(p.brand, p.model)) continue;
    const price = Number(p.price);
    if (!Number.isFinite(price) || price <= 0 || p.greyed_by_supplier) continue;

    const img = resolveProductImage(
      { brand: p.brand, model: p.model, images: p.images || [] },
      p.color,
    );
    if (img.startsWith('data:')) continue; // pas de placeholder dans le flux
    const imageUrl = img.startsWith('http') ? img : `${BASE_URL}${img}`;

    const name = `${p.brand} ${p.model}`.trim();
    const grade = displayGradeLabelFr(p.grade);
    const title = [name, p.storage_capacity, p.color, grade !== 'Inconnu' ? grade : null]
      .filter(Boolean)
      .join(' ');
    const description = `${name} reconditionné, testé et certifié en France, garanti 24 mois.`;

    items.push(`    <item>
      <g:id>${esc(p.id)}</g:id>
      <g:title>${esc(`${title} — reconditionné`)}</g:title>
      <g:description>${esc(description)}</g:description>
      <g:link>${esc(`${BASE_URL}${productUrl(p)}`)}</g:link>
      <g:image_link>${esc(imageUrl)}</g:image_link>
      <g:availability>in stock</g:availability>
      <g:condition>refurbished</g:condition>
      <g:price>${price.toFixed(2)} EUR</g:price>
      <g:brand>${esc(String(p.brand || ''))}</g:brand>
      <g:identifier_exists>no</g:identifier_exists>${p.color ? `\n      <g:color>${esc(String(p.color))}</g:color>` : ''}
      <g:shipping>
        <g:country>FR</g:country>
        <g:price>${SHIPPING_FEE_EUR.toFixed(2)} EUR</g:price>
      </g:shipping>
    </item>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>TEL &amp; CASH</title>
    <link>${esc(BASE_URL)}</link>
    <description>Smartphones reconditionnés — TEL &amp; CASH, Angers</description>
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
