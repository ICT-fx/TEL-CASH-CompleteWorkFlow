// Synchronisation du n° de suivi Chronopost depuis Boxtal — serveur uniquement.
//
// Boxtal V3 est asynchrone : à la création du bordereau on n'a que la
// référence INTERNE Boxtal (stockée "BX:<id>" dans orders.tracking_number).
// Le vrai n° Chronopost (ex. XN200208964JB) n'est exposé par
// /shipping-order/{id}/tracking qu'une fois le colis pris en charge. Cette
// fonction le récupère, le remplace en base, puis envoie ENFIN au client
// l'email « commande expédiée » avec le bon numéro et le lien de suivi.
//
// Appelée par le cron /api/cron/boxtal-tracking et à l'ouverture d'une
// commande dans l'admin (best-effort).
import type { createAdminClient } from '@/lib/supabase-admin';
import {
  isBoxtalConfigured, isPendingBoxtalRef, boxtalIdFromRef, getTracking,
  chronopostTrackingUrl, looksLikeCarrierTracking,
} from '@/lib/boxtal';
import { sendShippedEmail } from '@/lib/email';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { orderCustomerEmail, orderCustomerName } from '@/lib/orderCustomer';
import { getOrderInvoiceLinksSafe, bestInvoiceLink } from '@/lib/invoice';

type Db = ReturnType<typeof createAdminClient>;

export interface SyncResult {
  orderId: string;
  updated: boolean;
  trackingNumber?: string;
  emailSent?: boolean;
  reason?: string;
}

export async function syncOrderTracking(db: Db, order: any): Promise<SyncResult> {
  const res: SyncResult = { orderId: order.id, updated: false };
  if (!isBoxtalConfigured()) return { ...res, reason: 'Boxtal non configuré' };
  if (!isPendingBoxtalRef(order.tracking_number)) return { ...res, reason: 'rien en attente' };

  const t = await getTracking(boxtalIdFromRef(order.tracking_number));
  if (!t.trackingNumber) return { ...res, reason: 'n° Chronopost pas encore attribué' };
  if (!looksLikeCarrierTracking(t.trackingNumber)) {
    // On préfère ne rien envoyer plutôt qu'un numéro douteux.
    return { ...res, reason: `format inattendu : ${t.trackingNumber}` };
  }

  const trackingUrl = t.trackingUrl || chronopostTrackingUrl(t.trackingNumber);
  // Garde anti-double-email : la mise à jour ne passe que si la ligne contient
  // encore la référence BX: (si deux synchros tournent en même temps, une seule gagne).
  const { data: updatedRows, error } = await db
    .from('orders')
    .update({ tracking_number: t.trackingNumber, tracking_url: trackingUrl })
    .eq('id', order.id)
    .eq('tracking_number', order.tracking_number)
    .select('id');
  if (error) return { ...res, reason: `erreur base : ${error.message}` };
  if (!updatedRows || updatedRows.length === 0) return { ...res, reason: 'déjà synchronisée' };

  res.updated = true;
  res.trackingNumber = t.trackingNumber;

  const to = orderCustomerEmail(order);
  if (to) {
    const { data: allOrders } = await db.from('orders').select('id, created_at');
    const n = buildOrderNumberMap(allOrders || []).get(order.id);
    const invoice = await getOrderInvoiceLinksSafe(order);
    const r = await sendShippedEmail({
      to,
      customerName: orderCustomerName(order),
      orderNumber: n != null ? `n°${n}` : `#${String(order.id).slice(0, 8)}`,
      trackingNumber: t.trackingNumber,
      trackingUrl,
      invoiceUrl: bestInvoiceLink(invoice),
    });
    res.emailSent = r.sent;
    if (!r.sent) res.reason = `email non envoyé : ${r.reason}`;
  }
  return res;
}

// Toutes les commandes domicile dont le n° Chronopost est encore en attente.
export async function syncAllPendingTracking(db: Db): Promise<SyncResult[]> {
  const { data: orders } = await db
    .from('orders')
    .select('*, profile:profiles(email, full_name, phone)')
    .like('tracking_number', 'BX:%')
    .neq('delivery_method', 'pickup')
    .not('status', 'in', '(cancelled,refunded)');
  const results: SyncResult[] = [];
  for (const o of orders || []) {
    try {
      results.push(await syncOrderTracking(db, o));
    } catch (e: any) {
      results.push({ orderId: o.id, updated: false, reason: e?.message || 'erreur' });
    }
  }
  return results;
}
