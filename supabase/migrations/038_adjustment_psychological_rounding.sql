-- =====================================================================
-- TEL & CASH -- Migration 038
-- Ajustement de prix : arrondi psychologique au « 9 » le plus proche.
--
-- Demande magasin : un prix passé à ±X % doit tomber sur le nombre entier
-- terminant par 9 le plus proche (ex. 132 → 129, 568 → 569). Remplace
-- l'arrondi à l'euro de la migration 037. Seul le prix AJUSTÉ est arrondi ;
-- « Revenir à la normale » restaure toujours price_base à l'identique.
--
-- Formule : ROUND((x + 1) / 10) * 10 - 1
--   132 → 133/10 = 13.3 → 13 → 129     568 → 569/10 = 56.9 → 57 → 569
-- Égalité (ex. 124, à 5 de 119 et 129) → arrondi au-dessus (129).
-- GREATEST(9, …) évite un prix nul/négatif sur les très petits montants.
-- =====================================================================

BEGIN;

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
      -- Arrondi psychologique : prix entier terminant par 9 le plus proche.
      price            = GREATEST(9, ROUND((COALESCE(price_base, price) * (1 + pct / 100.0) + 1) / 10) * 10 - 1),
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

-- CREATE OR REPLACE conserve les ACL, on ré-affirme par sécurité (cf. 024/036/037).
REVOKE ALL ON FUNCTION public.apply_price_adjustment(numeric, text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_price_adjustment(numeric, text[], text[]) TO service_role;

COMMIT;
