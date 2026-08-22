import { describe, it, expect } from 'vitest';
import { buildBarLayout } from './barLayout';

function days(n: number, startISO = '2026-07-23') {
  const start = new Date(startISO + 'T00:00:00Z');
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), total: i * 10 };
  });
}

describe('buildBarLayout', () => {
  it('returns one item per input day', () => {
    const out = buildBarLayout(days(30));
    expect(out).toHaveLength(30);
  });

  it('computes 30 equal-width bars spanning the 1080-wide viewBox with gap 6', () => {
    const out = buildBarLayout(days(30));
    const expectedW = (1080 - 6 * 29) / 30;
    expect(out[0].w).toBeCloseTo(expectedW, 5);
    expect(out[0].x).toBe(0);
    expect(out[1].x).toBeCloseTo(expectedW + 6, 5);
  });

  it('bar height scales to the max value, baseline at y=150.5, min height 3 for zero days', () => {
    const data = [{ date: '2026-08-01', total: 0 }, { date: '2026-08-02', total: 100 }];
    const out = buildBarLayout(data);
    expect(out[0].h).toBe(3); // jour à zéro : hauteur plancher, reste visible
    expect(out[0].fill).toBe('#EDEDEA');
    expect(out[1].h).toBeGreaterThan(out[0].h);
    expect(out[1].fill).toBe('#2F6BFF');
    // y + h doit toujours atteindre la ligne de base (les barres poussent vers le haut).
    expect(out[0].y + out[0].h).toBeCloseTo(150.5, 5);
    expect(out[1].y + out[1].h).toBeCloseTo(150.5, 5);
  });

  it('labels every 3rd bar plus always the last one, others get showLabel=false', () => {
    const out = buildBarLayout(days(30), { labelEvery: 3 });
    expect(out[0].showLabel).toBe(true);   // premier jour
    expect(out[3].showLabel).toBe(true);   // 1 sur 3
    expect(out[1].showLabel).toBe(false);
    expect(out[2].showLabel).toBe(false);
    expect(out[29].showLabel).toBe(true);  // toujours le dernier jour
  });

  it('date label omits the month name except on the first bar, the last bar, and days 1-3 of a month', () => {
    // 23 juillet -> 21 août sur 30 jours : coupe le mois autour du 1er août.
    const out = buildBarLayout(days(30));
    const first = out[0]; // 23 juil
    expect(first.dateLabel).toBe('23 juil.');
    const last = out[29]; // 21 août
    expect(last.dateLabel).toBe('21 août');
    const aug1 = out.find((b) => b.date === '2026-08-01')!;
    expect(aug1.dateLabel).toBe('1 août');
    const aug15 = out.find((b) => b.date === '2026-08-15')!;
    expect(aug15.dateLabel).toBe('15'); // ni bord, ni début de mois : jour seul
  });

  it('tooltip always includes the full French date and the formatted amount', () => {
    const out = buildBarLayout([{ date: '2026-08-03', total: 1234.5 }]);
    // Node/ICU fr-FR utilise l'espace fine insécable (U+202F) comme séparateur de milliers.
    expect(out[0].tooltip).toBe('3 août 2026 — 1 234,50 €');
  });

  it('returns an empty array for empty input', () => {
    expect(buildBarLayout([])).toEqual([]);
  });
});
