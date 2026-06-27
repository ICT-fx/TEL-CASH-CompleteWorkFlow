-- =====================================================================
-- TEL & CASH — Migration 027
-- fn_canonical_color : ajoute teal -> green.
-- Apple nomme « Teal » la couleur que Foxway étiquette « Green » sur
-- l'iPhone 16 / 16 Plus (vérifié sur le feed). On les fait converger.
-- Caveat assumé : Foxway distingue Teal et Green sur le Redmi Note 13 Pro 5G ;
--   ce modèle n'étant pas vendu en magasin dans ces couleurs, l'impact est nul
--   (et fail-open de toute façon).
-- Effet immédiat (vues recalculées à la lecture).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_canonical_color(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $$
DECLARE c text;
BEGIN
  c := public.fn_norm_text(raw);
  IF c IS NULL THEN RETURN NULL; END IF;
  RETURN CASE c
    WHEN 'product red' THEN 'red'
    WHEN '(product) red' THEN 'red'
    WHEN 'space black' THEN 'black'
    WHEN 'jet black' THEN 'black'
    WHEN 'black titanium' THEN 'black'
    WHEN 'midnight' THEN 'black'
    WHEN 'sierra blue' THEN 'blue'
    WHEN 'pacific blue' THEN 'blue'
    WHEN 'blue titanium' THEN 'blue'
    WHEN 'ultramarine' THEN 'blue'
    WHEN 'alpine green' THEN 'green'
    WHEN 'midnight green' THEN 'green'
    WHEN 'teal' THEN 'green'
    WHEN 'space gray' THEN 'grey'
    WHEN 'space grey' THEN 'grey'
    WHEN 'gray' THEN 'grey'
    WHEN 'natural titanium' THEN 'grey'
    WHEN 'deep purple' THEN 'purple'
    WHEN 'white titanium' THEN 'white'
    WHEN 'starlight' THEN 'white'
    WHEN 'desert titanium' THEN 'beige'
    ELSE c
  END;
END;
$$;
