import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { buildOrderNumberMap } from '@/lib/orderNumber';

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
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, created_at, status');
    const numberMap = buildOrderNumberMap(allOrders || []);

    // Compteurs par statut pour les onglets (hors pré-paiement).
    const counts: Record<string, number> = { all: 0 };
    for (const o of allOrders || []) {
      const s = (o as any).status as string;
      if (PRE_PAYMENT_STATUSES.includes(s)) continue;
      counts.all += 1;
      counts[s] = (counts[s] || 0) + 1;
    }

    // Articles des commandes affichées : titres produits pour aperçu en liste.
    const orderIds = (orders || []).map((o) => o.id);
    const itemsByOrder = new Map<
      string,
      { title: string; quantity: number; storage: string | null; color: string | null; grade: string | null }[]
    >();
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, product_name, quantity, product:products(brand, model, storage_capacity, color, grade)')
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
      }
    }

    const numberedOrders = (orders || []).map((o) => ({
      ...o,
      order_number: numberMap.get(o.id) ?? null,
      items: itemsByOrder.get(o.id) || [],
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
