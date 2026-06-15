import { describe, it, expect } from 'vitest';
import { applyRounding, computeSellingPrice, resolveRule, computeProductPrices, type MarginRule, type PricingProduct, type MarginSettings } from './margins';

function rule(partial: Partial<MarginRule>): MarginRule {
  return {
    id: 'r', scope_level: 'global', brand: null, model: null, product_id: null,
    grade: null, margin_type: 'percent', margin_percent: 0, margin_fixed: 0,
    rounding: 'cent', ...partial,
  };
}

describe('applyRounding', () => {
  it('cent → 2 décimales', () => {
    expect(applyRounding(12.3456, 'cent')).toBe(12.35);
    expect(applyRounding(12.344, 'cent')).toBe(12.34);
  });
  it('decicent → 3 décimales', () => {
    expect(applyRounding(12.3456, 'decicent')).toBe(12.346);
  });
  it('euro → entier le plus proche', () => {
    expect(applyRounding(12.4, 'euro')).toBe(12);
    expect(applyRounding(12.5, 'euro')).toBe(13);
  });
  it('five_euro → multiple de 5', () => {
    expect(applyRounding(122, 'five_euro')).toBe(120);
    expect(applyRounding(123, 'five_euro')).toBe(125);
  });
  it('ten_euro → multiple de 10', () => {
    expect(applyRounding(124, 'ten_euro')).toBe(120);
    expect(applyRounding(125, 'ten_euro')).toBe(130);
  });
  it('ends_99 → arrondi à l\'euro puis −0,01', () => {
    expect(applyRounding(119.4, 'ends_99')).toBe(118.99);
    expect(applyRounding(119.6, 'ends_99')).toBe(119.99);
  });
});

describe('computeSellingPrice', () => {
  it('percent : coût × (1 + %)', () => {
    expect(computeSellingPrice(100, rule({ margin_type: 'percent', margin_percent: 20 }))).toBe(120);
  });
  it('fixed : coût + €', () => {
    expect(computeSellingPrice(100, rule({ margin_type: 'fixed', margin_fixed: 30 }))).toBe(130);
  });
  it('combined : coût × (1 + %) + €', () => {
    expect(computeSellingPrice(100, rule({ margin_type: 'combined', margin_percent: 20, margin_fixed: 10 }))).toBe(130);
  });
  it('applique l\'arrondi de la règle', () => {
    expect(computeSellingPrice(100, rule({ margin_type: 'percent', margin_percent: 19.5, rounding: 'ends_99' }))).toBe(119.99);
  });
  it('valeurs null traitées comme 0', () => {
    expect(computeSellingPrice(100, rule({ margin_type: 'combined', margin_percent: null, margin_fixed: null }))).toBe(100);
  });
});

function prod(p: Partial<PricingProduct>): PricingProduct {
  return {
    id: 'p1', brand: 'Apple', model: 'iPhone 11', grade: 'A',
    storage_capacity: '128 Go', color: 'Noir', cost_price: 100, price: 100, ...p,
  };
}

describe('resolveRule', () => {
  const global = rule({ id: 'g', scope_level: 'global' });
  const brand = rule({ id: 'b', scope_level: 'brand', brand: 'Apple' });
  const model = rule({ id: 'm', scope_level: 'model', brand: 'Apple', model: 'iPhone 11' });
  const productR = rule({ id: 'pr', scope_level: 'product', product_id: 'p1' });
  const productGradeA = rule({ id: 'pga', scope_level: 'product', product_id: 'p1', grade: 'A' });

  it('produit+grade bat tout', () => {
    expect(resolveRule(prod({}), [global, brand, model, productR, productGradeA])!.id).toBe('pga');
  });
  it('produit bat modèle', () => {
    expect(resolveRule(prod({}), [global, brand, model, productR])!.id).toBe('pr');
  });
  it('modèle bat marque', () => {
    expect(resolveRule(prod({}), [global, brand, model])!.id).toBe('m');
  });
  it('marque bat global', () => {
    expect(resolveRule(prod({}), [global, brand])!.id).toBe('b');
  });
  it('grade matché via displayGrade (A+ → A)', () => {
    expect(resolveRule(prod({ grade: 'A+' }), [global, productGradeA])!.id).toBe('pga');
  });
  it('grade B ne matche pas une règle grade A', () => {
    expect(resolveRule(prod({ grade: 'B' }), [global, productGradeA])!.id).toBe('g');
  });
  it('aucune règle → null', () => {
    expect(resolveRule(prod({}), [])).toBeNull();
  });
});

const settingsOff: MarginSettings = { coherence_enabled: false, coherence_min_gap_percent: 5 };
const settingsOn: MarginSettings = { coherence_enabled: true, coherence_min_gap_percent: 5 };

describe('computeProductPrices', () => {
  it('calcule newPrice + marginPct + règle appliquée', () => {
    const products = [prod({ id: 'p1', cost_price: 100 })];
    const rules = [rule({ id: 'g', scope_level: 'global', margin_type: 'percent', margin_percent: 20 })];
    const res = computeProductPrices(products, rules, settingsOff);
    expect(res[0].newPrice).toBe(120);
    expect(res[0].marginPct).toBeCloseTo(0.2);
    expect(res[0].ruleApplied).toBe('g');
  });

  it('sans règle : prix inchangé (= coût), ruleApplied null', () => {
    const res = computeProductPrices([prod({ cost_price: 100, price: 100 })], [], settingsOff);
    expect(res[0].newPrice).toBe(100);
    expect(res[0].ruleApplied).toBeNull();
  });

  it('cohérence OFF : B peut rester > A', () => {
    const products = [
      prod({ id: 'a', grade: 'A', cost_price: 100 }),
      prod({ id: 'b', grade: 'B', cost_price: 200 }),
    ];
    const rules = [rule({ scope_level: 'global', margin_type: 'percent', margin_percent: 0 })];
    const res = computeProductPrices(products, rules, settingsOff);
    expect(res.find((r) => r.product.id === 'a')!.newPrice).toBe(100);
    expect(res.find((r) => r.product.id === 'b')!.newPrice).toBe(200);
  });

  it('cohérence ON : A remonté à ≥ 1,05 × B (même famille)', () => {
    const products = [
      prod({ id: 'a', grade: 'A', cost_price: 100 }),
      prod({ id: 'b', grade: 'B', cost_price: 200 }),
    ];
    const rules = [rule({ scope_level: 'global', margin_type: 'percent', margin_percent: 0, rounding: 'cent' })];
    const res = computeProductPrices(products, rules, settingsOn);
    const a = res.find((r) => r.product.id === 'a')!;
    const b = res.find((r) => r.product.id === 'b')!;
    expect(b.newPrice).toBe(200);
    expect(a.newPrice).toBeGreaterThanOrEqual(200 * 1.05);
    expect(a.coherenceAdjusted).toBe(true);
  });

  it('cohérence : familles distinctes (stockage différent) non mélangées', () => {
    const products = [
      prod({ id: 'a', grade: 'A', storage_capacity: '128 Go', cost_price: 100 }),
      prod({ id: 'b', grade: 'B', storage_capacity: '256 Go', cost_price: 200 }),
    ];
    const rules = [rule({ scope_level: 'global', margin_type: 'percent', margin_percent: 0 })];
    const res = computeProductPrices(products, rules, settingsOn);
    expect(res.find((r) => r.product.id === 'a')!.coherenceAdjusted).toBe(false);
  });
});
