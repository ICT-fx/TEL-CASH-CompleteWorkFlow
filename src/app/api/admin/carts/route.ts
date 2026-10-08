import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { isEmailConfigured } from '@/lib/email';
import { groupByClient, reminderStatus, USER_COOLDOWN_DAYS } from '@/lib/abandonedCart';
import { REVENUE_STATUSES } from '@/lib/admin/sales';

const DAY = 24 * 60 * 60 * 1000;
// Fenêtre affichée : les paniers des 30 derniers jours (au-delà, plus rien ne se passe).
const WINDOW_DAYS = 30;

// GET /api/admin/carts — paniers abandonnés et état de leur relance automatique.
// Lecture seule : la relance elle-même est envoyée par le cron
// /api/cron/abandoned-cart, selon les mêmes règles (lib/abandonedCart).
export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;
    const db = createAdminClient();
    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_DAYS * DAY).toISOString();

    const { data: raw, error } = await db
      .from('orders')
      .select('id, user_id, status, created_at, total_amount, shipping_address, stripe_payment_intent, refunded_at, abandoned_reminder_sent_at, profile:profiles(email, full_name, marketing_opt_out)')
      .in('status', ['pending', 'cancelled'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) return NextResponse.json({ error: 'Lecture des paniers impossible' }, { status: 500 });

    // Même garde que le cron : une commande 'cancelled' n'est un panier que si elle n'a jamais été payée.
    const carts = (raw ?? []).filter((o) => o.status === 'pending' || (!o.stripe_payment_intent && !o.refunded_at));

    type Profile = { email: string | null; full_name: string | null; marketing_opt_out: boolean | null };
    const profileOf = (o: { profile: unknown }): Profile | null =>
      (Array.isArray(o.profile) ? o.profile[0] : o.profile) as Profile | null;
    const emailOf = (o: { profile: unknown; shipping_address: unknown }) =>
      profileOf(o)?.email?.trim() || (o.shipping_address as { email?: string } | null)?.email?.trim() || null;

    // Achats payés et relances déjà envoyées des mêmes clients.
    const userIds = Array.from(new Set(carts.map((o) => o.user_id).filter(Boolean))) as string[];
    const lastPaid = new Map<string, Date>();
    const lastReminder = new Map<string, Date>();
    if (userIds.length > 0) {
      const cooldownFrom = new Date(now.getTime() - (WINDOW_DAYS + USER_COOLDOWN_DAYS) * DAY).toISOString();
      const [{ data: paid }, { data: reminded }] = await Promise.all([
        db.from('orders').select('user_id, created_at').in('user_id', userIds).in('status', [...REVENUE_STATUSES]),
        db.from('orders').select('user_id, abandoned_reminder_sent_at').in('user_id', userIds).gte('abandoned_reminder_sent_at', cooldownFrom),
      ]);
      for (const p of paid ?? []) {
        const t = new Date(p.created_at as string);
        const prev = lastPaid.get(p.user_id as string);
        if (!prev || t > prev) lastPaid.set(p.user_id as string, t);
      }
      for (const r of reminded ?? []) {
        const t = new Date(r.abandoned_reminder_sent_at as string);
        const prev = lastReminder.get(r.user_id as string);
        if (!prev || t > prev) lastReminder.set(r.user_id as string, t);
      }
    }

    // Aperçu des articles.
    const ids = carts.map((o) => o.id);
    const itemsByOrder = new Map<string, { title: string; quantity: number; storage: string | null; grade: string | null }[]>();
    for (let i = 0; i < ids.length; i += 150) {
      const { data: items } = await db
        .from('order_items')
        .select('order_id, product_name, quantity, product:products(brand, model, storage_capacity, grade)')
        .in('order_id', ids.slice(i, i + 150));
      for (const it of items ?? []) {
        const rawP = (it as { product: unknown }).product;
        const p = (Array.isArray(rawP) ? rawP[0] : rawP) as { brand?: string; model?: string; storage_capacity?: string; grade?: string } | null;
        const list = itemsByOrder.get(it.order_id as string) ?? [];
        list.push({
          title: [p?.brand, p?.model].filter(Boolean).join(' ') || (it.product_name as string) || 'Produit',
          quantity: (it.quantity as number) ?? 1,
          storage: p?.storage_capacity ?? null,
          grade: p?.grade ?? null,
        });
        itemsByOrder.set(it.order_id as string, list);
      }
    }

    const rows = carts.map((o) => {
      const prof = profileOf(o);
      const uid = o.user_id as string | null;
      const createdAt = new Date(o.created_at as string);
      const sentAt = o.abandoned_reminder_sent_at ? new Date(o.abandoned_reminder_sent_at as string) : null;
      // Dernière relance envoyée à ce client (n'importe quel panier).
      const otherReminder = uid ? lastReminder.get(uid) ?? null : null;
      const email = emailOf(o);
      const status = reminderStatus({
        createdAt,
        reminderSentAt: sentAt,
        hasEmail: Boolean(email),
        optedOut: prof?.marketing_opt_out === true,
        lastPaidAt: uid ? lastPaid.get(uid) ?? null : null,
        lastReminderToUserAt: otherReminder,
      }, now);
      return {
        id: o.id,
        created_at: o.created_at,
        total_amount: Number(o.total_amount) || 0,
        name: prof?.full_name || null,
        email,
        items: itemsByOrder.get(o.id) ?? [],
        clientKey: uid || (email ? `email:${email.toLowerCase()}` : null),
        reminder: status,
      };
    });
    const out = groupByClient(rows).map(({ clientKey: _k, reminder, ...r }) => ({
      ...r,
      reminder: { kind: reminder.kind, at: reminder.at ? reminder.at.toISOString() : null, afterReminder: reminder.afterReminder ?? false },
    }));

    return NextResponse.json({ carts: out, emailConfigured: isEmailConfigured(), windowDays: WINDOW_DAYS });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
