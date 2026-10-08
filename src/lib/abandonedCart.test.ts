import { describe, expect, it } from 'vitest';
import { groupByClient, nextCronRun, reminderStatus, type ReminderInput } from './abandonedCart';

const base = (over: Partial<ReminderInput> = {}): ReminderInput => ({
  createdAt: new Date('2026-10-08T12:30:00Z'),
  reminderSentAt: null,
  hasEmail: true,
  optedOut: false,
  lastPaidAt: null,
  lastReminderToUserAt: null,
  ...over,
});
const now = new Date('2026-10-08T14:00:00Z');

describe('nextCronRun', () => {
  it('garde le jour même avant 10 h UTC', () => {
    expect(nextCronRun(new Date('2026-10-08T09:59:00Z')).toISOString()).toBe('2026-10-08T10:00:00.000Z');
  });
  it('passe au lendemain après 10 h UTC', () => {
    expect(nextCronRun(new Date('2026-10-08T10:01:00Z')).toISOString()).toBe('2026-10-09T10:00:00.000Z');
  });
});

describe('reminderStatus', () => {
  it('relance prévue au premier passage après 48 h', () => {
    const s = reminderStatus(base(), now);
    expect(s.kind).toBe('scheduled');
    expect(s.at?.toISOString()).toBe('2026-10-11T10:00:00.000Z'); // 10/10 12:30 + passage du 11 à 10 h
  });
  it('déjà envoyée', () => {
    const at = new Date('2026-10-07T10:00:00Z');
    expect(reminderStatus(base({ reminderSentAt: at }), now)).toEqual({ kind: 'sent', at });
  });
  it('racheté après l’abandon : pas de relance', () => {
    expect(reminderStatus(base({ lastPaidAt: new Date('2026-10-08T13:00:00Z') }), now).kind).toBe('recovered');
  });
  it('racheté après la relance : on le voit', () => {
    const s = reminderStatus(base({ reminderSentAt: new Date('2026-10-08T12:40:00Z'), lastPaidAt: new Date('2026-10-08T13:00:00Z') }), now);
    expect(s.kind).toBe('recovered');
    expect(s.afterReminder).toBe(true);
  });
  it('un achat AVANT l’abandon ne compte pas comme rachat', () => {
    expect(reminderStatus(base({ lastPaidAt: new Date('2026-09-01T10:00:00Z') }), now).kind).toBe('scheduled');
  });
  it('sans e-mail', () => {
    expect(reminderStatus(base({ hasEmail: false }), now).kind).toBe('no_email');
  });
  it('désinscrit', () => {
    expect(reminderStatus(base({ optedOut: true }), now).kind).toBe('opted_out');
  });
  it('trop ancien (plus de 14 jours)', () => {
    expect(reminderStatus(base({ createdAt: new Date('2026-09-20T10:00:00Z') }), now).kind).toBe('too_old');
  });
  it('client relancé il y a moins de 30 jours', () => {
    expect(reminderStatus(base({ lastReminderToUserAt: new Date('2026-09-25T10:00:00Z') }), now).kind).toBe('cooldown');
  });
});

describe('groupByClient', () => {
  it('une seule relance prévue par client, pour son panier le plus récent', () => {
    const at = new Date('2026-10-11T10:00:00Z');
    const rows = groupByClient([
      { clientKey: 'u1', reminder: { kind: 'scheduled' as const, at } },
      { clientKey: 'u1', reminder: { kind: 'scheduled' as const, at } },
      { clientKey: 'u2', reminder: { kind: 'scheduled' as const, at } },
    ]);
    expect(rows.map((r) => r.reminder.kind)).toEqual(['scheduled', 'grouped', 'scheduled']);
  });
  it('panier récent (< 48 h) et panier plus ancien : la relance part pour l’ancien, qui passe en premier', () => {
    const rows = groupByClient([
      { clientKey: 'u1', reminder: { kind: 'scheduled' as const, at: new Date('2026-10-10T10:00:00Z') } }, // récent
      { clientKey: 'u1', reminder: { kind: 'scheduled' as const, at: new Date('2026-10-09T10:00:00Z') } }, // ancien
    ]);
    expect(rows.map((r) => r.reminder.kind)).toEqual(['grouped', 'scheduled']);
  });
});
