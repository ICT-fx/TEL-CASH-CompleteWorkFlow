-- =====================================================================
-- TEL & CASH -- Migration 020
-- Horodatage dédié de la dernière mise à jour DU PRIX.
--
-- Pourquoi : /admin/prix doit afficher « dernière mise à jour du prix » par
-- ligne. `updated_at` bouge à chaque écriture produit (stock, etc.) → pas fidèle
-- au seul prix. On ajoute une colonne dédiée, écrite uniquement quand le prix
-- (ou le prix barré) change, via bulk_update_prices, et à la création d'une
-- variante de grade depuis /admin/prix.
--
-- Additive et non destructive. price_updated_at NULL = jamais tarifé via l'UI.
-- =====================================================================

BEGIN;

-- 1) Colonne dédiée (NULL par défaut sur l'existant).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_updated_at TIMESTAMPTZ;

-- 2) bulk_update_prices écrit désormais aussi price_updated_at = now().
CREATE OR REPLACE FUNCTION public.bulk_update_prices(updates jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH u AS (
    SELECT
      (e->>'id')::uuid                                   AS id,
      (e->>'price')::numeric                             AS price,
      (e ? 'compare_at_price')                           AS has_cap,
      CASE WHEN e ? 'compare_at_price'
           THEN (e->>'compare_at_price')::numeric END    AS cap
    FROM jsonb_array_elements(updates) AS e
  )
  UPDATE public.products p
  SET price = u.price,
      compare_at_price = CASE WHEN u.has_cap THEN u.cap ELSE p.compare_at_price END,
      price_updated_at = now(),
      updated_at = now()
  FROM u
  WHERE p.id = u.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMIT;
