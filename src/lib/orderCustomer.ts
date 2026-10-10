// Identité du client d'une commande — compte OU invité (migration 033).
//
// Une commande a SOIT un user_id (client connecté → profil joint via
// `profile:profiles(...)`, LEFT join) SOIT un guest_email (paiement sans compte,
// profil absent). Toute lecture de l'email / du nom / du téléphone client doit
// passer par ces helpers pour ne jamais perdre l'invité :
//   email : profil → guest_email → shipping_address.email
//   nom   : profil → shipping_address (prénom + nom)
//   tél.  : profil → shipping_address.phone
// Pur (aucun import serveur) : utilisable côté API comme côté pages admin.

type ProfileRef = { email?: string | null; full_name?: string | null; phone?: string | null } | null;

export type OrderCustomerSource = {
  user_id?: string | null;
  guest_email?: string | null;
  shipping_address?: unknown;
  // Supabase type parfois une relation many-to-one en tableau : on accepte les deux.
  profile?: unknown;
};

function clean(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function orderProfile(o: OrderCustomerSource | null | undefined): ProfileRef {
  const raw = o?.profile;
  if (!raw) return null;
  return ((Array.isArray(raw) ? raw[0] : raw) as ProfileRef) ?? null;
}

/** Commande passée sans compte (invité). */
export function isGuestOrder(o: OrderCustomerSource | null | undefined): boolean {
  return !!o && !o.user_id;
}

function address(o: OrderCustomerSource | null | undefined): Record<string, unknown> | null {
  const a = o?.shipping_address;
  return a && typeof a === 'object' ? (a as Record<string, unknown>) : null;
}

export function orderCustomerEmail(o: OrderCustomerSource | null | undefined): string | null {
  return clean(orderProfile(o)?.email) || clean(o?.guest_email) || clean(address(o)?.email) || null;
}

export function orderCustomerName(o: OrderCustomerSource | null | undefined): string | null {
  const fromProfile = clean(orderProfile(o)?.full_name);
  if (fromProfile) return fromProfile;
  const a = address(o);
  const fromAddress = [clean(a?.firstName), clean(a?.lastName)].filter(Boolean).join(' ');
  return fromAddress || null;
}

export function orderCustomerPhone(o: OrderCustomerSource | null | undefined): string | null {
  return clean(orderProfile(o)?.phone) || clean(address(o)?.phone) || null;
}

/** Libellé d'affichage : nom → email → « Client invité » / « Client ». */
export function orderCustomerLabel(o: OrderCustomerSource | null | undefined): string {
  return orderCustomerName(o) || orderCustomerEmail(o) || (isGuestOrder(o) ? 'Client invité' : 'Client');
}
