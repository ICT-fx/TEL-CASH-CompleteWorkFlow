import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// POST /api/admin/orders/[id]/ship — confirm shipping with IMEI tracking + photos
//
// Required: an IMEI for each order_item (proves which exact phone was shipped),
// at least one shipping photo (evidence pack for chargeback disputes),
// and ideally a tracking_number. Transitions order.status -> 'shipped'.
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
      item_imeis: Record<string, string>;
      shipping_photos: string[];
      tracking_number?: string;
      tracking_url?: string;
    };

    if (!item_imeis || Object.keys(item_imeis).length === 0) {
      return NextResponse.json({ error: 'IMEI(s) requis pour chaque article' }, { status: 400 });
    }
    if (!shipping_photos || shipping_photos.length === 0) {
      return NextResponse.json(
        { error: 'Au moins une photo d\'expédition est requise (preuve anti-chargeback)' },
        { status: 400 }
      );
    }

    // Light IMEI format check: 14-17 digits to allow IMEI-14 / IMEI-15 / IMEISV.
    for (const [itemId, imei] of Object.entries(item_imeis)) {
      if (!/^\d{14,17}$/.test(String(imei).trim())) {
        return NextResponse.json(
          { error: `IMEI invalide pour l'article ${itemId} (doit contenir 14 à 17 chiffres)` },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();

    // Update each order_item with shipped IMEI.
    for (const [itemId, imei] of Object.entries(item_imeis)) {
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
      shipping_photos,
      shipping_confirmed_at: new Date().toISOString(),
    };
    if (tracking_number) updateData.tracking_number = tracking_number;
    if (tracking_url) updateData.tracking_url = tracking_url;

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: orderErr?.message || 'Commande introuvable' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error('Ship error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
