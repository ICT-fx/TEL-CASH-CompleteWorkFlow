// Diagnostic PAIEMENTS — pour chaque commande annulée/échouée en base, récupère
// le motif EXACT côté Stripe (lecture seule) et classe : payé / refusé banque /
// abandon (session expirée) / erreur technique. Détecte aussi une DÉSYNC
// (payé chez Stripe mais annulé chez nous).
//
//   node scripts/check-stripe-orders.mjs
//
// ⚠️ Les commandes de prod ont des sessions « cs_live_… » : il faut la clé Stripe
// LIVE pour les lire. Mets temporairement STRIPE_SECRET_KEY=sk_live_… dans
// .env.local (puis remets la clé test). Une clé test ne peut pas lire un objet live.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });
const keyMode = env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'LIVE' : 'TEST';
console.log(`Clé Stripe : ${keyMode}\n`);

const { data: orders } = await sb.from('orders')
  .select('id, status, total_amount, created_at, stripe_session_id, stripe_payment_intent')
  .in('status', ['cancelled', 'failed', 'refunded'])
  .order('created_at', { ascending: false });

let refusClient = 0, abandon = 0, technique = 0, payeDesync = 0, illisible = 0;

for (const o of orders) {
  const tag = `#${o.id.slice(0, 8)} (${o.status}, ${o.total_amount}€)`;
  if (!o.stripe_session_id) { console.log(`${tag} : aucune session Stripe`); technique++; continue; }
  const liveSession = o.stripe_session_id.startsWith('cs_live');
  if ((keyMode === 'TEST') && liveSession) {
    console.log(`${tag} : session LIVE non lisible avec une clé TEST → relancer avec sk_live_`);
    illisible++; continue;
  }
  try {
    const s = await stripe.checkout.sessions.retrieve(o.stripe_session_id, { expand: ['payment_intent'] });
    const pi = typeof s.payment_intent === 'object' ? s.payment_intent : null;
    const err = pi?.last_payment_error;
    const paid = s.payment_status === 'paid';
    let verdict;
    if (paid) { verdict = '🔴 PAYÉ chez Stripe mais annulé chez nous → DÉSYNC GRAVE'; payeDesync++; }
    else if (err) { verdict = `❌ Refus paiement : ${err.code || err.decline_code || err.type} — ${err.message}`; refusClient++; }
    else if (s.status === 'expired') { verdict = '🟡 Session EXPIRÉE sans paiement (abandon panier) — normal'; abandon++; }
    else { verdict = `⚪ status=${s.status}, payment_status=${s.payment_status} (pas de paiement abouti)`; abandon++; }
    console.log(`${tag} : ${verdict}`);
  } catch (e) {
    console.log(`${tag} : erreur lecture Stripe — ${e.message}`);
    illisible++;
  }
}

console.log(`\n── Répartition ──`);
console.log(`Refus client (carte/banque)      : ${refusClient}`);
console.log(`Abandon (session expirée)        : ${abandon}`);
console.log(`Erreur technique côté site       : ${technique}`);
console.log(`Payé mais annulé (DÉSYNC grave)  : ${payeDesync}`);
console.log(`Non lisible (clé test vs live)   : ${illisible}`);
