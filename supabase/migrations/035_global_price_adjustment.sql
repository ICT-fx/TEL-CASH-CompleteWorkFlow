-- =====================================================================
-- TEL & CASH -- Migration 035
-- Ajustement global des prix en pourcentage (/admin/prix).
--
-- Besoin : appliquer ±X % sur TOUS les prix du catalogue magasin en un clic,
-- afficher le pourcentage actif dans l'admin, et pouvoir « revenir à la
-- normale » sans erreur d'arrondi ni effet cumulatif.
--
-- Principe : le prix courant reste `products.price` (source de vérité du
-- storefront, aucun changement côté client). Au premier ajustement, le prix
-- d'origine est figé dans `price_base` ; chaque ré-application recalcule
-- depuis `price_base` (pas de -10 % sur -10 %). Le retour à la normale
-- restaure `price_base` puis le vide. Le pourcentage actif vit dans la table
-- singleton `pricing_settings` (même pattern que margin_settings, migr. 016).
--
-- Un prix saisi manuellement via /admin/prix pendant un ajustement devient le
-- nouveau prix de référence : bulk_update_prices vide `price_base` (la ligne
-- n'est plus concernée par « Revenir à la normale »).
-- =====================================================================

BEGIN;

-- 1) Prix de référence (NULL = aucun ajustement global mémorisé sur la ligne).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_base NUMERIC(10,2) CHECK (price_base IS NULL OR price_base >= 0);

-- 2) Réglages singleton (id=1) : pourcentage global actif.
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  global_adjustment_percent NUMERIC(6,2),          -- NULL = aucun ajustement actif
  global_adjustment_applied_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.pricing_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Deny par défaut pour anon/authenticated ; l'admin passe par service_role.
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

-- 3) Appliquer ±pct % sur tout le catalogue magasin (source='manual').
--    Les lignes à prix 0 (variantes grisées) sont ignorées. Recalcule toujours
--    depuis price_base -> ré-appliquer un autre pourcentage n'est pas cumulatif.
CREATE OR REPLACE FUNCTION public.apply_global_price_adjustment(pct numeric)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF pct IS NULL OR pct = 0 OR pct <= -95 OR pct > 500 THEN
    RAISE EXCEPTION 'Pourcentage invalide : % (attendu : entre -95 et +500, non nul)', pct;
  END IF;

  UPDATE public.products
  SET price_base       = COALESCE(price_base, price),
      price            = ROUND(COALESCE(price_base, price) * (1 + pct / 100.0), 2),
      price_updated_at = now(),
      updated_at       = now()
  WHERE source = 'manual'
    AND COALESCE(price_base, price) > 0;

  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.pricing_settings
  SET global_adjustment_percent    = pct,
      global_adjustment_applied_at = now(),
      updated_at                   = now()
  WHERE id = 1;

  RETURN affected;
END;
$$;

-- 4) Revenir à la normale : restaure price_base partout où il est mémorisé.
CREATE OR REPLACE FUNCTION public.revert_global_price_adjustment()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.products
  SET price            = price_base,
      price_base       = NULL,
      price_updated_at = now(),
      updated_at       = now()
  WHERE source = 'manual'
    AND price_base IS NOT NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.pricing_settings
  SET global_adjustment_percent    = NULL,
      global_adjustment_applied_at = NULL,
      updated_at                   = now()
  WHERE id = 1;

  RETURN affected;
END;
$$;

-- 5) Une saisie manuelle devient le nouveau prix de référence : price_base est
--    vidé, la ligne sort du périmètre de « Revenir à la normale ».
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
      price_base = NULL,
      price_updated_at = now(),
      updated_at = now()
  FROM u
  WHERE p.id = u.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 6) Même durcissement que la migration 024 : exécution réservée à service_role
--    (les privilèges par défaut du schéma public exposeraient ces RPC à anon).
REVOKE ALL ON FUNCTION public.apply_global_price_adjustment(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revert_global_price_adjustment()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bulk_update_prices(jsonb)              FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_global_price_adjustment(numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.revert_global_price_adjustment()       TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_update_prices(jsonb)              TO service_role;

COMMIT;
