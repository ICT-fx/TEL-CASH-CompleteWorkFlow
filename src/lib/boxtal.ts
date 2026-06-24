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
  orderId: string | null;        // réf. commande d'expédition Boxtal (ex. 2606…CHRP…)
  shipmentId: string | null;
  trackingNumber: string | null; // n° Chronopost (souvent null à la création)
  trackingUrl: string | null;
  labelUrl: string | null;       // URL CDN signée du PDF bordereau
  status: string | null;
  raw: unknown;                  // réponses brutes (create + document + tracking)
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
    email: env('BOXTAL_SENDER_EMAIL') || 'infos@telandcash.fr',
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
// Les SERVICES posés en magasin (product_type='protection_posee') ne sont PAS un
// objet expédié en plus : ils sont appliqués sur le téléphone du colis → poids nul.
export function parcelWeightKg(
  items: { category?: string | null; product_type?: string | null; quantity?: number }[],
): number {
  let w = 0;
  for (const it of items) {
    if ((it.product_type || '') === 'protection_posee') continue; // service posé, pas un colis
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
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(`${boxtalBase()}/iam/account-app/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}` },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
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

// Vérifie que l'auth V3 réussit RÉELLEMENT sur la base configurée
// (BOXTAL_API_BASE). Sert à activer le bouton admin uniquement quand un token
// est obtenu sur le bon environnement. Ne lève jamais — renvoie un booléen.
export async function boxtalAuthOk(): Promise<boolean> {
  if (!isBoxtalConfigured()) return false;
  try {
    const token = await getBoxtalToken();
    return Boolean(token);
  } catch {
    return false;
  }
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

  // La réponse de création est minimale : { id, shipmentId, status, prix… }.
  // Le bordereau et le suivi sont des ressources SÉPARÉES (modèle asynchrone V3).
  const content = (raw as any)?.content ?? raw;
  const orderId = pick(content, ['id']) || pick(content, ['shipmentId']);
  const shipmentId = pick(content, ['shipmentId', 'id']);
  const status = pick(content, ['status']);

  // Bordereau : GET /shipping-order/{id}/shipping-document (type LABEL). Généré
  // juste après la création → court polling pour laisser le temps au PDF.
  let labelUrl: string | null = null;
  let documentRaw: unknown = null;
  if (orderId) {
    for (let i = 0; i < 5 && !labelUrl; i++) {
      const { labelUrl: u, raw: dr } = await getShippingDocuments(orderId, token);
      labelUrl = u;
      documentRaw = dr;
      if (!labelUrl) await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Suivi : GET /shipping-order/{id}/tracking. Souvent vide à la création (le n°
  // Chronopost apparaît à la prise en charge). On l'extrait s'il est présent.
  let trackingNumber: string | null = null;
  let trackingRaw: unknown = null;
  if (orderId) {
    const t = await getTracking(orderId, token);
    trackingNumber = t.trackingNumber;
    trackingRaw = t.raw;
  }

  return {
    orderId,
    shipmentId: shipmentId || orderId,
    trackingNumber,
    trackingUrl: trackingNumber ? chronopostTrackingUrl(trackingNumber) : null,
    labelUrl,
    status,
    raw: { create: raw, shippingDocument: documentRaw, tracking: trackingRaw, orderId },
  };
}

// Récupère l'URL du bordereau (document type LABEL) d'une commande d'expédition.
export async function getShippingDocuments(
  orderId: string,
  token?: string,
): Promise<{ labelUrl: string | null; raw: unknown }> {
  const tok = token || (await getBoxtalToken());
  const res = await fetch(`${boxtalBase()}/shipping/v3.1/shipping-order/${orderId}/shipping-document`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) return { labelUrl: null, raw };
  const docs = (raw as any)?.content;
  const label = Array.isArray(docs)
    ? docs.find((d: any) => d?.type === 'LABEL') || docs.find((d: any) => typeof d?.url === 'string')
    : null;
  return { labelUrl: label?.url || null, raw };
}

// Récupère le n° de suivi depuis les événements de tracking (souvent vide tant
// que le transporteur n'a pas pris en charge le colis).
export async function getTracking(
  orderId: string,
  token?: string,
): Promise<{ trackingNumber: string | null; raw: unknown }> {
  const tok = token || (await getBoxtalToken());
  const res = await fetch(`${boxtalBase()}/shipping/v3.1/shipping-order/${orderId}/tracking`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) return { trackingNumber: null, raw };
  const events = (raw as any)?.content;
  let trackingNumber: string | null = null;
  if (Array.isArray(events)) {
    for (const e of events) {
      const n = e?.trackingNumber || e?.parcelNumber || e?.number || e?.reference;
      if (typeof n === 'string' && n.trim()) { trackingNumber = n.trim(); break; }
    }
  }
  return { trackingNumber, raw };
}

// Télécharge le PDF du bordereau. L'URL Boxtal est une URL CDN SIGNÉE
// (document.boxtal.com) → pas d'en-tête d'auth nécessaire.
export async function downloadBoxtalLabel(labelUrl: string): Promise<Buffer> {
  const res = await fetch(labelUrl);
  if (!res.ok) throw new Error(`Téléchargement du bordereau impossible (HTTP ${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}
