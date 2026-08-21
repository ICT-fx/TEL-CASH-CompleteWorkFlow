// Génération des codes promo de relance « panier abandonné » — remise fixe de
// 20 € (valeur de la protection d'écran ScreenArmor), usage unique, expire à
// +7 j. Un pourcentage grimpait trop vite sur un gros panier (téléphone à
// 800 € → -40 €) ; une remise fixe reste stable et raisonnable quel que soit
// le montant. Codes préfixés REVIENS- pour les distinguer des codes de
// parrainage (TC-…), source='winback' en base.

export const WINBACK_DISCOUNT_FIXED_EUR = 20;
export const WINBACK_VALIDITY_DAYS = 7;

export function buildWinbackCode(rand: string): string {
  return `REVIENS-${rand.toUpperCase()}`;
}

export function winbackExpiry(now: Date): string {
  return new Date(now.getTime() + WINBACK_VALIDITY_DAYS * 86400_000).toISOString();
}

// Interface minimale du client Supabase admin (insert sur referral_codes).
interface SupabaseLike {
  from: (t: string) => {
    insert: (row: Record<string, unknown>) => {
      select: () => { single: () => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> };
    };
  };
}

export function randomPart(): string {
  // Même famille que le parrainage : 5 caractères base36.
  return Math.random().toString(36).substring(2, 7).padEnd(5, '0').toUpperCase();
}

// Insère un code de relance -5 % pour un utilisateur et renvoie le code.
// Retry en cas de collision de la contrainte UNIQUE sur `code`.
export async function createWinbackCode(db: SupabaseLike, userId: string, now: Date): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = buildWinbackCode(randomPart());
    const { error } = await db
      .from('referral_codes')
      .insert({
        user_id: userId,
        code,
        discount_value: WINBACK_DISCOUNT_FIXED_EUR,
        discount_type: 'fixed',
        max_uses: 1,
        is_active: true,
        expires_at: winbackExpiry(now),
        source: 'winback',
      })
      .select()
      .single();
    if (!error) return code;
    // 23505 = unique_violation → on régénère un code.
    if (error.code !== '23505') throw new Error(`createWinbackCode: ${error.message}`);
  }
  throw new Error('createWinbackCode: impossible de générer un code unique après 5 essais');
}
