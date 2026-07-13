/**
 * Envoi d'un email de relance « panier abandonné » de DÉMONSTRATION, via la vraie
 * fonction src/lib/email.ts (mêmes template + transport que la prod).
 *
 * Pré-requis dans .env.local : un fournisseur d'envoi configuré, soit
 *   RESEND_API_KEY=re_...            (+ optionnel RESEND_FROM="TEL & CASH <onboarding@resend.dev>")
 *   soit SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD.
 * Sans fournisseur, le script le signale et n'envoie rien (aucun crash).
 *
 * Lancement :
 *   npx tsx scripts/send-test-relance.ts                       # -> fantin.schellekens@gmail.com
 *   npx tsx scripts/send-test-relance.ts autre@exemple.com     # -> destinataire au choix
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sendAbandonedCartEmail, isEmailConfigured, merchantEmail } from '../src/lib/email';

// ── Chargeur .env.local minimal (même pattern que les autres scripts) ──────
try {
  const content = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
} catch {
  // .env.local absent — on suppose l'env fourni par le shell.
}

const to = process.argv[2] || 'fantin.schellekens@gmail.com';

async function main() {
  if (!isEmailConfigured()) {
    console.error(
      "\n❌ Aucun fournisseur d'envoi configuré dans .env.local.\n" +
        "   Ajoutez soit RESEND_API_KEY=re_... (le plus simple), soit les SMTP_*.\n" +
        "   Pour un test vers votre propre adresse sans vérifier le domaine, Resend\n" +
        '   autorise l\'expéditeur onboarding@resend.dev :\n' +
        '     RESEND_API_KEY=re_xxxxxxxx\n' +
        '     RESEND_FROM="TEL & CASH <onboarding@resend.dev>"\n'
    );
    process.exit(1);
  }

  console.log(`→ Envoi de la relance de démonstration à ${to} (expéditeur boutique : ${merchantEmail()})…`);
  const res = await sendAbandonedCartEmail({
    to,
    customerName: 'Fantin',
    resumeUrl:
      (process.env.NEXT_PUBLIC_APP_URL || 'https://www.telandcash.fr').replace(/\/$/, '') +
      '/cart?relance=demo1234&promo=REVIENS-A7K2B',
    lines: [
      { name: 'iPhone 13 128 Go — Très bon état', quantity: 1, unitPrice: 389 },
      { name: 'Samsung Galaxy S21 128 Go — Bon état', quantity: 1, unitPrice: 259 },
    ],
    total: 648,
    promoCode: { code: 'REVIENS-A7K2B', label: '-5 %' },
    unsubscribeUrl:
      (process.env.NEXT_PUBLIC_APP_URL || 'https://www.telandcash.fr').replace(/\/$/, '') +
      '/desinscription?token=demo-token',
  });

  if (res.sent) {
    console.log('✅ Email envoyé. Vérifiez la boîte de réception (et les spams).');
  } else {
    console.error(`❌ Envoi échoué : ${res.reason}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('❌ Erreur inattendue :', e?.message || e);
  process.exit(1);
});
