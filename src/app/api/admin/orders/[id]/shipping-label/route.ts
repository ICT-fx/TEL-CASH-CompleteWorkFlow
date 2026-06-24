import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import {
  isBoxtalConfigured,
  createBoxtalShipment,
  downloadBoxtalLabel,
  parcelWeightKg,
  boxtalBase,
  type BoxtalAddress,
} from '@/lib/boxtal';
import { sendShippedEmail, isEmailConfigured } from '@/lib/email';
import { buildOrderNumberMap } from '@/lib/orderNumber';

export const runtime = 'nodejs';

const LABELS_BUCKET = 'shipping-labels';

function countryIso(v: string | null | undefined): string {
  const s = (v || '').trim();
  if (!s) return 'FR';
  if (s.length === 2) return s.toUpperCase();
  if (/france/i.test(s)) return 'FR';
  return s.slice(0, 2).toUpperCase();
}

// Adresse client à partir de order.shipping_address (forme du checkout) + email.
function customerAddress(addr: any, email: string, phoneFallback: string): BoxtalAddress {
  const street = (addr?.address || '').trim();
  const numMatch = street.match(/^(\d+)/);
  return {
    type: 'RESIDENTIAL',
    email,
    phone: (addr?.phone || phoneFallback || '').toString(),
    firstName: addr?.firstName || '',
    lastName: addr?.lastName || '',
    number: numMatch ? numMatch[1] : null,
    street: numMatch ? street.replace(/^\d+\s*/, '') : street,
    postalCode: (addr?.zipCode || addr?.postalCode || '').toString(),
    city: addr?.city || '',
    countryIsoCode: countryIso(addr?.country),
  };
}

async function ensureBucket(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase.storage.listBuckets();
  if (!data?.some((b) => b.name === LABELS_BUCKET)) {
    await supabase.storage.createBucket(LABELS_BUCKET, { public: false });
  }
}

// POST — génère le bordereau Boxtal (Chronopost express) pour la commande.
// Idempotent : ne régénère pas si un suivi existe déjà, sauf ?regenerate=true.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { response } = await requireAdmin();
    if (response) return response;

    if (!isBoxtalConfigured()) {
      return NextResponse.json({ error: 'Configurer Boxtal (clés API manquantes).' }, { status: 400 });
    }

    const url = new URL(request.url);
    const regenerate = url.searchParams.get('regenerate') === 'true';

    const supabase = createAdminClient();
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name, phone)')
      .eq('id', id)
      .single();
    if (error || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    // Idempotence : bordereau déjà généré → on renvoie l'existant.
    if (order.tracking_number && !regenerate) {
      return NextResponse.json({
        alreadyGenerated: true,
        tracking_number: order.tracking_number,
        tracking_url: order.tracking_url,
      });
    }

    if (!order.shipping_address) {
      return NextResponse.json({ error: 'Aucune adresse de livraison sur la commande.' }, { status: 400 });
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, product:products(category, product_type)')
      .eq('order_id', id);
    const weightKg = parcelWeightKg(
      (items || []).map((it: any) => ({
        category: it.product?.category,
        product_type: it.product?.product_type,
        quantity: it.quantity,
      })),
    );

    const customerEmail =
      order.profile?.email || order.shipping_address?.email || 'client@telandcash.fr';
    const customer = customerAddress(order.shipping_address, customerEmail, order.profile?.phone || '');

    // Adresse minimale requise par Chronopost.
    if (!customer.postalCode || !customer.city || !customer.street) {
      return NextResponse.json({ error: 'Adresse de livraison incomplète (rue, code postal, ville).' }, { status: 400 });
    }

    let shipment;
    try {
      shipment = await createBoxtalShipment({
        orderId: order.id,
        totalAmount: Number(order.total_amount) || 1,
        customer,
        weightKg,
      });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Erreur Boxtal.' }, { status: 502 });
    }

    // Téléchargement + stockage du PDF (si Boxtal a fourni une URL de label).
    let labelStored = false;
    if (shipment.labelUrl) {
      try {
        const pdf = await downloadBoxtalLabel(shipment.labelUrl);
        await ensureBucket(supabase);
        await supabase.storage
          .from(LABELS_BUCKET)
          .upload(`orders/${id}.pdf`, pdf, { contentType: 'application/pdf', upsert: true });
        labelStored = true;
      } catch (e) {
        console.error('Boxtal label storage error:', e);
      }
    }

    // Référence de suivi : n° Chronopost si déjà connu, sinon la référence
    // d'expédition Boxtal (le n° Chronopost définitif arrive à la prise en charge).
    const reference = shipment.trackingNumber || shipment.orderId || null;

    // Persistance : référence de suivi + lien + statut de préparation.
    const update: Record<string, any> = {};
    if (reference) update.tracking_number = reference;
    if (shipment.trackingUrl) update.tracking_url = shipment.trackingUrl;
    update.fulfillment_status = 'shipped';
    update.shipping_confirmed_at = new Date().toISOString();
    await supabase.from('orders').update(update).eq('id', id);

    // Email client « commande expédiée » (best-effort, jamais bloquant).
    let email: { sent: boolean; reason?: string } = { sent: false, reason: 'non envoyé' };
    if (reference) {
      const { data: allOrders } = await supabase.from('orders').select('id, created_at');
      const orderNumber = buildOrderNumberMap(allOrders || []).get(id) || `#${String(id).slice(0, 8)}`;
      email = await sendShippedEmail({
        to: customerEmail,
        customerName: order.profile?.full_name || order.shipping_address?.firstName || null,
        orderNumber: `n°${orderNumber}`,
        trackingNumber: reference,
        trackingUrl: shipment.trackingUrl || null,
      });
    }

    return NextResponse.json({
      success: true,
      tracking_number: reference,
      tracking_url: shipment.trackingUrl,
      boxtal_order_id: shipment.orderId,
      label_stored: labelStored,
      label_available: Boolean(shipment.labelUrl || labelStored),
      email,
      // Réponse brute Boxtal : utile pour confirmer les champs label/suivi exacts
      // lors du premier vrai test (sandbox / prod).
      boxtal_raw: shipment.raw,
      env_base: boxtalBase(),
    });
  } catch (err: any) {
    console.error('shipping-label POST error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}

// GET — renvoie le PDF du bordereau stocké (téléchargement admin).
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(LABELS_BUCKET).download(`orders/${id}.pdf`);
    if (error || !data) {
      return NextResponse.json({ error: 'Bordereau introuvable.' }, { status: 404 });
    }
    const buf = Buffer.from(await data.arrayBuffer());
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="bordereau-${String(id).slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
