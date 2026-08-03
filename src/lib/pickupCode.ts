// Code de retrait sécurisé (anti-fraude comptoir) — Click & Collect.
// Serveur uniquement : ne jamais importer côté client (bien que ce fichier
// ne lise aucun secret d'environnement, la génération/comparaison doit
// rester une opération serveur).
import { randomBytes, timingSafeEqual } from 'crypto';

// Alphabet sans caractères ambigus (pas de O/0, I/1) — 32 caractères, pile une
// puissance de 2 : byte % 32 n'introduit aucun biais (256 est un multiple exact).
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 8;

// Génère un code de retrait imprévisible (CSPRNG — jamais séquentiel, jamais
// dérivé de l'id de commande ou d'un compteur).
export function generatePickupCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

// Normalise une saisie admin avant comparaison : insensible à la casse, aux
// espaces et au tiret de lisibilité affiché dans l'email (formatPickupCodeForDisplay).
export function normalizePickupCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Découpe en deux groupes pour l'affichage client (ex. "7K4M-QW2X") — purement
// visuel ; la valeur stockée/comparée reste la chaîne brute sans tiret.
export function formatPickupCodeForDisplay(code: string): string {
  const mid = Math.ceil(code.length / 2);
  return `${code.slice(0, mid)}-${code.slice(mid)}`;
}

// Comparaison à temps constant — un code est un secret comme un autre : on ne
// le compare jamais avec une simple égalité de chaînes.
export function pickupCodesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Champs internes au code de retrait à ne JAMAIS laisser atteindre le
// navigateur admin — le code lui-même ne doit être connu que du client (par
// email). À appliquer sur toute commande construite via select('*') avant un
// NextResponse.json(...) côté admin.
const SENSITIVE_PICKUP_FIELDS = [
  'pickup_code',
  'pickup_code_attempts',
  'pickup_code_locked_until',
] as const;

export function stripPickupCodeSecrets<T extends Record<string, any>>(order: T): T {
  const clone = { ...order };
  for (const f of SENSITIVE_PICKUP_FIELDS) delete (clone as any)[f];
  return clone;
}
