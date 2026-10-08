import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { stripPickupCodeSecrets } from '@/lib/pickupCode';
import { loadSupplierCostIndex, orderMargin, type MarginItem } from '@/lib/admin/orderMargin';
import { fetchAll } from '@/lib/admin/sales';

// GET /api/admin/orders — List all orders
export async function GET(request: Request) {
  try {
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();

    let query = supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Statuts d'avant-paiement : pré-commandes jamais finalisées (panier
    // abandonné au paiement). On ne les affiche jamais dans l'admin.
    const PRE_PAYMENT_STATUSES = ['pending', 'awaiting_payment', 'failed'];

    if (status && status !== 'all') {
      if (status === 'active') {
        query = query.in('status', ['paid', 'supplier_ordered', 'shipped', 'delivered']);
      } else {
        query = query.eq('status', status);
        const delivery = searchParams.get('delivery');
        if (delivery === 'pickup') query = query.eq('delivery_method', 'pickup');
        else if (delivery === 'home') query = query.or('delivery_method.is.null,delivery_method.neq.pickup');
      }
    } else {
      // "Toutes" = uniquement les commandes réellement payées (et au-delà).
      query = query.not('status', 'in', `(${PRE_PAYMENT_STATUSES.join(',')})`);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Readable order numbers (n°1, n°2…) derived from the full order set.
    // Toutes les commandes (paginé, ordre stable) : n° lisibles et compteurs des onglets.
    const allOrders = await fetchAll<{ id: string; created_at: string; status: string; delivery_method: string | null }>((from, to) => supabase
      .from('orders')
      .select('id, created_at, status, delivery_method')
      .order('created_at')
      .order('id')
      .range(from, to));
    const numberMap = buildOrderNumberMap(allOrders || []);

    // Compteurs par statut pour les onglets (hors pré-paiement).
    const counts: Record<string, number> = { all: 0 };
    for (const o of allOrders || []) {
      const s = (o as any).status as string;
      if (PRE_PAYMENT_STATUSES.includes(s)) continue;
      counts.all += 1;
      counts[s] = (counts[s] || 0) + 1;
      // « Expédiée » couvre deux étapes différentes : colis parti, ou prêt en boutique.
      if (s === 'shipped') {
        const k = (o as any).delivery_method === 'pickup' ? 'shipped_pickup' : 'shipped_home';
        counts[k] = (counts[k] || 0) + 1;
      }
    }

    // Articles des commandes affichées : titres produits pour aperçu en liste.
    const orderIds = (orders || []).map((o) => o.id);
    const itemsByOrder = new Map<
      string,
      { title: string; quantity: number; storage: string | null; color: string | null; grade: string | null }[]
    >();
    const marginItemsByOrder = new Map<string, MarginItem[]>();
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, product_name, quantity, price_at_purchase, cost_at_purchase, product:products(brand, model, storage_capacity, color, grade, brand_k, model_k, storage_k, grade_k, color_k)')
        .in('order_id', orderIds);
      for (const it of items || []) {
        const p = (it as any).product;
        const title = [p?.brand, p?.model].filter(Boolean).join(' ') || (it as any).product_name || 'Produit';
        const list = itemsByOrder.get((it as any).order_id) || [];
        list.push({
          title,
          quantity: (it as any).quantity ?? 1,
          storage: p?.storage_capacity ?? null,
          color: p?.color ?? null,
          grade: p?.grade ?? null,
        });
        itemsByOrder.set((it as any).order_id, list);
        const mList = marginItemsByOrder.get((it as any).order_id) || [];
        mList.push({
          quantity: (it as any).quantity ?? 1,
          price: Number((it as any).price_at_purchase) || 0,
          costAtPurchase: (it as any).cost_at_purchase == null ? null : Number((it as any).cost_at_purchase),
          keys: p ? { brand_k: p.brand_k ?? null, model_k: p.model_k ?? null, storage_k: p.storage_k ?? null, grade_k: p.grade_k ?? null, color_k: p.color_k ?? null } : null,
        });
        marginItemsByOrder.set((it as any).order_id, mList);
      }
    }

    // Prix fournisseur actuels (lignes miroir du flux) pour les modèles vendus :
    // sert à estimer la marge quand le coût n'a pas été figé à l'achat. Lecture seule.
    const supplierIndex = await loadSupplierCostIndex(
      supabase, Array.from(marginItemsByOrder.values()).flat().map((m) => m.keys?.model_k));

    const numberedOrders = (orders || []).map((o) => ({
      ...stripPickupCodeSecrets(o),
      order_number: numberMap.get(o.id) ?? null,
      items: itemsByOrder.get(o.id) || [],
      margin: orderMargin(marginItemsByOrder.get(o.id) || [], supplierIndex.lookup, Number((o as any).discount_amount) || 0),
    }));

    return NextResponse.json({
      orders: numberedOrders,
      counts,
      pagination: { page, limit, total: count || 0 },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
