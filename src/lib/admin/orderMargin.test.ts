import { describe, expect, it } from 'vitest';
import { buildSupplierCostIndex, orderMargin, type VariantKeys } from './orderMargin';

const k = (color = 'noir'): VariantKeys => ({ brand_k: 'apple', model_k: 'iphone 13', storage_k: '128', grade_k: 'B', color_k: color });
const idx = buildSupplierCostIndex([
  { ...k('noir'), cost_price: 291 },
  { ...k('noir'), cost_price: 300 },
  { ...k('bleu'), cost_price: 280 },
]);

describe('orderMargin', () => {
  it('utilise le coût figé à l’achat quand il est réel', () => {
    expect(orderMargin([{ quantity: 1, price: 379, costAtPurchase: 291, keys: k() }], idx.lookup))
      .toEqual({ amount: 88, pct: 23.2, estimated: false, partial: false });
  });
  it('coût = prix de vente → coût inconnu, estimé avec le flux (variante la moins chère)', () => {
    const m = orderMargin([{ quantity: 1, price: 379, costAtPurchase: 379, keys: k('noir') }], idx.lookup);
    expect(m.amount).toBe(88);
    expect(m.estimated).toBe(true);
  });
  it('couleur absente du flux → même variante sans la couleur', () => {
    expect(orderMargin([{ quantity: 1, price: 379, costAtPurchase: null, keys: k('rose') }], idx.lookup).amount).toBe(99);
  });
  it('la remise (parrainage) est déduite de la marge', () => {
    expect(orderMargin([{ quantity: 1, price: 379, costAtPurchase: 291, keys: k() }], idx.lookup, 10))
      .toEqual({ amount: 78, pct: 21.1, estimated: false, partial: false });
  });
  it('aucun coût → marge inconnue', () => {
    expect(orderMargin([{ quantity: 1, price: 30, costAtPurchase: 30, keys: null }], idx.lookup))
      .toEqual({ amount: null, pct: null, estimated: false, partial: true });
  });
  it('commande mixte : on compte ce qui est connu et on signale le reste', () => {
    const m = orderMargin([
      { quantity: 2, price: 379, costAtPurchase: 291, keys: k() },
      { quantity: 1, price: 19, costAtPurchase: 19, keys: null },
    ], idx.lookup);
    expect(m.amount).toBe(176);
    expect(m.partial).toBe(true);
  });
});
