import { describe, it, expect } from 'vitest';
import { isReferralCodeUsable } from './referral';

const NOW = new Date('2026-07-07T12:00:00Z');
const base = { is_active: true, times_used: 0, max_uses: 1, expires_at: null as string | null };

describe('isReferralCodeUsable', () => {
  it('accepte un code actif, non épuisé, sans expiration', () => {
    expect(isReferralCodeUsable(base, NOW)).toBe(true);
  });
  it('refuse un code inactif', () => {
    expect(isReferralCodeUsable({ ...base, is_active: false }, NOW)).toBe(false);
  });
  it('refuse un code épuisé', () => {
    expect(isReferralCodeUsable({ ...base, times_used: 1, max_uses: 1 }, NOW)).toBe(false);
  });
  it('refuse un code expiré (expires_at passé)', () => {
    expect(isReferralCodeUsable({ ...base, expires_at: '2026-07-06T12:00:00Z' }, NOW)).toBe(false);
  });
  it('accepte un code non encore expiré (expires_at futur)', () => {
    expect(isReferralCodeUsable({ ...base, expires_at: '2026-07-14T12:00:00Z' }, NOW)).toBe(true);
  });
});
