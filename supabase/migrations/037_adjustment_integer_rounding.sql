-- =====================================================================
-- TEL & CASH -- Migration 037
-- Ajustement de prix : arrondi à l'euro (prix entiers, sans centimes).
--
-- Demande magasin : un prix passé à ±X % doit rester un chiffre rond
-- (ex. 369.99 € à −10 % → 333 €, pas 332.99 €). Seul le prix AJUSTÉ est
-- arrondi ; « Revenir à la normale » restaure toujours price_base à
-- l'identique (centimes compris).
--
-- Le « prix définitif » (sortie d'un modèle du périmètre d'ajustement) ne
-- nécessite pas de fonction : l'API vide price_base/price_adjust_pct en
-- service_role sans toucher au prix.
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
      -- Arrondi à l'euro : les prix ajustés restent des chiffres ronds.
      price            = ROUND(COALESCE(price_base, price) * (1 + pct / 100.0)),
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

-- CREATE OR REPLACE conserve les ACL, on ré-affirme par sécurité (cf. 024/036).
REVOKE ALL ON FUNCTION public.apply_price_adjustment(numeric, text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_price_adjustment(numeric, text[], text[]) TO service_role;

COMMIT;
