import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { isEmailConfigured, sendAbandonedCartEmail, type OrderEmailLine } from '@/lib/email';
import { createWinbackCode } from '@/lib/winback';

// Relance « panier abandonné » — cron quotidien (Vercel Cron, voir vercel.json).
//
// Cible : commandes restées 'pending' (checkout démarré, jamais payé) depuis
// plus de 48 h, OU commandes 'cancelled' jamais payées (session Stripe expirée),
// avec un email client, jamais encore relancées, et sans opt-out RGPD.
// Anti-spam : 1 seule relance par client par run (la plus récente), cooldown 30 j,
// et skip si une commande payée est postérieure à l'abandon.
//
// Sécurité d'envoi : si aucun fournisseur email n'est configuré (RESEND_API_KEY
// / SMTP absent en prod), on ne crashe pas — on log et on sort sans rien marquer.
// On n'horodate « relancé » QUE sur un envoi réussi → garantit exactement une
// relance aboutie, et permet de réessayer plus tard si l'email échoue.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Relance ~2 jours après. Plancher 48 h ; plafond 14 j pour ne pas arroser
// d'anciennes commandes au premier passage.
const MIN_AGE_HOURS = 48;
const MAX_AGE_DAYS = 14;
// Ne pas renvoyer une relance au même client dans cette fenêtre glissante.
const USER_COOLDOWN_DAYS = 30;

async function authorize(request: Request): Promise<NextResponse | null> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return null;
  const { response } = await requireAdmin();
  return response ?? null;
}

export async function GET(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
  const db = createAdminClient();

  const now = Date.now();
  const cutoffRecent = new Date(now - MIN_AGE_HOURS * 3600_000).toISOString(); // ≤ now-48h
  const cutoffOld = new Date(now - MAX_AGE_DAYS * 86400_000).toISOString();   // ≥ now-14j

  // 1) Paniers abandonnés candidats : checkout démarré non payé.
  //    - 'pending' : le webhook ne l'a jamais passé à 'paid'.
  //    - 'cancelled' JAMAIS payé (session Stripe expirée) : pas de payment
  //      intent ni de remboursement (sinon = commande payée annulée par l'admin).
  const { data: orders, error } = await db
    .from('orders')
    .select('id, user_id, status, created_at, total_amount, shipping_address, stripe_payment_intent, refunded_at, profile:profiles(email, full_name, marketing_opt_out, unsubscribe_token)')
    .in('status', ['pending', 'cancelled'])
    .is('abandoned_reminder_sent_at', null)
    .lte('created_at', cutoffRecent)
    .gte('created_at', cutoffOld)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: `Lecture commandes: ${error.message}` }, { status: 500 });
  }

  // Garde « jamais payé » pour les commandes 'cancelled'.
  const neverPaid = (o: { status: string; stripe_payment_intent: unknown; refunded_at: unknown }) =>
    o.status === 'pending' || (!o.stripe_payment_intent && !o.refunded_at);

  const candidates = (orders || []).filter(neverPaid);

  interface ProfileRef {
    email: string | null;
    full_name: string | null;
    marketing_opt_out: boolean | null;
    unsubscribe_token: string | null;
  }
  const profileOf = (o: { profile: unknown }): ProfileRef | null =>
    Array.isArray(o.profile) ? ((o.profile[0] as ProfileRef) ?? null) : ((o.profile as ProfileRef) ?? null);

  const emailOf = (o: { shipping_address: unknown; profile: unknown }): string | null => {
    const fromProfile = profileOf(o)?.email?.trim();
    if (fromProfile) return fromProfile;
    const addr = o.shipping_address as { email?: string } | null;
    return addr?.email?.trim() || null;
  };
  const nameOf = (o: { profile: unknown }): string | null => profileOf(o)?.full_name ?? null;

  // Gardes : email présent + pas d'opt-out RGPD.
  const eligible = candidates.filter((o) => emailOf(o) && profileOf(o)?.marketing_opt_out !== true);

  // Anti-spam : 1 relance par client par run (on garde la commande la plus récente,
  // la liste est triée created_at desc).
  const seenUser = new Set<string>();
  const dedup = eligible.filter((o) => {
    const uid = (o as { user_id: string | null }).user_id;
    const key = uid || `email:${emailOf(o)}`;
    if (seenUser.has(key)) return false;
    seenUser.add(key);
    return true;
  });

  // Anti-spam : cooldown 30 j + clients ayant déjà racheté (commande payée après l'abandon).
  const userIds = Array.from(new Set(dedup.map((o) => (o as { user_id: string | null }).user_id).filter(Boolean))) as string[];
  const onCooldown = new Set<string>();
  const boughtSince = new Map<string, number>(); // user_id -> timestamp de la DERNIÈRE commande payée
  if (userIds.length > 0) {
    const cooldownFrom = new Date(now - USER_COOLDOWN_DAYS * 86400_000).toISOString();
    const { data: recent } = await db
      .from('orders')
      .select('user_id, abandoned_reminder_sent_at')
      .in('user_id', userIds)
      .gte('abandoned_reminder_sent_at', cooldownFrom);
    for (const r of recent || []) if (r.user_id) onCooldown.add(r.user_id as string);

    const { data: paid } = await db
      .from('orders')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .in('status', ['paid', 'shipped', 'delivered']);
    for (const p of paid || []) {
      if (!p.user_id) continue;
      const t = new Date(p.created_at as string).getTime();
      const prev = boughtSince.get(p.user_id as string);
      if (prev == null || t > prev) boughtSince.set(p.user_id as string, t);
    }
  }

  const withEmail = dedup.filter((o) => {
    const uid = (o as { user_id: string | null }).user_id;
    if (!uid) return true; // pas de compte lié (email seul) : pas de cooldown possible
    if (onCooldown.has(uid)) return false;
    const boughtAt = boughtSince.get(uid);
    // Exclure si le client a une commande payée POSTÉRIEURE à cet abandon.
    if (boughtAt != null && boughtAt > new Date((o as { created_at: string }).created_at).getTime()) return false;
    return true;
  });

  // Sécurité : aucun fournisseur email → on log seulement, rien n'est envoyé/marqué.
  if (!isEmailConfigured()) {
    console.warn(
      `[abandoned-cart] Aucun fournisseur email configuré — ${withEmail.length} relance(s) en attente, rien envoyé.`
    );
    return NextResponse.json({
      dryRun,
      emailConfigured: false,
      candidates: candidates.length,
      withEmail: withEmail.length,
      sent: 0,
      note: 'RESEND_API_KEY / SMTP absent : relances ignorées (aucun crash).',
    });
  }

  // 2) Lignes de commande de tous les candidats, en une requête, groupées.
  const ids = withEmail.map((o) => o.id);
  const linesByOrder = new Map<string, OrderEmailLine[]>();
  if (ids.length > 0) {
    const { data: items } = await db
      .from('order_items')
      .select('order_id, quantity, price_at_purchase, product_name')
      .in('order_id', ids);
    for (const it of items || []) {
      const arr = linesByOrder.get(it.order_id) || [];
      arr.push({
        name: (it.product_name as unknown as string) || 'Article',
        quantity: (it.quantity as unknown as number) || 1,
        unitPrice: parseFloat(it.price_at_purchase as unknown as string) || 0,
      });
      linesByOrder.set(it.order_id, arr);
    }
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      emailConfigured: true,
      candidates: candidates.length,
      withEmail: withEmail.length,
      sample: withEmail.slice(0, 10).map((o) => ({
        id: o.id,
        to: emailOf(o),
        created_at: o.created_at,
        items: (linesByOrder.get(o.id) || []).length,
      })),
    });
  }

  // 3) Envoi + horodatage anti-doublon (uniquement sur succès).
  let sent = 0;
  const failures: { id: string; reason?: string }[] = [];
  for (const o of withEmail) {
    const to = emailOf(o)!;
    const uid = (o as { user_id: string | null }).user_id;

    // Génère un code -20 € perso (expire +7 j). Sans compte lié, pas de code
    // (le code parrainage est per-user) → relance simple sans remise.
    let promo: { code: string; label: string } | null = null;
    if (uid) {
      try {
        const code = await createWinbackCode(db, uid, new Date(now));
        promo = { code, label: '20 € offerts — une protection d\'écran ScreenArmor pour votre nouveau téléphone' };
      } catch (e) {
        console.error(`[abandoned-cart] Code promo non généré pour ${o.id}: ${(e as Error).message}`);
      }
    }

    const token = profileOf(o)?.unsubscribe_token || null;
    const resumeUrl = `${appUrl}/cart?relance=${o.id.slice(0, 8)}${promo ? `&promo=${promo.code}` : ''}`;
    const unsubscribeUrl = token ? `${appUrl}/desinscription?token=${token}` : undefined;

    const result = await sendAbandonedCartEmail({
      to,
      customerName: nameOf(o),
      resumeUrl,
      lines: linesByOrder.get(o.id) || [],
      total: parseFloat(o.total_amount as unknown as string) || 0,
      promoCode: promo,
      unsubscribeUrl,
    });

    if (result.sent) {
      const { error: markErr } = await db
        .from('orders')
        .update({ abandoned_reminder_sent_at: new Date().toISOString() })
        .eq('id', o.id);
      if (markErr) console.error(`[abandoned-cart] Marquage échoué pour ${o.id}: ${markErr.message}`);
      sent++;
    } else {
      failures.push({ id: o.id, reason: result.reason });
      console.error(`[abandoned-cart] Envoi échoué pour ${o.id}: ${result.reason}`);
    }
  }

  return NextResponse.json({
    dryRun: false,
    emailConfigured: true,
    candidates: candidates.length,
    withEmail: withEmail.length,
    sent,
    failed: failures.length,
    failures: failures.slice(0, 10),
  });
}
