// Relance « panier abandonné » : règles partagées entre le cron qui envoie
// (src/app/api/cron/abandoned-cart) et l'écran admin qui affiche où en est
// chaque panier (src/app/admin/carts). Une seule source de vérité : si on
// change un délai ici, le cron et l'écran restent d'accord.

// Relance ~2 jours après l'abandon (plancher 48 h).
export const MIN_AGE_HOURS = 48;
// Au-delà de 14 jours, on ne relance plus (évite d'arroser de vieux paniers).
export const MAX_AGE_DAYS = 14;
// Pas plus d'une relance par client sur cette fenêtre glissante.
export const USER_COOLDOWN_DAYS = 30;
// Heure de passage du cron, en UTC (vercel.json : "0 10 * * *").
export const CRON_HOUR_UTC = 10;

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export type ReminderKind =
  | 'sent'        // relance déjà envoyée
  | 'recovered'   // le client a payé une commande après l'abandon
  | 'scheduled'   // partira au prochain passage du cron
  | 'cooldown'    // client déjà relancé il y a moins de 30 jours
  | 'no_email'    // aucune adresse e-mail connue
  | 'opted_out'   // client désinscrit des e-mails
  | 'too_old'     // abandonné il y a plus de 14 jours, jamais relancé
  | 'grouped';    // une seule relance par client : elle est déjà prévue pour un autre de ses paniers

export interface ReminderInput {
  createdAt: Date;
  reminderSentAt: Date | null;
  hasEmail: boolean;
  optedOut: boolean;
  /** Date de la dernière commande payée du même client, si elle existe. */
  lastPaidAt: Date | null;
  /** Date de la dernière relance envoyée à ce client (toutes commandes). */
  lastReminderToUserAt: Date | null;
}

export interface ReminderStatus {
  kind: ReminderKind;
  /** Date utile : envoi effectué, envoi prévu, ou rachat. */
  at: Date | null;
  /** Pour un panier racheté : la relance avait-elle été envoyée avant ? */
  afterReminder?: boolean;
}

/** Prochain passage du cron à partir de `from` (inclus). */
export function nextCronRun(from: Date): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), CRON_HOUR_UTC));
  if (d.getTime() < from.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function reminderStatus(c: ReminderInput, now: Date = new Date()): ReminderStatus {
  if (c.lastPaidAt && c.lastPaidAt.getTime() > c.createdAt.getTime()) {
    return { kind: 'recovered', at: c.lastPaidAt, afterReminder: Boolean(c.reminderSentAt && c.reminderSentAt < c.lastPaidAt) };
  }
  if (c.reminderSentAt) return { kind: 'sent', at: c.reminderSentAt };
  if (!c.hasEmail) return { kind: 'no_email', at: null };
  if (c.optedOut) return { kind: 'opted_out', at: null };

  const eligibleFrom = new Date(c.createdAt.getTime() + MIN_AGE_HOURS * HOUR);
  const run = nextCronRun(eligibleFrom.getTime() > now.getTime() ? eligibleFrom : now);
  if (run.getTime() - c.createdAt.getTime() > MAX_AGE_DAYS * DAY) return { kind: 'too_old', at: null };

  if (c.lastReminderToUserAt && run.getTime() - c.lastReminderToUserAt.getTime() < USER_COOLDOWN_DAYS * DAY) {
    return { kind: 'cooldown', at: c.lastReminderToUserAt };
  }
  return { kind: 'scheduled', at: run };
}

/**
 * Une seule relance par client : la première qui partira (date prévue la plus
 * proche ; à égalité, le panier le plus récent, comme le cron). Après elle, le
 * délai de 30 jours bloque les autres paniers du même client.
 * `rows` doit être trié du plus récent au plus ancien.
 */
export function groupByClient<T extends { clientKey: string | null; reminder: ReminderStatus }>(rows: T[]): T[] {
  const winner = new Map<string, number>();
  rows.forEach((r, i) => {
    if (r.reminder.kind !== 'scheduled' || !r.clientKey || !r.reminder.at) return;
    const cur = winner.get(r.clientKey);
    if (cur === undefined || r.reminder.at.getTime() < rows[cur].reminder.at!.getTime()) winner.set(r.clientKey, i);
  });
  return rows.map((r, i) => {
    if (r.reminder.kind !== 'scheduled' || !r.clientKey) return r;
    return winner.get(r.clientKey) === i ? r : { ...r, reminder: { kind: 'grouped' as const, at: null } };
  });
}
