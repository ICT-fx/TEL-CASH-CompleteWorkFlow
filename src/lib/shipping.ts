// Frais de livraison — UNE option payante (Chronopost express).
// Prix configurable via NEXT_PUBLIC_SHIPPING_FEE_EUR (dispo client + serveur).
// Défaut 9,90 € pour couvrir le coût réel du bordereau Chronopost (~9,88 €).

export const SHIPPING_FEE_EUR: number =
  Number(process.env.NEXT_PUBLIC_SHIPPING_FEE_EUR) > 0
    ? Number(process.env.NEXT_PUBLIC_SHIPPING_FEE_EUR)
    : 9.9;

export const SHIPPING_LABEL = 'Livraison Chronopost Express';
export const SHIPPING_SUBLABEL = 'À domicile sous 24 h–48 h, avec suivi';

// Montant formaté FR (ex. « 9,90 € »).
export function formatShippingFee(n: number = SHIPPING_FEE_EUR): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}
