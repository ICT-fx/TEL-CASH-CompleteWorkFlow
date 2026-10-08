import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { isEmailConfigured, sendDailySummaryEmail } from '@/lib/email';
import { fetchAll, isCountedSale, loadSales } from '@/lib/admin/sales';
import { loadSupplierCostIndex, orderMargin } from '@/lib/admin/orderMargin';

// Résumé du soir envoyé à la boutique (vercel.json : 17 h UTC = 19 h à Paris
// l'été, 18 h l'hiver). Lecture seule. ?dryRun=1 renvoie le contenu sans envoyer.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function authorize(request: Request): Promise<NextResponse | null> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return null;
  const { response } = await requireAdmin();
  return response ?? null;
}

export async function GET(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;
  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
  const db = createAdminClient();

  // Les 24 dernières heures (depuis l'e-mail d'hier) : aucune vente du soir n'est oubliée.
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 3600_000);
  const { orders } = await loadSales(db, { since });
  const today = orders.filter((o) => o.createdAt >= since && isCountedSale(o));

  type Row = { order_id: string; quantity: number | null; price_at_purchase: number | string | null; cost_at_purchase: number | string | null; product_name: string | null; product: unknown };
  const rows = today.length ? await fetchAll<Row>((from, to) => db
    .from('order_items')
    .select('order_id, quantity, price_at_purchase, cost_at_purchase, product_name, product:products(brand, model, storage_capacity, grade, brand_k, model_k, storage_k, grade_k, color_k)')
    .in('order_id', today.map((o) => o.id))
    .range(from, to)) : [];
  type P = { brand?: string; model?: string; storage_capacity?: string; grade?: string; brand_k?: string; model_k?: string; storage_k?: string; grade_k?: string; color_k?: string };
  const prod = (r: Row) => (Array.isArray(r.product) ? r.product[0] : r.product) as P | null;
  const index = await loadSupplierCostIndex(db, rows.map((r) => prod(r)?.model_k));
  const { data: disc } = today.length
    ? await db.from('orders').select('id, discount_amount').in('id', today.map((o) => o.id))
    : { data: [] as { id: string; discount_amount: number | null }[] };
  const discountOf = new Map((disc ?? []).map((d) => [d.id as string, Number(d.discount_amount) || 0]));
  // Marge par commande (remise déduite), puis somme ; null si aucune n'est connue.
  let marginSum: number | null = null;
  for (const o of today) {
    const m = orderMargin(rows.filter((r) => r.order_id === o.id).map((r) => {
      const p = prod(r);
      return {
        quantity: r.quantity ?? 1, price: Number(r.price_at_purchase) || 0,
        costAtPurchase: r.cost_at_purchase == null ? null : Number(r.cost_at_purchase),
        keys: p ? { brand_k: p.brand_k ?? null, model_k: p.model_k ?? null, storage_k: p.storage_k ?? null, grade_k: p.grade_k ?? null, color_k: p.color_k ?? null } : null,
      };
    }), index.lookup, discountOf.get(o.id) ?? 0);
    if (m.amount != null) marginSum = (marginSum ?? 0) + m.amount * (o.gross > 0 ? o.net / o.gross : 1);
  }

  const [toPrepare, pickups, returns] = await Promise.all([
    db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'shipped').eq('delivery_method', 'pickup'),
    db.from('return_requests').select('id', { count: 'exact', head: true }).in('status', ['requested', 'received', 'inspecting']),
  ]);

  const summary = {
    dateLabel: `${now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' })} · ventes depuis hier même heure`,
    net: today.reduce((s, o) => s + o.net, 0),
    orders: today.length,
    margin: marginSum == null ? null : Math.round(marginSum),
    todo: [
      { label: 'commande(s) à préparer', n: toPrepare.count ?? 0, href: '/admin/orders?status=paid' },
      { label: 'client(s) attendu(s) en boutique pour un retrait', n: pickups.count ?? 0, href: '/admin/orders?status=pickup' },
      { label: 'retour(s) à traiter', n: returns.count ?? 0, href: '/admin/returns' },
    ],
    sales: rows.map((r) => {
      const p = prod(r);
      return { label: p ? [p.brand, p.model, p.storage_capacity, p.grade ? `grade ${p.grade}` : null].filter(Boolean).join(' ') : (r.product_name || 'Article'), amount: (Number(r.price_at_purchase) || 0) * (r.quantity ?? 1) };
    }),
  };

  if (dryRun) return NextResponse.json({ dryRun: true, emailConfigured: isEmailConfigured(), summary });
  if (!isEmailConfigured()) return NextResponse.json({ sent: false, reason: 'aucun service d’e-mail configuré' });
  const res = await sendDailySummaryEmail(summary);
  return NextResponse.json({ sent: res.sent, reason: res.reason });
}
