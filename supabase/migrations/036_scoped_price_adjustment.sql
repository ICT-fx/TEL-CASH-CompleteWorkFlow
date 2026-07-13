-- =====================================================================
-- TEL & CASH -- Migration 036
-- Ajustement de prix ±X % ciblé par marques / modèles (/admin/prix).
--
-- Évolution de la migration 035 : le pourcentage n'est plus un réglage global
-- unique (pricing_settings) mais est mémorisé PAR LIGNE produit
-- (`price_adjust_pct`). On peut ainsi cibler un ajustement sur des marques ou
-- une sélection de modèles, en cumuler plusieurs en parallèle (ex. −10 % Apple
-- et −20 % sur 3 modèles), et l'admin affiche le pourcentage exact par modèle.
--
-- Invariants conservés :
--  • price_base fige le prix d'origine au 1er ajustement d'une ligne ;
--    ré-appliquer recalcule depuis price_base → jamais cumulatif sur une ligne.
--  • « Revenir à la normale » restaure TOUTES les lignes ajustées à l'identique.
--  • Une saisie manuelle (bulk_update_prices) devient le nouveau prix de
--    référence : price_base et price_adjust_pct sont vidés.
-- =====================================================================

BEGIN;

-- 1) Pourcentage actif par ligne (NULL = ligne non ajustée).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_adjust_pct NUMERIC(6,2);

-- 2) La table singleton de la 035 est remplacée par le pourcentage par ligne.
DROP TABLE IF EXISTS public.pricing_settings;

-- 3) Appliquer ±pct % sur une portée : tout le catalogue magasin (par défaut),
--    des marques (p_brands), ou des modèles précis (p_models). Les lignes à
--    prix 0 (variantes grisées) sont ignorées.
DROP FUNCTION IF EXISTS public.apply_global_price_adjustment(numeric);
CREATE OR REPLACE FUNCTION public.apply_price_adjustment(
  pct numeric,
  p_brands text[] DEFAULT NULL,
  p_models text[] DEFAULT NULL
)
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
      price_adjust_pct = pct,
      price_updated_at = now(),
      updated_at       = now()
  WHERE source = 'manual'
    AND COALESCE(price_base, price) > 0
    AND (p_brands IS NULL OR brand = ANY(p_brands))
    AND (p_models IS NULL OR model = ANY(p_models));

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 4) Revenir à la normale : restaure TOUTES les lignes ajustées.
DROP FUNCTION IF EXISTS public.revert_global_price_adjustment();
CREATE OR REPLACE FUNCTION public.revert_price_adjustments()
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
      price_adjust_pct = NULL,
      price_updated_at = now(),
      updated_at       = now()
  WHERE source = 'manual'
    AND price_base IS NOT NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 5) Une saisie manuelle devient le nouveau prix de référence.
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
      price_adjust_pct = NULL,
      price_updated_at = now(),
      updated_at = now()
  FROM u
  WHERE p.id = u.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 6) Même durcissement que la migration 024 : exécution réservée à service_role.
REVOKE ALL ON FUNCTION public.apply_price_adjustment(numeric, text[], text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revert_price_adjustments()                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bulk_update_prices(jsonb)                       FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_price_adjustment(numeric, text[], text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.revert_price_adjustments()                      TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_update_prices(jsonb)                       TO service_role;

COMMIT;
