-- ========================================
-- TEL & CASH — Migration 034
-- Relance paniers abandonnés : code promo expirable (-5 %) + opt-out RGPD
-- ========================================

-- 1) Codes promo : expiration + provenance (distingue les codes de relance
--    'winback' des codes de parrainage 'referral' existants).
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'referral';

COMMENT ON COLUMN public.referral_codes.expires_at IS
  'Expiration du code (NULL = jamais). Vérifiée par /api/referral/validate et /api/checkout.';
COMMENT ON COLUMN public.referral_codes.source IS
  'Provenance : ''referral'' (parrainage) ou ''winback'' (relance panier abandonné).';

-- 2) Profils : opt-out marketing + jeton de désinscription non devinable.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid();

COMMENT ON COLUMN public.profiles.marketing_opt_out IS
  'true = le client a demandé à ne plus recevoir les relances. Respecté par /api/cron/abandoned-cart.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unsubscribe_token
  ON public.profiles (unsubscribe_token);

-- 3) Index partiel du cron élargi (pending OU cancelled non relancés).
CREATE INDEX IF NOT EXISTS idx_orders_abandoned_reminder_v2
  ON public.orders (created_at)
  WHERE abandoned_reminder_sent_at IS NULL AND status IN ('pending', 'cancelled');
