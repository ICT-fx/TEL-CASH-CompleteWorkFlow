import { describe, expect, it } from 'vitest';
import { pageLabel, sourceOf } from './live';
import { deptOf, lonLatOfZip } from './geo';

describe('pageLabel', () => {
  it('fiche produit lisible, sans le suffixe technique', () => {
    expect(pageLabel('/products/iphone-13-128go-tres-bon-etat-ab12cd')).toBe('iPhone 13 128 Go très bon état');
  });
  it('pages connues', () => {
    expect(pageLabel('/')).toBe('Accueil');
    expect(pageLabel('/checkout?step=2')).toBe('Paiement');
    expect(pageLabel('/reconditionnement')).toBe('Reconditionnement');
  });
});

describe('sourceOf', () => {
  it('reconnaît Google Maps avant Google', () => {
    expect(sourceOf('https://www.google.com/maps/place/x')).toBe('Google Maps');
    expect(sourceOf('https://www.google.fr/')).toBe('Google');
    expect(sourceOf('https://chatgpt.com/')).toBe('Une IA (ChatGPT…)');
    expect(sourceOf(null)).toBe('Accès direct');
  });
});

describe('geo', () => {
  it('département depuis le code postal, Corse comprise', () => {
    expect(deptOf('49100')).toBe('49');
    expect(deptOf('20000')).toBe('2A');
    expect(deptOf('20200')).toBe('2B');
    expect(deptOf('97400')).toBeNull();
    expect(lonLatOfZip('75011')).toEqual([2.352, 48.857]);
  });
});
