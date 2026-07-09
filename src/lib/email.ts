// Envoi d'emails transactionnels via Resend (API HTTP directe — pas de dépendance
// npm). Serveur uniquement (lit RESEND_API_KEY).
//
// Si RESEND_API_KEY est absente, l'envoi est ignoré proprement (aucun crash) :
// la génération du bordereau ne doit jamais échouer à cause de l'email.

function env(n: string): string {
  return (process.env[n] || '').trim();
}

export function isEmailConfigured(): boolean {
  return Boolean(env('SMTP_HOST') || env('RESEND_API_KEY'));
}

// Adresse de la boutique qui reçoit les notifications « nouvelle commande ».
// Priorité : MERCHANT_EMAIL > adresse de l'expéditeur RESEND_FROM > défaut enseigne.
export function merchantEmail(): string {
  const explicit = env('MERCHANT_EMAIL');
  if (explicit) return explicit;
  const from = env('RESEND_FROM');
  // Extrait l'adresse d'un format « Nom <email@x> » si présent.
  const m = from.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  if (from.includes('@')) return from;
  return 'infos@telandcash.fr';
}

export interface EmailResult {
  sent: boolean;
  reason?: string;
}

// Format monétaire FR (12.5 → « 12,50 € »).
function eur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

export interface OrderEmailLine {
  name: string;
  quantity: number;
  unitPrice: number; // prix unitaire payé (€)
}

// Adresse expéditeur commune aux deux transports.
// Priorité : EMAIL_FROM > RESEND_FROM > SMTP_USER > défaut enseigne.
function fromAddress(): string {
  return (
    env('EMAIL_FROM') ||
    env('RESEND_FROM') ||
    env('SMTP_USER') ||
    'TEL & CASH <infos@telandcash.fr>'
  );
}

// Envoi via le SMTP de la boîte pro du domaine (OVH, IONOS, Gandi…).
// Transport retenu dès que SMTP_HOST est défini. Port 465 = SSL implicite,
// 587 = STARTTLS. nodemailer est importé dynamiquement (serveur uniquement).
async function sendViaSmtp(to: string, subject: string, html: string): Promise<EmailResult> {
  const host = env('SMTP_HOST');
  const port = parseInt(env('SMTP_PORT') || '465', 10);
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASSWORD');
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
    await transporter.sendMail({ from: fromAddress(), to, subject, html });
    return { sent: true };
  } catch (e: any) {
    return { sent: false, reason: e?.message || 'erreur SMTP' };
  }
}

// Envoi via l'API HTTP Resend (fallback si aucun SMTP configuré).
async function sendViaResend(to: string, subject: string, html: string): Promise<EmailResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddress(), to, subject, html }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { sent: false, reason: `Resend HTTP ${res.status} ${t}`.trim() };
    }
    return { sent: true };
  } catch (e: any) {
    return { sent: false, reason: e?.message || 'erreur réseau' };
  }
}

// Dispatcher : SMTP en priorité (boîte pro du domaine), sinon Resend.
async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  if (!to) return { sent: false, reason: 'destinataire manquant' };
  if (env('SMTP_HOST')) return sendViaSmtp(to, subject, html);
  if (env('RESEND_API_KEY')) return sendViaResend(to, subject, html);
  return { sent: false, reason: 'aucun fournisseur email configuré (SMTP_HOST ou RESEND_API_KEY)' };
}

// Email « Votre commande est expédiée » avec n° de suivi + lien Chronopost.
export async function sendShippedEmail(opts: {
  to: string;
  customerName?: string | null;
  orderNumber: string;
  trackingNumber: string;
  trackingUrl?: string | null; // peut être absent tant que Chronopost n'a pas pris en charge
}): Promise<EmailResult> {
  const name = (opts.customerName || '').trim();
  const subject = `Votre commande ${opts.orderNumber} est expédiée ✦ TEL & CASH`;
  const trackBlock = opts.trackingUrl
    ? `<a href="${opts.trackingUrl}" style="display:inline-block;background:#2F6BFF;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Suivre mon colis</a>`
    : `<p style="color:#9AA3B2;font-size:12px;margin:0">Le lien de suivi Chronopost sera actif dès la prise en charge du colis.</p>`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1437">
    <div style="background:#0B1437;padding:24px;border-radius:16px 16px 0 0;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-.5px">TEL <span style="color:#2F6BFF">&amp;</span> CASH</span>
    </div>
    <div style="border:1px solid #eef;border-top:0;padding:28px;border-radius:0 0 16px 16px">
      <h1 style="font-size:20px;margin:0 0 8px">Bonne nouvelle${name ? `, ${name}` : ''} — votre commande est expédiée 🚚</h1>
      <p style="color:#5A6172;font-size:14px;line-height:1.6">
        Votre commande <strong>${opts.orderNumber}</strong> vient de partir en <strong>Chronopost</strong>.
      </p>
      <div style="background:#F7F9FF;border:1px solid #E7EAF1;border-radius:12px;padding:16px;margin:18px 0">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6B7A99;font-weight:700">Référence de suivi</p>
        <p style="margin:0;font-size:18px;font-weight:800;letter-spacing:.5px">${opts.trackingNumber}</p>
      </div>
      ${trackBlock}
      <p style="color:#9AA3B2;font-size:12px;line-height:1.6;margin-top:22px">
        Une question ? Répondez à cet email ou écrivez-nous à infos@telandcash.fr — garantie 24 mois incluse.
      </p>
    </div>
  </div>`;
  return sendEmail(opts.to, subject, html);
}

// Lignes produits rendues en HTML (réutilisé client + marchand).
function renderLines(lines: OrderEmailLine[]): string {
  return lines
    .map(
      (l) => `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#0B1437">${l.quantity}× ${l.name}</td>
        <td style="padding:8px 0;font-size:14px;color:#0B1437;text-align:right;white-space:nowrap">${eur(
          l.unitPrice * l.quantity
        )}</td>
      </tr>`
    )
    .join('');
}

// Email « Confirmation de commande » envoyé au CLIENT à la réception du paiement.
// La facture PDF est, elle, générée et envoyée par Stripe (invoice_creation).
export async function sendOrderConfirmationEmail(opts: {
  to: string;
  customerName?: string | null;
  orderNumber: string;
  lines: OrderEmailLine[];
  total: number;
}): Promise<EmailResult> {
  const name = (opts.customerName || '').trim();
  const subject = `Commande ${opts.orderNumber} confirmée ✦ TEL & CASH`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1437">
    <div style="background:#0B1437;padding:24px;border-radius:16px 16px 0 0;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-.5px">TEL <span style="color:#2F6BFF">&amp;</span> CASH</span>
    </div>
    <div style="border:1px solid #eef;border-top:0;padding:28px;border-radius:0 0 16px 16px">
      <h1 style="font-size:20px;margin:0 0 8px">Merci${name ? `, ${name}` : ''} — votre commande est confirmée ✅</h1>
      <p style="color:#5A6172;font-size:14px;line-height:1.6">
        Nous avons bien reçu votre paiement pour la commande <strong>${opts.orderNumber}</strong>.
        Votre <strong>facture</strong> vous parvient dans un email séparé. Nous préparons votre colis,
        vous recevrez le numéro de suivi Chronopost dès l'expédition.
      </p>
      <div style="background:#F7F9FF;border:1px solid #E7EAF1;border-radius:12px;padding:16px;margin:18px 0">
        <table style="width:100%;border-collapse:collapse">${renderLines(opts.lines)}
          <tr><td colspan="2" style="border-top:1px solid #E7EAF1;padding-top:10px"></td></tr>
          <tr>
            <td style="font-size:15px;font-weight:800">Total payé</td>
            <td style="font-size:15px;font-weight:800;text-align:right">${eur(opts.total)}</td>
          </tr>
        </table>
      </div>
      <p style="color:#9AA3B2;font-size:12px;line-height:1.6;margin-top:22px">
        Une question ? Répondez à cet email ou écrivez-nous à infos@telandcash.fr — garantie 24 mois incluse.
      </p>
    </div>
  </div>`;
  return sendEmail(opts.to, subject, html);
}

// Email « Nouvelle commande » envoyé à la BOUTIQUE (TEL & CASH) à chaque paiement.
// `supplierUnavailable` : articles dont le miroir fournisseur (Fluxitron) était
// grisé au moment du paiement. La commande reste PAYÉE (jamais de remboursement
// automatique) : l'admin vérifie l'approvisionnement et rembourse manuellement
// depuis le dashboard Stripe si elle ne peut pas être honorée.
export async function sendNewOrderMerchantEmail(opts: {
  orderNumber: string;
  orderId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  lines: OrderEmailLine[];
  total: number;
  shippingMethod?: string | null;
  supplierUnavailable?: { name: string; requested: number }[];
}): Promise<EmailResult> {
  const to = merchantEmail();
  const supplierAlert = Boolean(opts.supplierUnavailable && opts.supplierUnavailable.length);
  const subject = supplierAlert
    ? `🛒 Nouvelle commande ${opts.orderNumber} — ${eur(opts.total)} ⚠️ vérifier dispo fournisseur`
    : `🛒 Nouvelle commande ${opts.orderNumber} — ${eur(opts.total)}`;
  const appUrl = (env('NEXT_PUBLIC_APP_URL') || '').replace(/\/$/, '');
  const adminLink = appUrl ? `${appUrl}/admin/orders/${opts.orderId}` : '';
  const supplierBlock = supplierAlert
    ? `<div style="background:#FFFAEB;border:1px solid #F5D998;border-radius:10px;padding:12px;margin:14px 0">
           <p style="margin:0 0 4px;font-weight:800;color:#B54708;font-size:13px">⚠️ Disponibilité fournisseur à vérifier</p>
           <p style="margin:0 0 6px;color:#7A5A0B;font-size:13px">Au moment du paiement, le miroir fournisseur n'indiquait pas de stock pour : ${opts.supplierUnavailable!
             .map((o) => `${o.name} (commandé : ${o.requested})`)
             .join(', ')}.</p>
           <p style="margin:0;color:#7A5A0B;font-size:13px;font-weight:700">La commande est payée. Vérifier l'approvisionnement ; si elle ne peut pas être honorée, rembourser manuellement depuis le dashboard Stripe.</p>
         </div>`
    : '';
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1437">
    <div style="border:1px solid #E7EAF1;border-radius:14px;padding:24px">
      <h1 style="font-size:18px;margin:0 0 6px">🛒 Nouvelle commande payée</h1>
      <p style="color:#5A6172;font-size:14px;margin:0 0 14px">
        <strong>${opts.orderNumber}</strong>${
          opts.customerName ? ` — ${opts.customerName}` : ''
        }${opts.customerEmail ? ` (${opts.customerEmail})` : ''}
      </p>
      ${supplierBlock}
      <table style="width:100%;border-collapse:collapse">${renderLines(opts.lines)}
        <tr><td colspan="2" style="border-top:1px solid #E7EAF1;padding-top:10px"></td></tr>
        <tr>
          <td style="font-size:15px;font-weight:800">Total</td>
          <td style="font-size:15px;font-weight:800;text-align:right">${eur(opts.total)}</td>
        </tr>
      </table>
      <p style="color:#5A6172;font-size:13px;margin:14px 0 0">Livraison : ${
        opts.shippingMethod || '—'
      }</p>
      ${
        adminLink
          ? `<a href="${adminLink}" style="display:inline-block;margin-top:16px;background:#2F6BFF;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:10px">Voir dans l'admin</a>`
          : ''
      }
    </div>
  </div>`;
  return sendEmail(to, subject, html);
}

// Email « Panier abandonné » envoyé au CLIENT ~24 h après un checkout non
// finalisé (commande restée 'pending', jamais payée). Relance simple, une
// seule fois. `promoCode` est plumbé pour une éventuelle offre future (-5 %)
// mais reste optionnel : tant qu'il n'est pas fourni, l'email n'affiche aucune
// remise (relance simple, conformément à la demande).
export async function sendAbandonedCartEmail(opts: {
  to: string;
  customerName?: string | null;
  resumeUrl: string;               // lien pour reprendre le panier (/cart)
  lines: OrderEmailLine[];
  total: number;
  promoCode?: { code: string; label: string } | null; // ex. { code: 'REVIENS-A7K2B', label: '-5 %' }
  unsubscribeUrl?: string; // lien RGPD de désinscription (pied d'email)
}): Promise<EmailResult> {
  const name = (opts.customerName || '').trim();
  const subject = 'Vous avez oublié quelque chose ? ✦ TEL & CASH';
  const promoBlock = opts.promoCode
    ? `<div style="background:#F2FBF5;border:1px solid #CDEBD6;border-radius:12px;padding:16px;margin:18px 0;text-align:center">
         <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#3B8C5A;font-weight:700">Votre code de retour</p>
         <p style="margin:0;font-size:18px;font-weight:800;color:#1B6E3B">${opts.promoCode.code} — ${opts.promoCode.label}</p>
       </div>`
    : '';
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1437">
    <div style="background:#0B1437;padding:24px;border-radius:16px 16px 0 0;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-.5px">TEL <span style="color:#2F6BFF">&amp;</span> CASH</span>
    </div>
    <div style="border:1px solid #eef;border-top:0;padding:28px;border-radius:0 0 16px 16px">
      <h1 style="font-size:20px;margin:0 0 8px">Vous avez oublié quelque chose${name ? `, ${name}` : ''} ? 🛒</h1>
      <p style="color:#5A6172;font-size:14px;line-height:1.6">
        Votre panier vous attend toujours chez TEL &amp; CASH. Nos téléphones reconditionnés
        partent vite — finalisez votre commande avant qu'il ne soit trop tard.
      </p>
      <div style="background:#F7F9FF;border:1px solid #E7EAF1;border-radius:12px;padding:16px;margin:18px 0">
        <table style="width:100%;border-collapse:collapse">${renderLines(opts.lines)}
          <tr><td colspan="2" style="border-top:1px solid #E7EAF1;padding-top:10px"></td></tr>
          <tr>
            <td style="font-size:15px;font-weight:800">Total</td>
            <td style="font-size:15px;font-weight:800;text-align:right">${eur(opts.total)}</td>
          </tr>
        </table>
      </div>
      ${promoBlock}
      <div style="text-align:center;margin:22px 0 6px">
        <a href="${opts.resumeUrl}" style="display:inline-block;background:#2F6BFF;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:10px">Reprendre mon panier</a>
      </div>
      <p style="color:#9AA3B2;font-size:12px;line-height:1.6;margin-top:22px">
        Une question ? Répondez à cet email ou écrivez-nous à infos@telandcash.fr — garantie 24 mois incluse.
      </p>
      ${opts.unsubscribeUrl
        ? `<p style="color:#B7BECC;font-size:11px;line-height:1.5;margin-top:10px">
             Vous ne souhaitez plus recevoir ces relances ?
             <a href="${opts.unsubscribeUrl}" style="color:#B7BECC;text-decoration:underline">Se désinscrire</a>.
           </p>`
        : ''}
    </div>
  </div>`;
  return sendEmail(opts.to, subject, html);
}

// Échappe le HTML d'un texte saisi librement (raison d'annulation) afin d'éviter
// toute injection dans l'email, puis on convertira les sauts de ligne en <br>.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Email « Commande annulée et remboursée » envoyé au CLIENT par l'admin.
// Contient le message personnalisé (raison) + le montant remboursé.
// La facture/avoir éventuel et le reçu de remboursement sont gérés par Stripe.
export async function sendOrderCancelledEmail(opts: {
  to: string;
  customerName?: string | null;
  orderNumber: string;
  reason: string;
  refundAmount: number;
}): Promise<EmailResult> {
  const name = (opts.customerName || '').trim();
  const reasonHtml = escapeHtml(opts.reason.trim()).replace(/\n/g, '<br>');
  const subject = `Votre commande ${opts.orderNumber} a été annulée et remboursée`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1437">
    <div style="background:#0B1437;padding:24px;border-radius:16px 16px 0 0;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-.5px">TEL <span style="color:#2F6BFF">&amp;</span> CASH</span>
    </div>
    <div style="border:1px solid #eef;border-top:0;padding:28px;border-radius:0 0 16px 16px">
      <h1 style="font-size:20px;margin:0 0 8px">Votre commande ${opts.orderNumber} a été annulée</h1>
      <p style="color:#5A6172;font-size:14px;line-height:1.6">
        Bonjour${name ? ` ${name}` : ''}, nous avons dû annuler votre commande
        <strong>${opts.orderNumber}</strong> et vous rembourser intégralement.
      </p>
      <div style="background:#F7F9FF;border:1px solid #E7EAF1;border-radius:12px;padding:16px;margin:18px 0">
        <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6B7A99;font-weight:700">Message de l'équipe</p>
        <p style="margin:0;font-size:14px;color:#0B1437;line-height:1.6">${reasonHtml}</p>
      </div>
      <div style="background:#F2FBF5;border:1px solid #CDEBD6;border-radius:12px;padding:16px;margin:18px 0">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#3B8C5A;font-weight:700">Montant remboursé</p>
        <p style="margin:0;font-size:18px;font-weight:800;color:#1B6E3B">${eur(opts.refundAmount)}</p>
      </div>
      <p style="color:#5A6172;font-size:13px;line-height:1.6">
        Le remboursement apparaîtra sur votre moyen de paiement sous <strong>5 à 10 jours ouvrés</strong>.
        Stripe vous envoie également un reçu de remboursement par email.
      </p>
      <p style="color:#9AA3B2;font-size:12px;line-height:1.6;margin-top:22px">
        Toutes nos excuses pour la gêne occasionnée. Une question ? Répondez à cet email
        ou écrivez-nous à infos@telandcash.fr.
      </p>
    </div>
  </div>`;
  return sendEmail(opts.to, subject, html);
}

// Email « Commande annulée & remboursée » envoyé au CLIENT quand un article
// commandé s'est révélé indisponible au moment réel du paiement (stock épuisé
// chez le fournisseur). Le paiement a été automatiquement remboursé.
export async function sendOrderRefundedEmail(opts: {
  to: string;
  customerName?: string | null;
  orderNumber: string;
  unavailable: string[]; // noms des articles devenus indisponibles
  total: number;
  refunded: boolean; // false = remboursement auto échoué (traitement manuel en cours)
}): Promise<EmailResult> {
  const name = (opts.customerName || '').trim();
  const subject = `Commande ${opts.orderNumber} — article indisponible, vous êtes remboursé`;
  const refundLine = opts.refunded
    ? `Nous venons de vous <strong>rembourser intégralement</strong> (${eur(
        opts.total
      )}). Le montant réapparaîtra sur votre moyen de paiement sous <strong>5 à 10 jours ouvrés</strong>, selon votre banque.`
    : `Votre <strong>remboursement intégral</strong> (${eur(
        opts.total
      )}) est en cours de traitement par notre équipe et vous parviendra sous quelques jours.`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1437">
    <div style="background:#0B1437;padding:24px;border-radius:16px 16px 0 0;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-.5px">TEL <span style="color:#2F6BFF">&amp;</span> CASH</span>
    </div>
    <div style="border:1px solid #eef;border-top:0;padding:28px;border-radius:0 0 16px 16px">
      <h1 style="font-size:20px;margin:0 0 8px">Toutes nos excuses${name ? `, ${name}` : ''} 🙏</h1>
      <p style="color:#5A6172;font-size:14px;line-height:1.6">
        Malheureusement, ${
          opts.unavailable.length > 1 ? 'les articles suivants sont devenus' : "l'article suivant est devenu"
        } <strong>indisponible</strong> juste avant la préparation de votre commande
        <strong>${opts.orderNumber}</strong> :
      </p>
      <div style="background:#FFF7F7;border:1px solid #F3C9C9;border-radius:12px;padding:14px 16px;margin:16px 0">
        <p style="margin:0;color:#7A271A;font-size:14px;font-weight:700">${opts.unavailable.join(', ')}</p>
      </div>
      <p style="color:#5A6172;font-size:14px;line-height:1.6">${refundLine}</p>
      <p style="color:#5A6172;font-size:14px;line-height:1.6">
        Notre stock est habituellement synchronisé en continu, mais ce produit est parti juste avant
        votre paiement. Nous sommes sincèrement désolés pour la déception.
      </p>
      <p style="color:#9AA3B2;font-size:12px;line-height:1.6;margin-top:22px">
        Besoin d'aide pour trouver un modèle équivalent ? Répondez à cet email ou écrivez-nous à infos@telandcash.fr.
      </p>
    </div>
  </div>`;
  return sendEmail(opts.to, subject, html);
}
