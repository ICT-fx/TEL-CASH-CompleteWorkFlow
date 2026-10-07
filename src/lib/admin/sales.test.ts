import { describe, expect, it } from 'vitest';
import {
  deltaPct, fetchAll, isTestOrder, summarize, testEmailsFromEnv, toSaleOrder,
} from './sales';

const row = (over: Partial<Parameters<typeof toSaleOrder>[0]> = {}) => ({
  id: 'o1', total_amount: '379.00', created_at: '2026-10-07T10:00:00Z',
  status: 'paid', user_id: 'u1', guest_email: null, refund_amount: null, ...over,
});

describe('toSaleOrder', () => {
  it('compte toutes les étapes après paiement, y compris supplier_ordered', () => {
    for (const status of ['paid', 'supplier_ordered', 'shipped', 'delivered']) {
      expect(toSaleOrder(row({ status }))?.net).toBe(379);
    }
  });

  it("ignore ce qui n'a jamais été payé", () => {
    for (const status of ['pending', 'failed', 'awaiting_payment']) {
      expect(toSaleOrder(row({ status }))).toBeNull();
    }
    expect(toSaleOrder(row({ status: 'cancelled' }))).toBeNull();
  });

  it('déduit un remboursement partiel au lieu de faire disparaître la commande', () => {
    const s = toSaleOrder(row({ status: 'cancelled', refund_amount: '79' }))!;
    expect(s.gross).toBe(379);
    expect(s.refunded).toBe(79);
    expect(s.net).toBe(300);
  });

  it('un remboursement total laisse un net à zéro', () => {
    expect(toSaleOrder(row({ status: 'cancelled', refund_amount: 379 }))!.net).toBe(0);
    expect(toSaleOrder(row({ status: 'refunded' }))!.net).toBe(0);
  });

  it('déduit les retours remboursés, sans passer sous zéro', () => {
    expect(toSaleOrder(row({ status: 'delivered' }), 100)!.net).toBe(279);
    expect(toSaleOrder(row({ status: 'delivered' }), 999)!.net).toBe(0);
  });
});

describe('summarize', () => {
  const orders = [
    toSaleOrder(row({ id: 'a', created_at: '2026-10-01T10:00:00Z' }))!,
    toSaleOrder(row({ id: 'b', created_at: '2026-10-05T10:00:00Z', user_id: 'u2', total_amount: 221 }))!,
    toSaleOrder(row({ id: 'c', created_at: '2026-10-06T10:00:00Z', status: 'refunded' }))!,
  ];

  it('additionne le net, compte seulement les ventes restantes', () => {
    const s = summarize(orders);
    expect(s.net).toBe(600);
    expect(s.refunded).toBe(379);
    expect(s.orders).toBe(2);
    expect(s.buyers).toBe(2);
    expect(s.avgBasket).toBe(300);
  });

  it('filtre par période [from, to[', () => {
    const s = summarize(orders, new Date('2026-10-02'), new Date('2026-10-06'));
    expect(s.orders).toBe(1);
    expect(s.net).toBe(221);
  });
});

describe('commandes de test', () => {
  const admins = new Set(['admin1']);
  const emails = testEmailsFromEnv(' Test@Kota.fr , ,autre@x.fr');
  const byUser = new Map([['u9', 'test@kota.fr']]);

  it('lit la liste d\'e-mails sans tenir compte de la casse ni des espaces', () => {
    expect([...emails]).toEqual(['test@kota.fr', 'autre@x.fr']);
  });

  it('écarte les commandes des admins et des e-mails de test', () => {
    expect(isTestOrder({ user_id: 'admin1', guest_email: null }, admins, emails, byUser)).toBe(true);
    expect(isTestOrder({ user_id: 'u9', guest_email: null }, admins, emails, byUser)).toBe(true);
    expect(isTestOrder({ user_id: null, guest_email: 'AUTRE@x.fr' }, admins, emails, byUser)).toBe(true);
    expect(isTestOrder({ user_id: 'u1', guest_email: null }, admins, emails, byUser)).toBe(false);
  });
});

describe('fetchAll', () => {
  it('enchaîne les pages au-delà de 1 000 lignes', async () => {
    const all = Array.from({ length: 2350 }, (_, i) => i);
    const got = await fetchAll<number>(async (from, to) => ({ data: all.slice(from, to + 1), error: null }));
    expect(got).toHaveLength(2350);
  });
});

it('deltaPct', () => {
  expect(deltaPct(110, 100)).toBeCloseTo(10);
  expect(deltaPct(5, 0)).toBeNull();
});
