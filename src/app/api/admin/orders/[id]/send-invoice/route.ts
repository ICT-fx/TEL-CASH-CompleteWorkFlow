import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { getOrderInvoiceLinks } from '@/lib/invoice';
import { sendInvoiceEmail } from '@/lib/email';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { orderCustomerEmail, orderCustomerName } from '@/lib/orderCustomer';

export const runtime = 'nodejs';

// POST /api/admin/orders/[id]/send-invoice — envoie VRAIMENT la facture au
// client (avant : bouton factice « bientôt disponible »). Récupère le lien de
// la facture Stripe de la commande et l'envoie par email ; enregistre aussi
// le lien dans stripe_receipt_url pour que le client le retrouve dans
// « Mon compte → Mes commandes ».
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
    if (!order.stripe_session_id && !order.stripe_payment_intent) {
      return NextResponse.json({ error: 'Commande sans paiement Stripe — aucune facture à envoyer.' }, { status: 400 });
    }

    const to = orderCustomerEmail(order);
    if (!to) return NextResponse.json({ error: 'Aucun email client sur la commande.' }, { status: 400 });

    let links;
    try {
      links = await getOrderInvoiceLinks(order);
    } catch (e: any) {
      return NextResponse.json({ error: `Stripe : ${e?.message || 'facture introuvable'}` }, { status: 502 });
    }
    const url = links.invoiceUrl || links.invoicePdf || links.receiptUrl;
    if (!url) {
      return NextResponse.json({ error: 'Aucune facture ni reçu trouvé chez Stripe pour cette commande.' }, { status: 404 });
    }

    const { data: allOrders } = await supabase.from('orders').select('id, created_at');
    const n = buildOrderNumberMap(allOrders || []).get(id);
    const result = await sendInvoiceEmail({
      to,
      customerName: orderCustomerName(order),
      orderNumber: n != null ? `n°${n}` : `#${id.slice(0, 8)}`,
      invoiceUrl: url,
      invoicePdf: links.invoicePdf,
      isReceipt: !links.invoiceUrl && !links.invoicePdf,
    });
    if (!result.sent) {
      return NextResponse.json({ error: `Email non envoyé : ${result.reason}` }, { status: 502 });
    }

    if (!order.stripe_receipt_url) {
      await supabase.from('orders').update({ stripe_receipt_url: url }).eq('id', id);
    }
    return NextResponse.json({ sent: true, to, isInvoice: Boolean(links.invoiceUrl || links.invoicePdf) });
  } catch (err: any) {
    console.error('send-invoice error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}
