import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// POST /api/admin/orders/supplier-order/[id]/approve
// Approbation admin : bascule les commandes du bon (encore au statut `paid`)
// en `supplier_ordered`, et marque le bon comme `confirmed`. Idempotent.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();

    const { data: po, error } = await supabase
      .from('supplier_orders')
      .select('id, status, order_ids')
      .eq('id', id)
      .single();

    if (error || !po) {
      return NextResponse.json({ error: 'Bon introuvable' }, { status: 404 });
    }

    if (po.status === 'confirmed') {
      return NextResponse.json({ id: po.id, status: 'confirmed', already: true });
    }

    // Bascule uniquement les commandes encore payées (certaines ont pu être
    // annulées / expédiées entre la génération et l'approbation).
    const orderIds: string[] = po.order_ids || [];
    if (orderIds.length > 0) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'supplier_ordered' })
        .in('id', orderIds)
        .eq('status', 'paid');

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
    }

    const { error: confirmError } = await supabase
      .from('supplier_orders')
      .update({ status: 'confirmed', approved_at: new Date().toISOString() })
      .eq('id', id);

    if (confirmError) {
      return NextResponse.json({ error: confirmError.message }, { status: 400 });
    }

    return NextResponse.json({ id: po.id, status: 'confirmed' });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
