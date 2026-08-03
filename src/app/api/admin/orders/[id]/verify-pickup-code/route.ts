import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { normalizePickupCode, pickupCodesMatch } from '@/lib/pickupCode';
import { buildOrderNumberMap } from '@/lib/orderNumber';

// Rate-limit simple, PAR COMMANDE (pas global) : suffisant pour empêcher le
// brute-force d'un code précis sans complexité inutile — cette route est déjà
// derrière une authentification admin, ce n'est pas une surface publique.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Statuts pour lesquels le code de retrait a un sens : la commande doit être
// payée (au minimum) et pas déjà retirée. Les statuts d'avant-paiement et les
// états terminaux négatifs ne sont jamais vérifiables.
const INELIGIBLE_STATUSES = new Set([
  'pending', 'awaiting_payment', 'failed', 'cancelled', 'refunded', 'disputed',
]);

// POST /api/admin/orders/[id]/verify-pickup-code — vérification SERVEUR du
// code annoncé par le client en boutique. Jamais de comparaison visuelle
// côté employé : le code n'est jamais exposé par GET /orders/[id] (cf.
// lib/pickupCode.ts, stripPickupCodeSecrets), donc cette route est le seul
// moyen de savoir si un code est correct.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
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
      .select('id, status, delivery_method, pickup_code, pickup_code_verified_at, pickup_code_attempts, pickup_code_locked_until, profile:profiles(full_name, email)')
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }
    if (order.delivery_method !== 'pickup') {
      return NextResponse.json({ error: "Cette commande n'est pas un retrait en boutique." }, { status: 400 });
    }
    if (!order.pickup_code) {
      return NextResponse.json({ error: 'Aucun code de retrait généré pour cette commande.' }, { status: 400 });
    }
    if (INELIGIBLE_STATUSES.has(order.status)) {
      return NextResponse.json(
        { error: "Cette commande n'est pas dans un état permettant le retrait." },
        { status: 400 }
      );
    }

    // Anti-double-retrait : un code déjà consommé n'est plus jamais valide,
    // même ressaisi correctement — indépendant du statut de la commande.
    if (order.pickup_code_verified_at) {
      const when = new Date(order.pickup_code_verified_at).toLocaleString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      return NextResponse.json({ valid: false, alreadyUsed: true, message: `Code déjà utilisé le ${when}` });
    }

    // Rate-limit simple par commande.
    if (order.pickup_code_locked_until && new Date(order.pickup_code_locked_until) > new Date()) {
      const mins = Math.ceil((new Date(order.pickup_code_locked_until).getTime() - Date.now()) / 60_000);
      return NextResponse.json(
        { error: `Trop de tentatives — réessayez dans ${mins} min.` },
        { status: 429 }
      );
    }

    if (!pickupCodesMatch(submitted, order.pickup_code)) {
      const attempts = (order.pickup_code_attempts || 0) + 1;
      const update: Record<string, any> = { pickup_code_attempts: attempts };
      if (attempts >= MAX_ATTEMPTS) {
        update.pickup_code_locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
        update.pickup_code_attempts = 0;
      }
      await supabase.from('orders').update(update).eq('id', id);
      return NextResponse.json({ valid: false, alreadyUsed: false, message: 'Code invalide.' });
    }

    // Code correct — enregistre qui/quand, une seule fois possible (la
    // prochaine tentative, même avec le bon code, tombera sur "déjà utilisé").
    await supabase
      .from('orders')
      .update({
        pickup_code_verified_at: new Date().toISOString(),
        pickup_code_verified_by: profile!.id,
      })
      .eq('id', id);

    const { data: allOrders } = await supabase.from('orders').select('id, created_at');
    const orderNumber = buildOrderNumberMap(allOrders || []).get(id) ?? null;
    const customerName = (order as any).profile?.full_name || (order as any).profile?.email || '—';

    return NextResponse.json({
      valid: true,
      alreadyUsed: false,
      orderNumber,
      customerName,
      message: `Code valide — commande ${orderNumber != null ? `n°${orderNumber}` : ''}, client ${customerName}`,
    });
  } catch (err) {
    console.error('verify-pickup-code error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
