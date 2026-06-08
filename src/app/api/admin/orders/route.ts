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
        query = query.in('status', ['paid', 'shipped', 'delivered']);
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
      .select('id, created_at');
    const numberMap = buildOrderNumberMap(allOrders || []);
    const numberedOrders = (orders || []).map((o) => ({
      ...o,
      order_number: numberMap.get(o.id) ?? null,
    }));

    return NextResponse.json({
      orders: numberedOrders,
      pagination: { page, limit, total: count || 0 },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
