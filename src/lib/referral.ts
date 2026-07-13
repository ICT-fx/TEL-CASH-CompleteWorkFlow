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
