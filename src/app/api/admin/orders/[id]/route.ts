import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { isBoxtalConfigured, boxtalAuthOk } from '@/lib/boxtal';
import { stripPickupCodeSecrets } from '@/lib/pickupCode';

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
    // (BOXTAL_API_BASE). Évite le faux « Configurer Boxtal » quand des clés prod
    // sont vérifiées contre la mauvaise base.
    const boxtalConfigured = isBoxtalConfigured() ? await boxtalAuthOk() : false;

    // Le code de retrait lui-même ne doit JAMAIS atteindre l'admin (cf.
    // lib/pickupCode.ts) — seul son statut de vérification est utile côté UI.
    // "Qui a validé" est résolu séparément (pas d'embed FK — cf. migration 038).
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

    return NextResponse.json({ order: numberedOrder, items, boxtalConfigured });
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

    const { data: order, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    return NextResponse.json({ order: stripPickupCodeSecrets(order) });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
