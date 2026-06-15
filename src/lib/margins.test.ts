import { describe, it, expect } from 'vitest';
import { applyRounding, computeSellingPrice, type MarginRule } from './margins';

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
