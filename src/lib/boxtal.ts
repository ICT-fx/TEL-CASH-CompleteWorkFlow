// Service serveur d'intégration LIVRAISON Boxtal — API V3 (affranchissement).
// Chronopost express (Chrono 13/18) via le contrat groupé Boxtal.
//
// ⚠️ NE JAMAIS importer ce fichier côté client : il lit des secrets serveur.
//
// Auth V3 (vérifiée) : POST {base}/iam/account-app/token
//   header  Authorization: Basic base64(ACCESS_KEY:SECRET_KEY), corps vide
//   réponse { accessToken }
// Affranchissement : POST {base}/shipping/v3.1/shipping-order
//   header  Authorization: Bearer <token>, Content-Type application/json
//   corps   = payload ci-dessous (forme issue de la lib officielle Boxtal)
//
// Endpoints/forme confirmés via la lib officielle Boxtal (github boxtal) et le
// connecteur de référence. Base TEST = https://api.boxtal.build, PROD =
// https://api.boxtal.com — pilotée par BOXTAL_API_BASE (jamais en dur).

export interface BoxtalAddress {
  type?: 'RESIDENTIAL' | 'BUSINESS';
  email: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  street: string;
  number?: string | number | null;
  postalCode: string;
  city: string;
  countryIsoCode: string; // 'FR'
}

export interface BoxtalShipmentResult {
  shipmentId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;       // URL du PDF chez Boxtal (si fournie)
  status: string | null;
  raw: unknown;                  // réponse brute (debug / champs non mappés)
}

// ── Config (env uniquement, jamais de secret en dur) ────────────────────────
function env(name: string): string {
  return (process.env[name] || '').trim();
}

// Base API : TEST par défaut (api.boxtal.build), surchargée par BOXTAL_API_BASE.
// Le passage en prod = BOXTAL_API_BASE=https://api.boxtal.com (mêmes routes).
export function boxtalBase(): string {
  return env('BOXTAL_API_BASE') || 'https://api.boxtal.build';
}

// Offre Chronopost express. Défaut Chrono18 (J+1 avant 18h). Chrono13 dispo via
// BOXTAL_OFFER_CODE=CHRP-Chrono13.
function offerCode(): string {
  return env('BOXTAL_OFFER_CODE') || 'CHRP-Chrono18';
}

export function isBoxtalConfigured(): boolean {
  return Boolean(env('BOXTAL_ACCESS_KEY') && env('BOXTAL_SECRET_KEY'));
}

// Adresse expéditeur (configurable) — défaut : siège TEL & CASH (Angers).
function senderAddress(): BoxtalAddress {
  return {
    type: 'BUSINESS',
    email: env('BOXTAL_SENDER_EMAIL') || 'contact@telandcash.fr',
    phone: env('BOXTAL_SENDER_PHONE') || '0285359532',
    company: (env('BOXTAL_SENDER_COMPANY') || 'TEL & CASH').slice(0, 35),
    firstName: env('BOXTAL_SENDER_FIRSTNAME') || 'Service',
    lastName: env('BOXTAL_SENDER_LASTNAME') || 'Expedition',
    number: env('BOXTAL_SENDER_NUMBER') || '10',
    street: env('BOXTAL_SENDER_STREET') || 'rue Saint-Étienne',
    postalCode: env('BOXTAL_SENDER_ZIP') || '49100',
    city: env('BOXTAL_SENDER_CITY') || 'Angers',
    countryIsoCode: env('BOXTAL_SENDER_COUNTRY') || 'FR',
  };
}

// Catégorie de contenu Boxtal pour téléphonie mobile (+ accessoires).
const CONTENT_CATEGORY_ID = 'content:v1:50113';
const CONTENT_CATEGORY_LABEL = 'Téléphonie mobile et accessoires';

// Poids colis par défaut (kg) : téléphone 0,8 / accessoire 0,3.
export function parcelWeightKg(items: { category?: string | null; quantity?: number }[]): number {
  let w = 0;
  for (const it of items) {
    const isAccessory = (it.category || '').toLowerCase() === 'accessoires';
    w += (isAccessory ? 0.3 : 0.8) * (it.quantity || 1);
  }
  // Au moins un téléphone par défaut si la liste est vide / inconnue.
  return Math.max(0.3, Math.round(w * 100) / 100) || 0.8;
}

// ── Token (cache mémoire courte durée) ──────────────────────────────────────
let tokenCache: { token: string; exp: number } | null = null;

export async function getBoxtalToken(): Promise<string> {
  if (!isBoxtalConfigured()) throw new Error('Boxtal non configuré (clés manquantes).');
  if (tokenCache && tokenCache.exp > Date.now() + 30_000) return tokenCache.token;

  const creds = Buffer.from(`${env('BOXTAL_ACCESS_KEY')}:${env('BOXTAL_SECRET_KEY')}`).toString('base64');
  const res = await fetch(`${boxtalBase()}/iam/account-app/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}` },
  });
  if (!res.ok) {
    throw new Error(`Échec d'authentification Boxtal (HTTP ${res.status}). Vérifiez les clés et BOXTAL_API_BASE.`);
  }
  const data = await res.json();
  const token = data?.accessToken;
  if (!token) throw new Error('Réponse token Boxtal invalide (accessToken manquant).');
  // JWT exp si présent, sinon 5 min par défaut.
  let exp = Date.now() + 5 * 60_000;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    if (payload?.exp) exp = payload.exp * 1000;
  } catch { /* garde le défaut */ }
  tokenCache = { token, exp };
  return token;
}

// Lien de suivi Chronopost à partir du n° de suivi.
export function chronopostTrackingUrl(trackingNumber: string): string {
  return `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${encodeURIComponent(trackingNumber)}`;
}

// Extraction défensive du n° de suivi + URL du label depuis la réponse V3.
// (Les chemins exacts peuvent varier d'une offre à l'autre : on couvre les
// emplacements connus et on conserve la réponse brute pour ajustement.)
function pick(obj: any, paths: string[]): string | null {
  for (const p of paths) {
    const val = p.split('.').reduce((o: any, k) => {
      if (o == null) return undefined;
      const m = k.match(/^(\w+)\[(\d+)\]$/);
      if (m) return o[m[1]]?.[Number(m[2])];
      return o[k];
    }, obj);
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return null;
}

interface CreateShipmentInput {
  orderId: string;
  totalAmount: number;
  customer: BoxtalAddress;
  weightKg: number;
  contentDescription?: string;
}

export async function createBoxtalShipment(input: CreateShipmentInput): Promise<BoxtalShipmentResult> {
  const token = await getBoxtalToken();
  const sender = senderAddress();

  const body = {
    insured: false,
    shipment: {
      packages: [
        {
          type: 'PARCEL',
          value: { value: Math.max(1, Math.round(input.totalAmount)), currency: 'EUR' },
          length: 20,
          width: 12,
          height: 6,
          weight: input.weightKg,
          content: { id: CONTENT_CATEGORY_ID, description: input.contentDescription || CONTENT_CATEGORY_LABEL },
          stackable: true,
          externalId: `ORDER-${input.orderId}`,
        },
      ],
      toAddress: {
        type: input.customer.type || 'RESIDENTIAL',
        contact: {
          email: input.customer.email,
          phone: input.customer.phone,
          lastName: input.customer.lastName || '',
          firstName: input.customer.firstName || '',
        },
        location: {
          city: input.customer.city,
          number: input.customer.number ?? null,
          street: input.customer.street,
          postalCode: input.customer.postalCode,
          countryIsoCode: input.customer.countryIsoCode || 'FR',
        },
      },
      fromAddress: {
        type: 'BUSINESS',
        contact: {
          email: sender.email,
          phone: sender.phone,
          company: sender.company,
          lastName: sender.lastName || '',
          firstName: sender.firstName || '',
        },
        location: {
          city: sender.city,
          number: sender.number ?? null,
          street: sender.street,
          postalCode: sender.postalCode,
          countryIsoCode: sender.countryIsoCode,
        },
      },
      returnAddress: {
        type: 'BUSINESS',
        contact: {
          email: sender.email,
          phone: sender.phone,
          company: sender.company,
          lastName: sender.lastName || '',
          firstName: sender.firstName || '',
        },
        location: {
          city: sender.city,
          number: sender.number ?? null,
          street: sender.street,
          postalCode: sender.postalCode,
          countryIsoCode: sender.countryIsoCode,
        },
      },
      externalId: `ORDER-${input.orderId}`,
    },
    labelType: 'PDF_A4',
    shippingOfferCode: offerCode(),
    expectedTakingOverDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  };

  const res = await fetch(`${boxtalBase()}/shipping/v3.1/shipping-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errs = (raw as any)?.errors || (raw as any)?.messages;
    const detail = Array.isArray(errs)
      ? errs.map((e: any) => e.text || e.message || JSON.stringify(e)).join(' · ')
      : `HTTP ${res.status}`;
    throw new Error(`Erreur création expédition Boxtal : ${detail}`);
  }

  const content = (raw as any)?.content ?? raw;
  const trackingNumber = pick(content, [
    'parcels[0].trackingNumber',
    'packages[0].trackingNumber',
    'trackingNumber',
    'tracking.number',
  ]);
  const labelUrl = pick(content, [
    'labelUrl',
    'label.url',
    'documents[0].url',
    'labels[0].url',
    'parcels[0].labelUrl',
  ]);
  const shipmentId = pick(content, ['shipmentId', 'id']);
  const status = pick(content, ['status']);

  return {
    shipmentId,
    trackingNumber,
    trackingUrl: trackingNumber ? chronopostTrackingUrl(trackingNumber) : null,
    labelUrl,
    status,
    raw,
  };
}

// Télécharge le PDF du bordereau (depuis l'URL renvoyée par Boxtal). Renvoie
// les octets pour upload Storage + téléchargement admin.
export async function downloadBoxtalLabel(labelUrl: string): Promise<Buffer> {
  const token = await getBoxtalToken();
  const res = await fetch(labelUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Téléchargement du bordereau impossible (HTTP ${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}
