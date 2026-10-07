import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { fetchAll, isCountedSale, loadSales } from '@/lib/admin/sales';

// GET /api/admin/margins/stats — marges réalisées (lignes avec coût figé).
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  const db = createAdminClient();

  // Commandes encaissées uniquement (même définition que l'accueil et les
  // statistiques : lib/admin/sales — tests exclus, remboursées totalement exclues).
  const { orders: sales } = await loadSales(db);
  const paidIds = new Set(sales.filter(isCountedSale).map((o) => o.id));

  const items = await fetchAll<{
    order_id: string; quantity: number | null;
    price_at_purchase: number | string | null; cost_at_purchase: number | string | null;
  }>((from, to) => db
    .from('order_items')
    .select('order_id, quantity, price_at_purchase, cost_at_purchase')
    .range(from, to));

  let totalMarginEuro = 0;
  let totalCost = 0;
  let salesCount = 0;
  for (const it of items) {
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
