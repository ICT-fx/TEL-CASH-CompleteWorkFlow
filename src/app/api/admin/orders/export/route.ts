import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { statusLabelFr } from '@/components/admin/ui/StatusBadge';

// GET /api/admin/orders/export — Export CSV des commandes payées/expédiées/
// livrées, pour un suivi comptable (ouverture directe dans Excel). Ce n'est
// PAS un export des factures PDF Stripe elles-mêmes (générées et envoyées
// par Stripe — cf. commentaire dans lib/email.ts) : juste un récapitulatif
// tabulaire des ventes facturées, que Stripe n'offre pas prêt-à-l'emploi
// filtré sur CE catalogue.
const EXPORTABLE_STATUSES = ['paid', 'shipped', 'delivered'];

function csvCell(value: string): string {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const supabase = createAdminClient();
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, total_amount, delivery_method, created_at, profile:profiles(full_name, email)')
    .in('status', EXPORTABLE_STATUSES)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response('Erreur export', { status: 400 });
  }

  const { data: allOrders } = await supabase.from('orders').select('id, created_at');
  const numberMap = buildOrderNumberMap(allOrders || []);

  const header = ['N° commande', 'Date', 'Client', 'Email', 'Mode de livraison', 'Statut', 'Montant TTC (€)'];
  const rows = (orders || []).map((o: any) => [
    numberMap.get(o.id) != null ? `n°${numberMap.get(o.id)}` : o.id.slice(0, 8).toUpperCase(),
    new Date(o.created_at).toLocaleDateString('fr-FR'),
    o.profile?.full_name || '',
    o.profile?.email || '',
    o.delivery_method === 'pickup' ? 'Retrait boutique' : 'Domicile',
    statusLabelFr(o.status),
    parseFloat(o.total_amount || '0').toFixed(2).replace('.', ','),
  ]);

  // BOM UTF-8 pour qu'Excel affiche correctement les accents à l'ouverture.
  const csv = '﻿' + [header, ...rows]
    .map((r) => r.map((c) => csvCell(String(c))).join(';'))
    .join('\r\n');

  const filename = `factures-tel-and-cash-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
