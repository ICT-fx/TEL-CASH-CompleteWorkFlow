-- Pré-lancement — robustesse du tunnel de paiement sous charge :
--   1. Idempotence des webhooks Stripe (un même événement ne crée pas 2 commandes
--      ni ne décrémente le stock 2 fois).
--   2. Décrément de stock ATOMIQUE côté base (empêche la double-vente du dernier
--      exemplaire quand 2 paiements arrivent en même temps).
--
-- Idempotent : ré-exécutable sans danger (IF NOT EXISTS / CREATE OR REPLACE).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Journal des événements Stripe traités (clé = event.id, unique par nature).
--    Le webhook insère l'id AVANT de traiter ; une 2ᵉ livraison du même event
--    échoue sur la PK et est ignorée → traitement exactement-une-fois.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id           TEXT PRIMARY KEY,       -- Stripe event.id (ex: evt_123…)
  type         TEXT,                   -- event.type (ex: checkout.session.completed)
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- Table interne (service_role uniquement). RLS activée + aucune policy publique :
-- aucun accès via la clé anon. Le webhook utilise la clé service (bypass RLS).
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Décrément de stock atomique et conditionnel.
--    UPDATE … WHERE stock >= qty : la condition + l'écriture sont évaluées dans
--    la même instruction sous verrou de ligne → deux appels concurrents ne
--    peuvent pas tomber tous les deux sous zéro.
--    Retourne le stock restant, ou -1 si stock insuffisant (rien décrémenté).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id UUID, p_qty INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  remaining INT;
BEGIN
  UPDATE public.products
     SET stock = stock - p_qty,
         updated_at = now()
   WHERE id = p_product_id
     AND stock >= p_qty
  RETURNING stock INTO remaining;

  IF NOT FOUND THEN
    RETURN -1;  -- stock insuffisant : aucun décrément (évite la double-vente)
  END IF;

  RETURN remaining;
END;
$$;
