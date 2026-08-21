// Règles d'usabilité d'un code promo, partagées par la validation et le checkout.
// Un code est utilisable s'il est actif, non épuisé, et non expiré.
export interface ReferralCodeUsability {
  is_active: boolean;
  times_used: number;
  max_uses: number;
  expires_at: string | null;
}

export function isReferralCodeUsable(code: ReferralCodeUsability, now: Date): boolean {
  if (!code.is_active) return false;
  if (code.times_used >= code.max_uses) return false;
  if (code.expires_at && new Date(code.expires_at).getTime() <= now.getTime()) return false;
  return true;
}

// Montant de la réduction, en euros — même règle que /api/checkout (fixe en
// euros, ou pourcentage appliqué au SOUS-TOTAL uniquement, jamais aux frais de
// port), plafonné au total facturable. Utilisé côté UI (panier, checkout) pour
// afficher un total identique à celui réellement facturé par Stripe.
export function computeDiscountAmount(
  discount: { discount_type: 'fixed' | 'percent'; discount_value: number },
  subtotal: number,
  shippingCost: number = 0
): number {
  const raw = discount.discount_type === 'fixed'
    ? discount.discount_value
    : subtotal * (discount.discount_value / 100);
  return Math.min(raw, subtotal + shippingCost);
}
