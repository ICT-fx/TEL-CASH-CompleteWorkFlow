import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { sendPickupReadyEmail } from '@/lib/email';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { generatePickupCode, stripPickupCodeSecrets } from '@/lib/pickupCode';

// POST /api/admin/orders/[id]/ship — confirm shipping (domicile) or pickup
// readiness (retrait boutique) with IMEI tracking + photos.
//
// Domicile : un IMEI par order_item (preuve du téléphone exact envoyé) et au
// moins une photo d'expédition (dossier anti-chargeback) restent obligatoires.
// Retrait boutique : remise en main propre, pièce d'identité vérifiée sur
// place — IMEI et photos deviennent optionnels. Transitions order.status ->
// 'shipped' dans les deux cas (même cycle de statuts ; le libellé "Prête à
// retirer" n'est qu'un affichage côté admin/emails — cf. lib/shipping.ts).
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const body = await request.json();
    const {
      item_imeis,         // { [order_item_id]: imei }
      shipping_photos,    // string[] URLs
      tracking_number,
      tracking_url,
    } = body as {
      item_imeis?: Record<string, string>;
      shipping_photos?: string[];
      tracking_number?: string;
      tracking_url?: string;
    };

    const supabase = createAdminClient();

    const { data: order } = await supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name, phone)')
      .eq('id', id)
      .single();
    if (!order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }
    const isPickup = order.delivery_method === 'pickup';

    // Filet de sécurité : le code est censé être généré au paiement (webhook
    // Stripe), mais si jamais il manque (commande créée avant cette
    // fonctionnalité, webhook en échec...), on ne doit jamais envoyer un
    // email "prête à retirer" sans code — on le génère ici en dernier recours.
    if (isPickup && !order.pickup_code) {
      order.pickup_code = generatePickupCode();
      await supabase.from('orders').update({ pickup_code: order.pickup_code }).eq('id', id);
    }

    if (!isPickup && (!shipping_photos || shipping_photos.length === 0)) {
      return NextResponse.json(
        { error: 'Au moins une photo d\'expédition est requise (preuve anti-chargeback)' },
        { status: 400 }
      );
    }

    // Seuls les TÉLÉPHONES exigent un IMEI ; les accessoires (verre, protection
    // posée, câbles…) n'en ont pas. On lit les catégories en base pour exiger un
    // IMEI valide par téléphone, sans bloquer une commande contenant un accessoire.
    // En retrait boutique, l'IMEI reste saisissable mais n'est plus obligatoire.
    if (!isPickup) {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id, product:products(category)')
        .eq('order_id', id);
      const phoneItemIds = (orderItems || [])
        .filter((it: any) => (it.product?.category || '') !== 'accessoires')
        .map((it: any) => it.id as string);

      for (const itemId of phoneItemIds) {
        const imei = item_imeis?.[itemId];
        // Light IMEI format check: 14-17 digits to allow IMEI-14 / IMEI-15 / IMEISV.
        if (!imei || !/^\d{14,17}$/.test(String(imei).trim())) {
          return NextResponse.json(
            { error: `IMEI requis et valide (14 à 17 chiffres) pour chaque téléphone (article ${itemId})` },
            { status: 400 }
          );
        }
      }
    }

    // Update each order_item with shipped IMEI (accessoires, ou champ laissé
    // vide en retrait boutique : aucun IMEI écrit).
    for (const [itemId, imei] of Object.entries(item_imeis || {})) {
      if (!String(imei || '').trim()) continue;
      const { error: itemErr } = await supabase
        .from('order_items')
        .update({ imei_shipped: String(imei).trim() })
        .eq('id', itemId)
        .eq('order_id', id);
      if (itemErr) {
        return NextResponse.json({ error: `Erreur IMEI article ${itemId}: ${itemErr.message}` }, { status: 500 });
      }
    }

    // Update order with shipping evidence + status transition.
    const updateData: Record<string, any> = {
      status: 'shipped',
      shipping_photos: shipping_photos || [],
      shipping_confirmed_at: new Date().toISOString(),
    };
    if (tracking_number) updateData.tracking_number = tracking_number;
    if (tracking_url) updateData.tracking_url = tracking_url;

    const { data: updatedOrder, error: orderErr } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (orderErr || !updatedOrder) {
      return NextResponse.json({ error: orderErr?.message || 'Commande introuvable' }, { status: 404 });
    }

    // Email client « prête à retirer » — uniquement pour le retrait boutique.
    // Le domicile envoie son email d'expédition depuis shipping-label/route.ts,
    // jamais appelé pour une commande pickup (pas de bordereau à générer).
    let email: { sent: boolean; reason?: string } | undefined;
    if (isPickup && order.profile?.email) {
      const { data: allOrders } = await supabase.from('orders').select('id, created_at');
      const orderNumber = buildOrderNumberMap(allOrders || []).get(id) || `#${String(id).slice(0, 8)}`;
      email = await sendPickupReadyEmail({
        to: order.profile.email,
        customerName: order.profile.full_name || null,
        orderNumber: `n°${orderNumber}`,
        pickupCode: order.pickup_code,
      });
    }

    // Le code de retrait ne doit jamais atteindre le navigateur admin.
    return NextResponse.json({ order: stripPickupCodeSecrets(updatedOrder), email });
  } catch (err) {
    console.error('Ship error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
