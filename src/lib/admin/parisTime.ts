// Jours et heures au sens de Paris, quel que soit le fuseau du serveur (UTC
// sur Vercel). Tous les écrans du back-office comptent « aujourd'hui » pareil.

export const TZ = 'Europe/Paris';

/** « 2026-10-08 » : la date à Paris. */
export const parisDayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

/** « 2026-10 » : le mois à Paris. */
export const parisMonthKey = (d: Date) => parisDayKey(d).slice(0, 7);

/** Heure (0–23) à Paris. */
export function parisHour(d: Date): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).find((p) => p.type === 'hour')?.value;
  return Number(h ?? 0) % 24;
}

/** Décalage de Paris par rapport à UTC, en minutes, à un instant donné (+60 l'hiver, +120 l'été). */
export function parisOffsetMinutes(d: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const m = /GMT([+-])(\d+)(?::(\d+))?/.exec(name);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Minuit à Paris pour le jour `key` (AAAA-MM-JJ), en instant UTC. */
export function parisMidnight(key: string): Date {
  const guess = new Date(`${key}T00:00:00Z`);
  const off = parisOffsetMinutes(new Date(guess.getTime() - parisOffsetMinutes(guess) * 60_000));
  return new Date(guess.getTime() - off * 60_000);
}

/** Minuit à Paris, `days` jours avant/après le jour de `d`. */
export function parisStartOfDay(d: Date, days = 0): Date {
  const [y, mo, da] = parisDayKey(d).split('-').map(Number);
  const k = new Date(Date.UTC(y, mo - 1, da + days)).toISOString().slice(0, 10);
  return parisMidnight(k);
}
