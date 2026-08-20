import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { normalizePickupCode, PICKUP_INELIGIBLE_STATUSES } from '@/lib/pickupCode';
import { buildOrderNumberMap } from '@/lib/orderNumber';

// POST /api/admin/orders/verify-pickup-code — vérification par CODE SEUL,
// sans connaître l'id de la commande au préalable (comptoir : l'employé n'a
// que le code annoncé par le client). Sœur de
// [id]/verify-pickup-code/route.ts (même règles d'éligibilité, cf.
// PICKUP_INELIGIBLE_STATUSES partagé) — celle-ci sert la page dédiée
// /admin/verification-retrait, l'autre reste utilisée depuis le détail
// commande (où l'id est déjà connu).
//
// Pas de verrou par tentative ici : il n'y a pas de commande identifiée tant
// que le code ne matche pas, donc rien sur quoi compter des essais. Le
// keyspace (8 caractères, alphabet de 32 sans ambiguïté = 32^8 ≈ 1,1×10^12
// combinaisons) rend le brute-force non pertinent pour une route déjà
// derrière requireAdmin() — même hypothèse que la route sœur (cf. son
// commentaire E4 dans le spec).
export async function POST(request: Request) {
  try {
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const body = await request.json().catch(() => ({} as any));
    const submitted = normalizePickupCode(String(body?.code || ''));
    if (!submitted) {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, status, total_amount, discount_amount, pickup_code_verified_at, profile:profiles(full_name, email)')
      .eq('pickup_code', submitted)
      .eq('delivery_method', 'pickup')
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ valid: false, alreadyUsed: false, message: 'Code invalide.' });
    }

    if (order.pickup_code_verified_at) {
      const when = new Date(order.pickup_code_verified_at).toLocaleString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      return NextResponse.json({ valid: false, alreadyUsed: true, message: `Code déjà utilisé le ${when}` });
    }

    if (PICKUP_INELIGIBLE_STATUSES.has(order.status)) {
      return NextResponse.json(
        { valid: false, alreadyUsed: false, message: "Cette commande n'est pas dans un état permettant le retrait." }
      );
    }

    // Code correct — enregistre qui/quand, une seule fois possible (comme la
    // route sœur : la prochaine tentative, même avec le bon code, tombera sur
    // "déjà utilisé").
    await supabase
      .from('orders')
      .update({
        pickup_code_verified_at: new Date().toISOString(),
        pickup_code_verified_by: profile!.id,
      })
      .eq('id', order.id);

    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, price_at_purchase, product_name, product:products(brand, model, storage_capacity, color, grade, images)')
      .eq('order_id', order.id);

    const { data: allOrders } = await supabase.from('orders').select('id, created_at');
    const orderNumber = buildOrderNumberMap(allOrders || []).get(order.id) ?? null;
    const customerName = (order as any).profile?.full_name || (order as any).profile?.email || '—';

    return NextResponse.json({
      valid: true,
      alreadyUsed: false,
      orderId: order.id,
      orderNumber,
      status: order.status,
      customerName,
      total: order.total_amount,
      items: (items || []).map((it: any) => ({
        quantity: it.quantity,
        price: it.price_at_purchase,
        name: [it.product?.brand, it.product?.model].filter(Boolean).join(' ') || it.product_name || '—',
        details: [it.product?.storage_capacity, it.product?.grade ? `Grade ${it.product.grade}` : null, it.product?.color]
          .filter(Boolean).join(' · '),
        image: it.product?.images?.[0] || null,
      })),
      message: `Code valide — commande n°${orderNumber ?? '—'}, client ${customerName}`,
    });
  } catch (err) {
    console.error('verify-pickup-code (by code) error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
