import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase-admin';
import { buildVariantMatrix, type RawProduct } from '@/lib/productVariants';
import { resolveProductImage } from '@/lib/productImage';
import { isAllowedPhone } from '@/lib/catalogModels';
import { productUrl, suffixFromSlug, uuidRangeFromSuffix, productSlug, UUID_RE } from '@/lib/productUrl';
import ProductDetailClient from './ProductDetailClient';
import AccessoryDetailClient from './AccessoryDetailClient';

function isAccessory(sku: RawProduct): boolean {
  const cat = String((sku as { category?: string | null }).category || '').toLowerCase();
  const catId = String((sku as { category_id?: string | null }).category_id || '');
  return cat === 'accessoires' || catId === 'a0000000-0000-0000-0000-000000000002';
}

// Server component : fetch du SKU + de ses frères côté serveur (premier rendu
// non vide, plus de waterfall client), metadata produit uniques et JSON-LD
// Product/Breadcrumb pour le SEO. Toute l'interactivité reste dans
// ProductDetailClient.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';

export const revalidate = 300; // 5 min — prix/stock raisonnablement frais

// cache() : generateMetadata et la page partagent le même fetch par requête.
// `param` = segment d'URL : soit un slug-suffixe (nouveau format), soit un UUID
// nu (ancienne URL indexée). On résout le SKU exact dans les deux cas.
const getProductData = cache(async (param: string) => {
  try {
    const supabase = createAdminClient();
    // v_catalog_products = products magasin (source='manual') + greyed_by_supplier
    // (signal de stock Fluxitron). La vue filtre déjà source='manual' : le miroir
    // fournisseur reste invisible et chaque variante porte son drapeau de grisage.
    let sku: RawProduct | null = null;

    if (UUID_RE.test(param)) {
      // Ancienne URL UUID nu → lookup exact (sera redirigé en 308 vers le slug).
      const { data } = await supabase
        .from('v_catalog_products')
        .select('*')
        .eq('id', param)
        .eq('is_active', true)
        .maybeSingle();
      sku = (data as RawProduct) ?? null;
    } else {
      // Slug-suffixe → résolution par PLAGE d'UUID sur les 6 hex du suffixe.
      const suffix = suffixFromSlug(param);
      const range = suffix ? uuidRangeFromSuffix(suffix) : null;
      if (range) {
        let q = supabase
          .from('v_catalog_products')
          .select('*')
          .eq('is_active', true)
          .gte('id', range.lo);
        if (range.hi) q = q.lt('id', range.hi);
        const { data } = await q.limit(4);
        const rows = (data as RawProduct[]) || [];
        if (rows.length === 1) sku = rows[0];
        // Collision 6-hex (extrêmement rare) : on prend la ligne dont le slug
        // canonique correspond exactement, sinon la première.
        else if (rows.length > 1) sku = rows.find((r) => productSlug(r) === param) ?? rows[0];
      }
    }
    if (!sku) return null;

    let siblings: RawProduct[] = [sku];
    if (sku.brand && sku.model) {
      const { data } = await supabase
        .from('v_catalog_products')
        .select('*')
        .eq('is_active', true)
        .eq('brand', sku.brand)
        .eq('model', sku.model);
      if (data && data.length > 0) siblings = data as RawProduct[];
    }
    return { sku, siblings };
  } catch {
    return null; // suffixe inconnu, DB injoignable… → 404 propre
  }
});

// Image absolue pour OG/JSON-LD ; jamais le placeholder SVG inline (data:).
function absoluteImage(sku: RawProduct, siblings: RawProduct[]): string | null {
  const url = resolveProductImage(
    { brand: sku.brand, model: sku.model, images: sku.images || [] },
    sku.color,
  );
  if (url.startsWith('data:')) return null;
  return url.startsWith('http') ? url : `${BASE_URL}${url}`;
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const data = await getProductData(id);
  // notFound()/permanentRedirect() sont appelés ICI (generateMetadata s'exécute
  // AVANT le streaming du shell loading.tsx) : c'est le seul endroit où leur
  // statut HTTP (404 / 308) est correctement émis. La page (sous Suspense)
  // re-vérifie en filet de sécurité.
  if (!data) notFound();
  const canonicalPath = productUrl(data.sku);
  if (`/products/${id}` !== canonicalPath) permanentRedirect(canonicalPath);
  const { sku, siblings } = data;

  // Accessoire : metadata simple (pas de « reconditionné »).
  if (isAccessory(sku)) {
    const accName = (sku.model || 'Accessoire').trim();
    const accDesc = String((sku as { condition_description?: string | null }).condition_description || '').trim()
      || `${accName} — accessoire ${sku.brand || 'd-power'}. Livraison suivie, paiement sécurisé.`;
    const accImage = absoluteImage(sku, siblings);
    const accCanonical = `${BASE_URL}${productUrl(sku)}`;
    return {
      title: `${accName} — TEL & CASH`,
      description: accDesc,
      alternates: { canonical: accCanonical },
      openGraph: {
        title: `${accName} — TEL & CASH`,
        description: accDesc,
        url: accCanonical,
        siteName: 'TEL & CASH',
        locale: 'fr_FR',
        type: 'website',
        ...(accImage ? { images: [{ url: accImage, width: 1200, height: 1200, alt: accName }] } : {}),
      },
    };
  }

  const name = `${sku.brand} ${sku.model}`.trim();
  const matrix = buildVariantMatrix(siblings);
  // Sell-to-order : le prix « à partir de » ignore le stock (toute variante priée est commandable).
  const prices = matrix.variants.filter((v) => v.price > 0).map((v) => v.price);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const description = minPrice
    ? `${name} reconditionné et garanti 24 mois, à partir de ${minPrice.toFixed(0)} €. Testé et certifié en France, livraison suivie, retour 30 jours.`
    : `${name} reconditionné et garanti 24 mois. Testé et certifié en France, livraison suivie, retour 30 jours.`;
  const image = absoluteImage(sku, siblings);
  const canonical = `${BASE_URL}${productUrl(sku)}`;

  return {
    title: `${name} reconditionné — TEL & CASH`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${name} reconditionné — TEL & CASH`,
      description,
      url: canonical,
      siteName: 'TEL & CASH',
      locale: 'fr_FR',
      type: 'website',
      ...(image ? { images: [{ url: image, width: 1200, height: 1200, alt: name }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} reconditionné — TEL & CASH`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ProductDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await getProductData(id);
  if (!data) notFound();

  // Canonicalisation : un seul URL répond en 200 (le slug canonique). Toute
  // autre forme — UUID nu (ancienne URL indexée) OU slug dont la partie texte
  // ne correspond plus — redirige en 308 permanent vers le slug canonique.
  const canonicalPath = productUrl(data.sku);

  // Accessoire : fiche simple dédiée (pas de grade/couleur/stockage/variantes).
  if (isAccessory(data.sku)) {
    if (`/products/${id}` !== canonicalPath) permanentRedirect(canonicalPath);
    const accImage = absoluteImage(data.sku, data.siblings);
    const accName = `${data.sku.brand || 'd-power'} ${data.sku.model || ''}`.trim();
    const accPrice = Number(data.sku.price);
    const accLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: data.sku.model || accName,
      brand: { '@type': 'Brand', name: data.sku.brand || 'd-power' },
      ...(accImage ? { image: [accImage] } : {}),
      ...(Number.isFinite(accPrice) && accPrice > 0
        ? {
            offers: {
              '@type': 'Offer',
              priceCurrency: 'EUR',
              price: accPrice,
              availability: 'https://schema.org/InStock',
              url: `${BASE_URL}${canonicalPath}`,
              seller: { '@type': 'Organization', name: 'TEL & CASH' },
            },
          }
        : {}),
    };
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(accLd) }} />
        <AccessoryDetailClient sku={data.sku} />
      </>
    );
  }

  // iPhone antérieur au 11 : retiré de la boutique (même règle que le listing).
  if (!isAllowedPhone(data.sku.brand, data.sku.model)) notFound();

  // 308 vers le slug canonique (UUID nu ou slug texte périmé).
  if (`/products/${id}` !== canonicalPath) permanentRedirect(canonicalPath);

  const { sku, siblings } = data;
  const name = `${sku.brand} ${sku.model}`.trim();
  const matrix = buildVariantMatrix(siblings);
  // Sell-to-order : les offres SEO comptent toute variante priée, indépendamment du stock.
  const purchasable = matrix.variants.filter((v) => v.price > 0);
  const prices = purchasable.map((v) => v.price);
  const image = absoluteImage(sku, siblings);

  // JSON-LD Product + Offer. PAS d'AggregateRating : les avis affichés sont
  // des exemples (démo) — en publier le score serait pénalisé par Google.
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${name} reconditionné`,
    ...(image ? { image: [image] } : {}),
    description: `${name} reconditionné, testé et certifié, garanti 24 mois.`,
    brand: { '@type': 'Brand', name: sku.brand || 'Apple' },
    itemCondition: 'https://schema.org/RefurbishedCondition',
    offers: prices.length
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'EUR',
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          offerCount: purchasable.length,
          availability: 'https://schema.org/InStock',
          url: `${BASE_URL}${canonicalPath}`,
          seller: { '@type': 'Organization', name: 'TEL & CASH' },
        }
      : {
          '@type': 'AggregateOffer',
          priceCurrency: 'EUR',
          lowPrice: 0,
          offerCount: 0,
          // Sell-to-order : le produit reste achetable même sans stock.
          availability: 'https://schema.org/InStock',
          url: `${BASE_URL}${canonicalPath}`,
        },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Smartphones', item: `${BASE_URL}/products` },
      { '@type': 'ListItem', position: 3, name, item: `${BASE_URL}${canonicalPath}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <ProductDetailClient initialSku={sku} siblings={siblings} />
    </>
  );
}
