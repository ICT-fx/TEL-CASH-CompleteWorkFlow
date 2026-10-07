// Source unique du chiffre d'affaires pour tout le back-office.
//
// Avant : l'accueil, les statistiques et les marges avaient chacun leur propre
// liste de statuts « payés » (supplier_ordered manquait à deux endroits), les
// remboursements partiels faisaient disparaître toute la commande, les retours
// remboursés n'étaient jamais déduits, et les commandes passées par l'équipe
// (tests) comptaient comme de vraies ventes. Toutes les routes admin qui
// parlent de CA, de commandes payées ou de marge passent désormais par ici.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Statuts d'une commande encaissée et non annulée. */
export const REVENUE_STATUSES = ['paid', 'supplier_ordered', 'shipped', 'delivered'] as const;

/** Statuts d'une commande encaissée puis (en tout ou partie) remboursée. */
export const REFUNDED_STATUSES = ['cancelled', 'refunded'] as const;

export interface RawOrderRow {
  id: string;
  total_amount: number | string | null;
  created_at: string;
  status: string;
  user_id: string | null;
  guest_email?: string | null;
  refund_amount?: number | string | null;
}

export interface SaleOrder {
  id: string;
  createdAt: Date;
  userId: string | null;
  status: string;
  /** Montant encaissé à la commande. */
  gross: number;
  /** Total remboursé (annulation avec remboursement + retours remboursés). */
  refunded: number;
  /** Ce qui reste réellement encaissé : gross − refunded, jamais négatif. */
  net: number;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Transforme une ligne `orders` en vente, ou null si elle ne représente pas
 * d'argent encaissé (panier en attente, échec de paiement, annulation sans
 * remboursement = jamais payée).
 */
export function toSaleOrder(row: RawOrderRow, returnRefunds = 0): SaleOrder | null {
  const gross = num(row.total_amount);
  const isRevenue = (REVENUE_STATUSES as readonly string[]).includes(row.status);
  const isRefunded = (REFUNDED_STATUSES as readonly string[]).includes(row.status);
  if (!isRevenue && !isRefunded) return null;

  let refunded = 0;
  if (isRefunded) {
    // Une annulation n'est un remboursement que si un montant a été rendu.
    // Statut 'refunded' sans montant connu = remboursement total.
    if (row.refund_amount == null || row.refund_amount === '') {
      if (row.status === 'cancelled') return null;
      refunded = gross;
    } else {
      refunded = num(row.refund_amount);
    }
  }
  refunded = Math.min(gross, refunded + Math.max(0, returnRefunds));
  return {
    id: row.id,
    createdAt: new Date(row.created_at),
    userId: row.user_id,
    status: row.status,
    gross: round2(gross),
    refunded: round2(refunded),
    net: round2(Math.max(0, gross - refunded)),
  };
}

/** Une vente compte comme « commande payée » tant qu'il en reste quelque chose. */
export const isCountedSale = (o: SaleOrder) => o.net > 0;

export interface SalesSummary {
  net: number;
  gross: number;
  refunded: number;
  /** Commandes payées (net > 0). */
  orders: number;
  buyers: number;
  avgBasket: number;
}

/** Résume les ventes dont la date est dans [from, to[. */
export function summarize(orders: SaleOrder[], from?: Date, to?: Date): SalesSummary {
  let net = 0, gross = 0, refunded = 0, count = 0;
  const buyers = new Set<string>();
  for (const o of orders) {
    if (from && o.createdAt < from) continue;
    if (to && o.createdAt >= to) continue;
    net += o.net; gross += o.gross; refunded += o.refunded;
    if (isCountedSale(o)) {
      count += 1;
      if (o.userId) buyers.add(o.userId);
    }
  }
  return {
    net: round2(net), gross: round2(gross), refunded: round2(refunded),
    orders: count, buyers: buyers.size,
    avgBasket: count ? round2(net / count) : 0,
  };
}

/** Évolution en % entre deux valeurs, null si la base est nulle. */
export const deltaPct = (current: number, previous: number): number | null =>
  previous > 0 ? ((current - previous) / previous) * 100 : null;

/** Liste d'e-mails de test, ex. ADMIN_TEST_EMAILS="edouard@...,test@...". */
export function testEmailsFromEnv(raw = process.env.ADMIN_TEST_EMAILS): Set<string> {
  return new Set(
    (raw || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
}

/** Une commande est un test si elle vient d'un compte admin ou d'un e-mail de test. */
export function isTestOrder(
  row: Pick<RawOrderRow, 'user_id' | 'guest_email'>,
  adminIds: Set<string>,
  testEmails: Set<string>,
  emailByUser: Map<string, string>,
): boolean {
  if (row.user_id && adminIds.has(row.user_id)) return true;
  const email = (row.user_id ? emailByUser.get(row.user_id) : row.guest_email) || '';
  return email !== '' && testEmails.has(email.toLowerCase());
}

/**
 * Lit toutes les lignes d'une requête en dépassant la limite de 1 000 lignes
 * de PostgREST (sinon le CA s'arrête silencieusement à 1 000 commandes).
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

export interface LoadedSales {
  orders: SaleOrder[];
  /** Commandes écartées parce qu'elles viennent de l'équipe (tests). */
  excludedTestOrders: number;
}

/**
 * Charge toutes les ventes (option : depuis une date), tests exclus,
 * remboursements et retours remboursés déduits.
 */
export async function loadSales(db: SupabaseClient, opts: { since?: Date } = {}): Promise<LoadedSales> {
  const statuses = [...REVENUE_STATUSES, ...REFUNDED_STATUSES];
  const rows = await fetchAll<RawOrderRow>((from, to) => {
    let q = db
      .from('orders')
      .select('id, total_amount, created_at, status, user_id, guest_email, refund_amount')
      .in('status', statuses)
      .order('created_at', { ascending: true })
      .range(from, to);
    if (opts.since) q = q.gte('created_at', opts.since.toISOString());
    return q;
  });

  const [admins, returns] = await Promise.all([
    db.from('profiles').select('id').eq('role', 'admin'),
    fetchAll<{ order_id: string; refund_amount: number | string | null }>((from, to) =>
      db.from('return_requests').select('order_id, refund_amount')
        .eq('status', 'refunded').range(from, to)),
  ]);
  const adminIds = new Set<string>((admins.data ?? []).map((p: { id: string }) => p.id));

  const testEmails = testEmailsFromEnv();
  const emailByUser = new Map<string, string>();
  if (testEmails.size > 0) {
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
    for (let i = 0; i < userIds.length; i += 200) {
      const { data } = await db.from('profiles').select('id, email').in('id', userIds.slice(i, i + 200));
      for (const p of data ?? []) if (p.email) emailByUser.set(p.id, p.email);
    }
  }

  const returnRefunds = new Map<string, number>();
  for (const r of returns) {
    returnRefunds.set(r.order_id, (returnRefunds.get(r.order_id) ?? 0) + num(r.refund_amount));
  }

  const orders: SaleOrder[] = [];
  let excludedTestOrders = 0;
  for (const row of rows) {
    if (isTestOrder(row, adminIds, testEmails, emailByUser)) {
      excludedTestOrders += 1;
      continue;
    }
    const sale = toSaleOrder(row, returnRefunds.get(row.id) ?? 0);
    if (sale) orders.push(sale);
  }
  return { orders, excludedTestOrders };
}
