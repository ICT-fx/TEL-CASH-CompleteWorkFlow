-- ========================================
-- TEL & CASH — Migration 031
-- Relance « panier abandonné » : flag anti-doublon sur les commandes
-- ========================================
-- Une commande reste au statut 'pending' tant que le paiement n'a jamais
-- abouti (le webhook Stripe la passe à 'paid'). Le cron quotidien
-- /api/cron/abandoned-cart relance UNE fois ces commandes restées pending
-- > 24 h, puis horodate ici pour ne jamais relancer deux fois.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS abandoned_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.abandoned_reminder_sent_at IS
  'Horodatage de la relance « panier abandonné » (anti-doublon : 1 relance max). NULL = jamais relancé.';

-- Index partiel pour le cron : ne cible que les paniers abandonnés non relancés.
CREATE INDEX IF NOT EXISTS idx_orders_abandoned_reminder
  ON public.orders (created_at)
  WHERE status = 'pending' AND abandoned_reminder_sent_at IS NULL;
