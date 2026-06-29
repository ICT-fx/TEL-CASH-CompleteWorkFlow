import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { isEmailConfigured, sendAbandonedCartEmail, type OrderEmailLine } from '@/lib/email';

// Relance « panier abandonné » — cron quotidien (Vercel Cron, voir vercel.json).
//
// Cible : commandes restées 'pending' (checkout démarré, jamais payé) depuis
// plus de 24 h, avec un email client, et jamais encore relancées. UNE seule
// relance max (anti-doublon via orders.abandoned_reminder_sent_at).
//
// Sécurité d'envoi : si aucun fournisseur email n'est configuré (RESEND_API_KEY
// / SMTP absent en prod), on ne crashe pas — on log et on sort sans rien marquer.
// On n'horodate « relancé » QUE sur un envoi réussi → garantit exactement une
// relance aboutie, et permet de réessayer plus tard si l'email échoue.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Fenêtre de ciblage : abandon entre 24 h et 7 j. Le plancher à 7 j évite, au
// premier passage, d'arroser des paniers très anciens jamais relancés.
const MIN_AGE_HOURS = 24;
const MAX_AGE_DAYS = 7;

async function authorize(request: Request): Promise<NextResponse | null> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return null;
  const { response } = await requireAdmin();
  return response ?? null;
}

interface ProfileRef { email: string | null; full_name: string | null }

export async function GET(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
  const db = createAdminClient();

  const now = Date.now();
  const cutoffRecent = new Date(now - MIN_AGE_HOURS * 3600_000).toISOString(); // ≤ now-24h
  const cutoffOld = new Date(now - MAX_AGE_DAYS * 86400_000).toISOString();     // ≥ now-7j

  // 1) Paniers abandonnés candidats à relancer.
  const { data: orders, error } = await db
    .from('orders')
    .select('id, created_at, total_amount, shipping_address, profile:profiles(email, full_name)')
    .eq('status', 'pending')
    .is('abandoned_reminder_sent_at', null)
    .lte('created_at', cutoffRecent)
    .gte('created_at', cutoffOld)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: `Lecture commandes: ${error.message}` }, { status: 500 });
  }

  const candidates = orders || [];

  // Email d'un panier : profil lié en priorité, sinon email saisi dans l'adresse.
  const emailOf = (o: { shipping_address: unknown; profile: unknown }): string | null => {
    const profile = Array.isArray(o.profile) ? (o.profile[0] as ProfileRef | undefined) : (o.profile as ProfileRef | null);
    const fromProfile = profile?.email?.trim();
    if (fromProfile) return fromProfile;
    const addr = o.shipping_address as { email?: string } | null;
    return addr?.email?.trim() || null;
  };
  const nameOf = (o: { profile: unknown }): string | null => {
    const profile = Array.isArray(o.profile) ? (o.profile[0] as ProfileRef | undefined) : (o.profile as ProfileRef | null);
    return profile?.full_name ?? null;
  };

  // Garde : ne relance jamais un panier sans email.
  const withEmail = candidates.filter((o) => emailOf(o));

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
    const result = await sendAbandonedCartEmail({
      to,
      customerName: nameOf(o),
      resumeUrl: `${appUrl}/cart?relance=${o.id.slice(0, 8)}`,
      lines: linesByOrder.get(o.id) || [],
      total: parseFloat(o.total_amount as unknown as string) || 0,
      // promoCode volontairement omis : relance simple (pas de remise activée).
    });

    if (result.sent) {
      const { error: markErr } = await db
        .from('orders')
        .update({ abandoned_reminder_sent_at: new Date().toISOString() })
        .eq('id', o.id);
      if (markErr) {
        // Email parti mais marquage échoué : on log (risque de doublon au prochain
        // passage), sans interrompre la boucle.
        console.error(`[abandoned-cart] Marquage échoué pour ${o.id}: ${markErr.message}`);
      }
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
