import { describe, expect, it } from 'vitest';
import { parisDayKey, parisHour, parisMidnight, parisStartOfDay } from './parisTime';

describe('parisTime', () => {
  it('jour et heure à Paris depuis un instant UTC', () => {
    expect(parisDayKey(new Date('2026-10-08T22:30:00Z'))).toBe('2026-10-09'); // 00 h 30 à Paris
    expect(parisHour(new Date('2026-10-08T13:05:00Z'))).toBe(15);
    expect(parisHour(new Date('2026-12-08T13:05:00Z'))).toBe(14);
  });
  it('minuit à Paris, été comme hiver', () => {
    expect(parisMidnight('2026-10-08').toISOString()).toBe('2026-10-07T22:00:00.000Z');
    expect(parisMidnight('2026-12-08').toISOString()).toBe('2026-12-07T23:00:00.000Z');
    expect(parisStartOfDay(new Date('2026-10-08T22:30:00Z'), -1).toISOString()).toBe('2026-10-07T22:00:00.000Z');
  });
});
