import { describe, it, expect } from 'vitest';
import { applyRounding, computeSellingPrice, resolveRule, type MarginRule, type PricingProduct } from './margins';

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
