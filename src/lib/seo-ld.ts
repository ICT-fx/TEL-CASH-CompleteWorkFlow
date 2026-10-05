import { SHIPPING_FEE_EUR } from '@/lib/shipping';

// Blocs JSON-LD réutilisables (Store + fiches produit). Sources : /retours
// (rétractation 14 j, frais de retour à la charge du client sauf accord) et
// /engagements (garantie 24 mois).

export const merchantReturnPolicyLd = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'FR',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 14,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/ReturnShippingFees',
  merchantReturnLink: 'https://telandcash.fr/retours',
};

export const warrantyLd = {
  '@type': 'WarrantyPromise',
  durationOfWarranty: { '@type': 'QuantitativeValue', value: 24, unitCode: 'MON' },
  warrantyScope: 'https://schema.org/RepairAndReplacementWarrantyScope',
};

// Livraison à domicile en France : frais et délai alignés sur lib/shipping.ts.
export const shippingDetailsLd = {
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: SHIPPING_FEE_EUR, currency: 'EUR' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'FR' },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    transitTime: { '@type': 'QuantitativeValue', minValue: 5, maxValue: 10, unitCode: 'DAY' },
  },
};

// Fin de validité du prix : 1 an après le rendu (la page est revalidée régulièrement).
export function priceValidUntil(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
