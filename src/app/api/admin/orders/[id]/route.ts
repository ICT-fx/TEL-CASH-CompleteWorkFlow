import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { boxtalAuthCheck } from '@/lib/boxtal';
import { stripPickupCodeSecrets } from '@/lib/pickupCode';
import { sendOrderStatusUpdateEmail } from '@/lib/email';

// Statuts génériques notifiés par email depuis cette route (menu déroulant +
// bouton "Marquer comme retirée/livrée"). Volontairement PAS 'shipped' : ce
// statut a ses propres emails dédiés (sendShippedEmail / sendPickupReadyEmail,
// avec pour le retrait la case de confirmation obligatoire côté UI) — les
// déclencher ici court-circuiterait cette garde. PAS non plus
// 'cancelled'/'refunded' (gérés par la route /refund) ni 'paid' (webhook Stripe).
const STATUS_UPDATE_EMAIL_STATUSES = new Set(['supplier_ordered', 'delivered']);

// GET /api/admin/orders/[id] — Get order detail (admin)
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name, phone)')
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('*, product:products(brand, model, images, imei, storage_capacity, color, grade, category, product_type)')
      .eq('order_id', id);

    // Readable order number (n°1, n°2…) derived from the full order set.
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, created_at');
    const numberMap = buildOrderNumberMap(allOrders || []);

    // « configuré » = clés présentes ET auth V3 OK sur la base configurée
    // (BOXTAL_API_BASE). boxtalError porte la raison exacte de l'échec
    // (HTTP status, clés manquantes...) pour l'afficher à l'admin au lieu
    // d'un message générique qui ne dit pas si le problème est "pas de clés"
    // ou "clés présentes mais refusées".
    const { ok: boxtalConfigured, reason: boxtalError } = await boxtalAuthCheck();

    // Le code de retrait lui-même ne doit JAMAIS atteindre l'admin (cf.
    // lib/pickupCode.ts) — seul son statut de vérification est utile côté UI.
    // "Qui a validé" est résolu séparément (pas d'embed FK — cf. migration 041).
    let pickupCodeVerifiedByName: string | null = null;
    if (order.pickup_code_verified_by) {
      const { data: verifier } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', order.pickup_code_verified_by)
        .single();
      pickupCodeVerifiedByName = verifier?.full_name || verifier?.email || null;
    }
    const numberedOrder = {
      ...stripPickupCodeSecrets(order),
      order_number: numberMap.get(order.id) ?? null,
      has_pickup_code: Boolean(order.pickup_code),
      pickup_code_verified_by_name: pickupCodeVerifiedByName,
    };

    return NextResponse.json({ order: numberedOrder, items, boxtalConfigured, boxtalError });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/admin/orders/[id] — Update order status / tracking
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const body = await request.json();
    const updateData: Record<string, any> = {};

    if (body.status) updateData.status = body.status;
    if (body.tracking_number) updateData.tracking_number = body.tracking_number;
    if (body.tracking_url !== undefined) updateData.tracking_url = body.tracking_url;
    if (body.notes) updateData.notes = body.notes;

    const supabase = createAdminClient();

    // Statut avant mise à jour, pour ne notifier que sur un vrai changement
    // (évite un email en boucle si l'admin re-sauvegarde le même statut).
    const previousStatus = body.status
      ? (await supabase.from('orders').select('status').eq('id', id).single()).data?.status
      : null;

    const { data: order, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select('*, profile:profiles(email, full_name)')
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    if (
      body.status &&
      body.status !== previousStatus &&
      STATUS_UPDATE_EMAIL_STATUSES.has(body.status) &&
      order.profile?.email
    ) {
      const numberMap = buildOrderNumberMap(
        (await supabase.from('orders').select('id, created_at')).data || []
      );
      sendOrderStatusUpdateEmail({
        to: order.profile.email,
        customerName: order.profile.full_name,
        orderNumber: `n°${numberMap.get(order.id) ?? order.id.slice(0, 8).toUpperCase()}`,
        status: body.status as 'supplier_ordered' | 'delivered',
        deliveryMethod: order.delivery_method,
      }).catch(() => {});
    }

    return NextResponse.json({ order: stripPickupCodeSecrets(order) });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
