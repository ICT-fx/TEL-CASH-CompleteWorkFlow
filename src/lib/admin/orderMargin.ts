// Marge d'une commande, affichée dans la liste des commandes et sur la fiche.
// Lecture seule : ne touche ni aux prix ni aux règles de marge (pages Prix et
// Marges inchangées).
//
// Le coût vient, dans l'ordre :
//  1. du coût figé à l'achat (order_items.cost_at_purchase), quand il est réel ;
//  2. sinon du prix fournisseur actuel de la même variante dans le flux
//     (lignes source = 'fluxitron', mêmes clés marque/modèle/stockage/grade/couleur,
//     puis sans la couleur) → marge « estimée » ;
//  3. sinon : marge inconnue.
//
// Pourquoi « réel » n'est pas toujours vrai : au paiement, quand le produit
// magasin n'a pas de prix d'achat, le checkout recopie le prix de vente dans
// cost_at_purchase (marge 0 apparente). Un coût égal au prix de vente est donc
// traité comme « coût inconnu ».

export interface MarginItem {
  quantity: number;
  price: number;                 // price_at_purchase
  costAtPurchase: number | null; // cost_at_purchase
  keys: VariantKeys | null;      // clés du produit vendu
}

export interface VariantKeys {
  brand_k: string | null; model_k: string | null; storage_k: string | null;
  grade_k: string | null; color_k: string | null;
}

export interface OrderMargin {
  /** Marge en euros (sur les lignes dont le coût est connu ou estimé). */
  amount: number | null;
  /** Marge / CA des lignes prises en compte, en %. */
  pct: number | null;
  /** Au moins une ligne repose sur le prix fournisseur actuel. */
  estimated: boolean;
  /** Au moins une ligne n'a aucun coût. */
  partial: boolean;
}

const key4 = (k: VariantKeys) => [k.brand_k, k.model_k, k.storage_k, k.grade_k].join('|');
const key5 = (k: VariantKeys) => `${key4(k)}|${k.color_k}`;

/** Index des prix fournisseur (le moins cher par variante exacte, et sans la couleur). */
export function buildSupplierCostIndex(rows: (VariantKeys & { cost_price: number | string | null })[]) {
  const exact = new Map<string, number>();
  const loose = new Map<string, number>();
  for (const r of rows) {
    const c = Number(r.cost_price);
    if (!r.brand_k || !r.model_k || !r.storage_k || !r.grade_k || !(c > 0)) continue;
    const k5 = key5(r), k4 = key4(r);
    if (!exact.has(k5) || c < exact.get(k5)!) exact.set(k5, c);
    if (!loose.has(k4) || c < loose.get(k4)!) loose.set(k4, c);
  }
  return {
    lookup(k: VariantKeys | null): number | null {
      if (!k || !k.brand_k || !k.model_k || !k.storage_k || !k.grade_k) return null;
      return exact.get(key5(k)) ?? loose.get(key4(k)) ?? null;
    },
  };
}

/**
 * `discount` : remise accordée sur la commande (parrainage…), déduite de la
 * marge au prorata des lignes prises en compte.
 */
export function orderMargin(items: MarginItem[], supplierCost: (k: VariantKeys | null) => number | null, discount = 0): OrderMargin {
  let amount = 0, revenue = 0, counted = 0;
  const totalRevenue = items.reduce((s, it) => s + it.price * (it.quantity || 1), 0);
  let estimated = false, partial = false;
  for (const it of items) {
    const qty = it.quantity || 1;
    const real = it.costAtPurchase != null && it.costAtPurchase > 0 && Math.abs(it.costAtPurchase - it.price) > 0.009
      ? it.costAtPurchase : null;
    let cost = real;
    if (cost == null) {
      cost = supplierCost(it.keys);
      if (cost != null) estimated = true;
    }
    if (cost == null) { partial = true; continue; }
    amount += (it.price - cost) * qty;
    revenue += it.price * qty;
    counted += 1;
  }
  if (counted === 0) return { amount: null, pct: null, estimated: false, partial: true };
  if (discount > 0 && totalRevenue > 0) {
    const share = discount * (revenue / totalRevenue);
    amount -= share;
    revenue -= share;
  }
  return {
    amount: Math.round(amount * 100) / 100,
    pct: revenue > 0 ? Math.round((amount / revenue) * 1000) / 10 : null,
    estimated,
    partial,
  };
}

/** Charge les prix fournisseur actuels (lignes miroir du flux) des modèles donnés. Lecture seule. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadSupplierCostIndex(db: any, modelKeys: (string | null | undefined)[]) {
  const models = Array.from(new Set(modelKeys.filter(Boolean))) as string[];
  const rows: (VariantKeys & { cost_price: number | string | null })[] = [];
  for (let i = 0; i < models.length; i += 100) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from('products')
        .select('brand_k, model_k, storage_k, grade_k, color_k, cost_price')
        .eq('source', 'fluxitron')
        .in('model_k', models.slice(i, i + 100))
        .not('cost_price', 'is', null)
        .order('id')
        .range(from, from + 999);
      if (error || !data) break;
      rows.push(...data);
      if (data.length < 1000) break;
    }
  }
  return buildSupplierCostIndex(rows);
}
