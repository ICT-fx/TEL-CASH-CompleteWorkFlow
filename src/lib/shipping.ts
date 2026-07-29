// Frais de livraison — UNE option payante.
// Prix configurable via NEXT_PUBLIC_SHIPPING_FEE_EUR (dispo client + serveur).
// Défaut 9,90 € pour couvrir le coût réel du bordereau (~9,88 €).

export const SHIPPING_FEE_EUR: number =
  Number(process.env.NEXT_PUBLIC_SHIPPING_FEE_EUR) > 0
    ? Number(process.env.NEXT_PUBLIC_SHIPPING_FEE_EUR)
    : 9.9;

export const SHIPPING_LABEL = 'Livraison à domicile';
export const SHIPPING_SUBLABEL = 'Livraison sous 5 à 10 jours ouvrés, avec suivi';

// Retrait en boutique — gratuit, alternative à la livraison à domicile.
// Adresse identique à celle de l'expéditeur Boxtal / pied de facture (lib/boxtal.ts,
// api/checkout/route.ts) : source unique ici pour le checkout, l'admin et les emails.
export type DeliveryMethod = 'home' | 'pickup';

export const PICKUP_LABEL = 'Retrait en boutique — Angers';
export const PICKUP_SUBLABEL = 'Gratuit, sous 24 à 48h — vous recevrez un email dès que votre commande est prête';
export const PICKUP_STORE_NAME = 'TEL & CASH — PC Angers';
export const PICKUP_STORE_ADDRESS_LINE1 = '10 rue Saint-Étienne';
export const PICKUP_STORE_ADDRESS_LINE2 = '49100 Angers';
export const PICKUP_STORE_PHONE = '02 85 35 95 32';

// Texte de délai de livraison — SOURCE UNIQUE, à réutiliser partout (hero, fiches,
// checkout, emails, FAQ). On ne promet plus de délai express / 24h / lendemain.
export const SHIPPING_DELAY_LABEL = 'Livraison sous 5 à 10 jours ouvrés';
// Variante courte pour les puces/badges étroits.
export const SHIPPING_DELAY_SHORT = 'Livraison 5 à 10 j ouvrés';

// Montant formaté FR (ex. « 9,90 € »).
export function formatShippingFee(n: number = SHIPPING_FEE_EUR): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}
