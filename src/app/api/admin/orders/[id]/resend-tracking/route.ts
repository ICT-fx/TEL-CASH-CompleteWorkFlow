import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { looksLikeCarrierTracking, chronopostTrackingUrl, isPendingBoxtalRef } from '@/lib/boxtal';
import { syncOrderTracking } from '@/lib/trackingSync';
import { sendShippedEmail } from '@/lib/email';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { orderCustomerEmail, orderCustomerName } from '@/lib/orderCustomer';
import { getOrderInvoiceLinksSafe, bestInvoiceLink } from '@/lib/invoice';

export const runtime = 'nodejs';

// POST /api/admin/orders/[id]/resend-tracking — (re)envoie au client l'email
// d'expédition avec le VRAI n° Chronopost. Sert à corriger les clients qui
// ont reçu la référence Boxtal à la place (bug corrigé le 06/11/2026).
// Body optionnel { tracking_number } : n° Chronopost lu sur le bordereau
// (format XN123456789JB) pour les anciennes commandes sans suivi enregistré.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { response } = await requireAdmin();
    if (response) return response;
    const body = await request.json().catch(() => ({} as any));
    const manual = String(body?.tracking_number || '').trim().toUpperCase().replace(/\s/g, '');

    const supabase = createAdminClient();
    const { data: order } = await supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name, phone)')
      .eq('id', id)
      .single();
    if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    if (order.delivery_method === 'pickup') {
      return NextResponse.json({ error: 'Retrait boutique : pas de suivi Chronopost.' }, { status: 400 });
    }

    if (manual) {
      if (!looksLikeCarrierTracking(manual)) {
        return NextResponse.json({ error: 'Format attendu : 2 lettres + 9 chiffres + 2 lettres (ex. XN200208964JB).' }, { status: 400 });
      }
      await supabase.from('orders')
        .update({ tracking_number: manual, tracking_url: chronopostTrackingUrl(manual) })
        .eq('id', id);
      order.tracking_number = manual;
      order.tracking_url = chronopostTrackingUrl(manual);
    } else if (isPendingBoxtalRef(order.tracking_number)) {
      // Tente d'abord de récupérer le n° chez Boxtal (envoie l'email si trouvé).
      const r = await syncOrderTracking(supabase, order);
      if (r.updated) return NextResponse.json({ sent: Boolean(r.emailSent), tracking_number: r.trackingNumber });
      return NextResponse.json({ error: `N° Chronopost pas encore disponible (${r.reason}).` }, { status: 409 });
    }

    if (!looksLikeCarrierTracking(order.tracking_number)) {
      return NextResponse.json({ error: 'Aucun n° Chronopost valide sur la commande — saisis celui du bordereau.' }, { status: 400 });
    }
    const to = orderCustomerEmail(order);
    if (!to) return NextResponse.json({ error: 'Aucun email client sur la commande.' }, { status: 400 });

    const { data: allOrders } = await supabase.from('orders').select('id, created_at');
    const n = buildOrderNumberMap(allOrders || []).get(id);
    const invoice = await getOrderInvoiceLinksSafe(order);
    const r = await sendShippedEmail({
      to,
      customerName: orderCustomerName(order),
      orderNumber: n != null ? `n°${n}` : `#${id.slice(0, 8)}`,
      trackingNumber: order.tracking_number,
      trackingUrl: order.tracking_url || chronopostTrackingUrl(order.tracking_number),
      invoiceUrl: bestInvoiceLink(invoice),
    });
    if (!r.sent) return NextResponse.json({ error: `Email non envoyé : ${r.reason}` }, { status: 502 });
    return NextResponse.json({ sent: true, tracking_number: order.tracking_number });
  } catch (err: any) {
    console.error('resend-tracking error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}
