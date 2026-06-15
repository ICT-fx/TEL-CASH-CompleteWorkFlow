import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

const PAID_STATUSES = ['paid', 'shipped', 'delivered'];

// GET /api/admin/margins/stats — marges réalisées (lignes avec coût figé).
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  const db = createAdminClient();

  // Commandes encaissées uniquement.
  const { data: paidOrders } = await db
    .from('orders').select('id').in('status', PAID_STATUSES);
  const paidIds = new Set((paidOrders ?? []).map((o) => o.id));

  const { data: items } = await db
    .from('order_items')
    .select('order_id, quantity, price_at_purchase, cost_at_purchase');

  let totalMarginEuro = 0;
  let totalCost = 0;
  let salesCount = 0;
  for (const it of items ?? []) {
    if (!paidIds.has(it.order_id)) continue;
    if (it.cost_at_purchase == null) continue; // historique sans coût → exclu
    const qty = it.quantity || 1;
    const price = Number(it.price_at_purchase) || 0;
    const cost = Number(it.cost_at_purchase) || 0;
    totalMarginEuro += (price - cost) * qty;
    totalCost += cost * qty;
    salesCount += qty;
  }

  const avgMarginPct = totalCost > 0 ? totalMarginEuro / totalCost : 0;
  return NextResponse.json({
    stats: { totalMarginEuro, salesCount, avgMarginPct },
  });
}
