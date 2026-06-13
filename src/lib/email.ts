// Envoi d'emails transactionnels via Resend (API HTTP directe — pas de dépendance
// npm). Serveur uniquement (lit RESEND_API_KEY).
//
// Si RESEND_API_KEY est absente, l'envoi est ignoré proprement (aucun crash) :
// la génération du bordereau ne doit jamais échouer à cause de l'email.

function env(n: string): string {
  return (process.env[n] || '').trim();
}

export function isEmailConfigured(): boolean {
  return Boolean(env('RESEND_API_KEY'));
}

export interface EmailResult {
  sent: boolean;
  reason?: string;
}

async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  if (!isEmailConfigured()) return { sent: false, reason: 'RESEND_API_KEY absente' };
  if (!to) return { sent: false, reason: 'destinataire manquant' };
  const from = env('RESEND_FROM') || 'TEL & CASH <contact@telandcash.fr>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
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

// Email « Votre commande est expédiée » avec n° de suivi + lien Chronopost.
export async function sendShippedEmail(opts: {
  to: string;
  customerName?: string | null;
  orderNumber: string;
  trackingNumber: string;
  trackingUrl: string;
}): Promise<EmailResult> {
  const name = (opts.customerName || '').trim();
  const subject = `Votre commande ${opts.orderNumber} est expédiée ✦ TEL & CASH`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1437">
    <div style="background:#0B1437;padding:24px;border-radius:16px 16px 0 0;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-.5px">TEL <span style="color:#2F6BFF">&amp;</span> CASH</span>
    </div>
    <div style="border:1px solid #eef;border-top:0;padding:28px;border-radius:0 0 16px 16px">
      <h1 style="font-size:20px;margin:0 0 8px">Bonne nouvelle${name ? `, ${name}` : ''} — votre commande est expédiée 🚚</h1>
      <p style="color:#5A6172;font-size:14px;line-height:1.6">
        Votre commande <strong>${opts.orderNumber}</strong> vient de partir en <strong>Chronopost Express</strong> (livraison offerte).
      </p>
      <div style="background:#F7F9FF;border:1px solid #E7EAF1;border-radius:12px;padding:16px;margin:18px 0">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6B7A99;font-weight:700">Numéro de suivi</p>
        <p style="margin:0;font-size:18px;font-weight:800;letter-spacing:.5px">${opts.trackingNumber}</p>
      </div>
      <a href="${opts.trackingUrl}" style="display:inline-block;background:#2F6BFF;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">
        Suivre mon colis
      </a>
      <p style="color:#9AA3B2;font-size:12px;line-height:1.6;margin-top:22px">
        Une question ? Répondez à cet email ou écrivez-nous à contact@telandcash.fr — garantie 24 mois incluse.
      </p>
    </div>
  </div>`;
  return sendEmail(opts.to, subject, html);
}
