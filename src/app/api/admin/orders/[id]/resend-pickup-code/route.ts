import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { sendPickupReadyEmail } from '@/lib/email';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { generatePickupCode } from '@/lib/pickupCode';
import { orderCustomerEmail, orderCustomerName } from '@/lib/orderCustomer';
import { getOrderInvoiceLinksSafe, bestInvoiceLink } from '@/lib/invoice';

export const runtime = 'nodejs';

// POST /api/admin/orders/[id]/resend-pickup-code — renvoie au client l'email
// « prête à retirer » avec son code (client qui ne le retrouve pas, ou
// commande passée en "prête" par le menu de statut sans que l'email parte).
// Le code n'est jamais renvoyé à l'admin : il part uniquement par email.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();
    const { data: order } = await supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name, phone)')
      .eq('id', id)
      .single();
    if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    if (order.delivery_method !== 'pickup') {
      return NextResponse.json({ error: "Ce n'est pas un retrait en boutique." }, { status: 400 });
    }
    if (order.status !== 'shipped') {
      return NextResponse.json({ error: 'La commande doit être « prête à retirer » pour renvoyer le code.' }, { status: 400 });
    }
    if (order.pickup_code_verified_at) {
      return NextResponse.json({ error: 'Code déjà utilisé : la commande a déjà été remise.' }, { status: 400 });
    }

    if (!order.pickup_code) {
      order.pickup_code = generatePickupCode();
      const { error } = await supabase.from('orders').update({ pickup_code: order.pickup_code }).eq('id', id);
      if (error) return NextResponse.json({ error: `Code non enregistré : ${error.message}` }, { status: 500 });
    }
    const to = orderCustomerEmail(order);
    if (!to) return NextResponse.json({ error: 'Aucun email client sur la commande.' }, { status: 400 });

    const { data: allOrders } = await supabase.from('orders').select('id, created_at');
    const n = buildOrderNumberMap(allOrders || []).get(id);
    const invoice = await getOrderInvoiceLinksSafe(order);
    const r = await sendPickupReadyEmail({
      to,
      customerName: orderCustomerName(order),
      orderNumber: n != null ? `n°${n}` : `#${id.slice(0, 8)}`,
      pickupCode: order.pickup_code,
      invoiceUrl: bestInvoiceLink(invoice),
    });
    if (!r.sent) return NextResponse.json({ error: `Email non envoyé : ${r.reason}` }, { status: 502 });
    return NextResponse.json({ sent: true, to });
  } catch (err: any) {
    console.error('resend-pickup-code error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}
