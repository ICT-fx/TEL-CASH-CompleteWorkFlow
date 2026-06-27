-- =====================================================================
-- TEL & CASH — Migration 026
-- fn_canonical_color : mappe les noms marketing Apple vers la couleur de
-- BASE Foxway, d'après les données réelles du feed (comparaison modèle par
-- modèle magasin <-> Foxway). Lève l'ambiguïté laissée volontairement en 022 :
--   Midnight         -> black   (iPhone 13/14/SE : Foxway = Black)
--   Starlight        -> white   (iPhone 13/14/SE : Foxway = White)
--   Natural Titanium -> grey    (15 Pro/16 Pro   : Foxway = Grey)
--   Desert Titanium  -> beige   (16 Pro          : Foxway = Beige)
--   Ultramarine      -> blue    (16              : Foxway = Blue)
-- Mapping 1:1 vérifié (aucune collision sur les modèles concernés).
-- Les vues v_supplier_variant_stock / v_catalog_products recalculent à la
-- lecture : effet IMMÉDIAT, pas besoin de ré-importer le feed.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_canonical_color(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $$
DECLARE c text;
BEGIN
  c := public.fn_norm_text(raw);
  IF c IS NULL THEN RETURN NULL; END IF;
  RETURN CASE c
    -- rouge
    WHEN 'product red' THEN 'red'
    WHEN '(product) red' THEN 'red'
    -- noir
    WHEN 'space black' THEN 'black'
    WHEN 'jet black' THEN 'black'
    WHEN 'black titanium' THEN 'black'
    WHEN 'midnight' THEN 'black'             -- +026 (Foxway: Black)
    -- bleu
    WHEN 'sierra blue' THEN 'blue'
    WHEN 'pacific blue' THEN 'blue'
    WHEN 'blue titanium' THEN 'blue'
    WHEN 'ultramarine' THEN 'blue'           -- +026 (Foxway: Blue)
    -- vert
    WHEN 'alpine green' THEN 'green'
    WHEN 'midnight green' THEN 'green'
    -- gris
    WHEN 'space gray' THEN 'grey'
    WHEN 'space grey' THEN 'grey'
    WHEN 'gray' THEN 'grey'
    WHEN 'natural titanium' THEN 'grey'      -- +026 (Foxway: Grey)
    -- violet
    WHEN 'deep purple' THEN 'purple'
    -- blanc
    WHEN 'white titanium' THEN 'white'
    WHEN 'starlight' THEN 'white'            -- +026 (Foxway: White)
    -- beige
    WHEN 'desert titanium' THEN 'beige'      -- +026 (Foxway: Beige)
    -- identité (inclut les ambigus encore non mappés, ex. teal)
    ELSE c
  END;
END;
$$;
