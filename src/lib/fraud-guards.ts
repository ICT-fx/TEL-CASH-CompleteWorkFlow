import { createAdminClient } from './supabase-admin';

// Plafond du montant MARCHANDISE (hors frais de port) contrôlé sur une première
// commande. Réglé au-dessus du SKU le plus cher du catalogue pour ne jamais
// bloquer un achat légitime — c'est un simple garde-fou anti-abus, pas un frein.
const FIRST_ORDER_MAX_AMOUNT = 2500; // €
const NEW_ACCOUNT_DAYS = 7;

export interface FraudCheckResult {
  blocked: boolean;
  reason?: string;
}

// Run all pre-checkout fraud checks. Returns { blocked: true, reason } on first failure.
// userId = null → commande INVITÉ (guest checkout) : pas de notion de compte,
// on applique un plafond marchandise à plat + les contrôles email/ip/imei.
// `goodsAmount` = montant MARCHANDISE hors frais de port (le port n'est jamais
// compté dans le plafond).
export async function runFraudChecks(params: {
  userId: string | null;
  email: string;
  ip?: string | null;
  goodsAmount: number;
  productImeis: string[];
}): Promise<FraudCheckResult> {
  const supabase = createAdminClient();
  const { userId, email, ip, goodsAmount, productImeis } = params;

  // 1. Hard blocklist check (email, ip, user_id, imei)
  const blockChecks: Array<{ type: string; value: string }> = [
    { type: 'email', value: email.toLowerCase() },
  ];
  if (userId) blockChecks.push({ type: 'user_id', value: userId });
  if (ip) blockChecks.push({ type: 'ip', value: ip });
  for (const imei of productImeis) {
    if (imei) blockChecks.push({ type: 'imei', value: imei });
  }

  for (const c of blockChecks) {
    const { data } = await supabase
      .from('fraud_blocklist')
      .select('id, reason')
      .eq('type', c.type)
      .eq('value', c.value)
      .maybeSingle();
    if (data) {
      return { blocked: true, reason: 'Cette commande ne peut pas être traitée. Contactez le support.' };
    }
  }

  // 2. Plafond marchandise (hors port).
  const overCap = () => ({
    blocked: true,
    reason: `Pour votre sécurité, cette première commande dépasse notre plafond de ${FIRST_ORDER_MAX_AMOUNT} €. Contactez le support pour la finaliser.`,
  });

  if (!userId) {
    // Invité : pas de compte → plafond à plat.
    if (goodsAmount > FIRST_ORDER_MAX_AMOUNT) return overCap();
  } else {
    // Client connecté : plafond seulement sur la 1ʳᵉ commande d'un compte récent.
    const { data: profile } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', userId)
      .single();

    if (profile) {
      const accountAgeDays = (Date.now() - new Date(profile.created_at).getTime()) / 86400000;

      if (accountAgeDays < NEW_ACCOUNT_DAYS) {
        // Count prior paid orders.
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('status', ['paid', 'shipped', 'delivered', 'refunded']);

        const isFirstOrder = (count || 0) === 0;
        if (isFirstOrder && goodsAmount > FIRST_ORDER_MAX_AMOUNT) return overCap();
      }
    }
  }

  // 3. Disposable / temporary email domains
  const DISPOSABLE_DOMAINS = [
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
    'throwawaymail.com', 'maildrop.cc', 'getnada.com', 'yopmail.com', 'trashmail.com',
    'dispostable.com', 'sharklasers.com', 'temp-mail.org', 'fakeinbox.com',
  ];
  const domain = email.toLowerCase().split('@')[1];
  if (domain && DISPOSABLE_DOMAINS.includes(domain)) {
    return { blocked: true, reason: 'Adresse email temporaire non acceptée. Utilisez une adresse permanente.' };
  }

  return { blocked: false };
}
