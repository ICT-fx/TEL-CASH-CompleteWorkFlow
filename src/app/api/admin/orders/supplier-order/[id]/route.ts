import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/orders/supplier-order/[id] — Récupère un bon de commande
// fournisseur enregistré (pour la page imprimable).
export async function GET(
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
      .select('id, po_number, lines, total_units, created_at, status, approved_at')
      .eq('id', id)
      .single();

    if (error || !po) {
      return NextResponse.json({ error: 'Bon introuvable' }, { status: 404 });
    }

    return NextResponse.json({ supplierOrder: po });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
