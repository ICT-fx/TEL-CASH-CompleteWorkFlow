import { describe, it, expect } from 'vitest';
import { buildWinbackCode, winbackExpiry, WINBACK_VALIDITY_DAYS } from './winback';

describe('buildWinbackCode', () => {
  it('préfixe REVIENS- et met en majuscules', () => {
    expect(buildWinbackCode('a7k2b')).toBe('REVIENS-A7K2B');
  });
});

describe('winbackExpiry', () => {
  it('renvoie now + 7 jours en ISO', () => {
    const now = new Date('2026-07-07T12:00:00Z');
    const exp = new Date(winbackExpiry(now));
    const diffDays = (exp.getTime() - now.getTime()) / 86400_000;
    expect(diffDays).toBe(WINBACK_VALIDITY_DAYS);
  });
});
