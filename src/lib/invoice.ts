// Liens de facture d'une commande, lus chez Stripe — serveur uniquement.
//
// Contexte (bug du 06/11/2026) : la facture PDF n'était envoyée QUE par Stripe,
// et seulement si l'option « E-mails clients → Paiements réussis » était
// activée dans le Dashboard Stripe. Le bouton admin « Envoyer la facture »
// n'était qu'un toast « bientôt disponible ». Résultat : les clients ne
// recevaient pas leur facture. Désormais le site récupère lui-même le lien
// de la facture et l'envoie par son propre canal email.
//
// La facture existe car le checkout crée la session avec invoice_creation
// (cf. api/checkout/route.ts). Repli : le reçu de paiement Stripe si aucune
// facture n'est rattachée (commandes antérieures à invoice_creation).
import { stripe } from '@/lib/stripe';

export interface OrderInvoiceLinks {
  invoiceUrl: string | null;   // page facture Stripe hébergée (consultable + PDF)
  invoicePdf: string | null;   // lien direct PDF
  receiptUrl: string | null;   // reçu de paiement (repli)
  invoiceNumber: string | null;
}

export async function getOrderInvoiceLinks(order: {
  stripe_session_id?: string | null;
  stripe_payment_intent?: string | null;
}): Promise<OrderInvoiceLinks> {
  const out: OrderInvoiceLinks = { invoiceUrl: null, invoicePdf: null, receiptUrl: null, invoiceNumber: null };

  if (order.stripe_session_id) {
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id, {
      expand: ['invoice', 'payment_intent.latest_charge'],
    });
    const inv = session.invoice as any;
    if (inv && typeof inv === 'object') {
      out.invoiceUrl = inv.hosted_invoice_url || null;
      out.invoicePdf = inv.invoice_pdf || null;
      out.invoiceNumber = inv.number || null;
    }
    const pi = session.payment_intent as any;
    const charge = pi && typeof pi === 'object' ? pi.latest_charge : null;
    if (charge && typeof charge === 'object') out.receiptUrl = charge.receipt_url || null;
  }

  if (!out.receiptUrl && order.stripe_payment_intent) {
    const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent, { expand: ['latest_charge'] });
    const charge = pi.latest_charge as any;
    if (charge && typeof charge === 'object') out.receiptUrl = charge.receipt_url || null;
  }

  return out;
}

// Version « ne lève jamais » pour les emails best-effort (expédition, retrait).
export async function getOrderInvoiceLinksSafe(order: {
  stripe_session_id?: string | null;
  stripe_payment_intent?: string | null;
}): Promise<OrderInvoiceLinks | null> {
  try {
    return await getOrderInvoiceLinks(order);
  } catch (e) {
    console.warn('Lien facture Stripe indisponible:', e);
    return null;
  }
}

// Lien à montrer au client : facture si elle existe, sinon reçu.
export function bestInvoiceLink(l: OrderInvoiceLinks | null): string | null {
  if (!l) return null;
  return l.invoiceUrl || l.invoicePdf || l.receiptUrl || null;
}
