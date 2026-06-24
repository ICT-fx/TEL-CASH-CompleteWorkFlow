-- =====================================================================
-- TEL & CASH -- Migration 022
-- Fluxitron comme signal de stock « live » : grisage du catalogue magasin.
-- Spec : docs/superpowers/specs/2026-06-24-fluxitron-stock-availability-design.md
--
-- PRINCIPE (Approche A / A1, lu au runtime, SANS cron) :
--   * Les lignes source='fluxitron' restent un MIROIR de stock fournisseur,
--     jamais visibles client (filtre source='manual' côté app).
--   * Une vue overlay calcule greyed_by_supplier par variante magasin :
--       grisé = interrupteur ON
--               ET une variante Fluxitron correspond (clé canonique)
--               ET sa donnée est FRAÎCHE (updated_at < seuil)
--               ET son stock agrégé = 0.
--     Tout le reste (pas de match, périmé, frais>0, OFF) → vendable (fail-open).
--
-- NON DESTRUCTIVE : ne touche aucune ligne products. Ajoute fonctions, une
--   table de réglages (singleton) et deux vues. Idempotente (CREATE OR REPLACE).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Helpers de normalisation (PERMANENTS, IMMUTABLE) — appliqués des DEUX
--    côtés (magasin & miroir) pour que la clé de matching soit cohérente.
-- ---------------------------------------------------------------------

-- Texte canonique : minuscule, espaces compactés, vide -> NULL.
CREATE OR REPLACE FUNCTION public.fn_norm_text(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  s := lower(btrim(regexp_replace(raw, '\s+', ' ', 'g')));
  IF s = '' THEN RETURN NULL; END IF;
  RETURN s;
END;
$$;

-- Modèle canonique : fn_norm_text + alias connus (iPhone SE générations).
--   'iphone se (2nd generation)' / 'iphone se (2020)' -> 'iphone se 2020'
--   'iphone se (3rd generation)' / 'iphone se (2022)' -> 'iphone se 2022'
-- Les autres modèles passent inchangés.
CREATE OR REPLACE FUNCTION public.fn_canonical_model(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE m text;
BEGIN
  m := public.fn_norm_text(raw);
  IF m IS NULL THEN RETURN NULL; END IF;
  m := replace(m, '(2nd generation)', '2020');
  m := replace(m, '2nd generation', '2020');
  m := replace(m, '(3rd generation)', '2022');
  m := replace(m, '3rd generation', '2022');
  m := replace(m, '(2020)', '2020');
  m := replace(m, '(2022)', '2022');
  m := btrim(regexp_replace(m, '\s+', ' ', 'g'));
  RETURN m;
END;
$$;

-- Stockage normalisé — repris à l'identique de la migration 019
-- (src/lib/productVariants.ts:normalizeStorage). '256 GB' -> '256 Go', etc.
CREATE OR REPLACE FUNCTION public.fn_norm_storage(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text; m text[]; num bigint; unit text; gb bigint;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  s := btrim(raw);
  IF s = '' OR s = '—' THEN RETURN NULL; END IF;
  m := regexp_match(s, '(\d{1,4})\s*(to|tb|go|gb)?', 'i');
  IF m IS NULL THEN RETURN NULL; END IF;
  num := (m[1])::bigint;
  unit := lower(coalesce(m[2], ''));
  gb := num;
  IF unit IN ('to', 'tb') THEN gb := num * 1024; END IF;
  IF gb <= 0 THEN RETURN NULL; END IF;
  IF gb >= 1024 AND gb % 1024 = 0 THEN RETURN (gb / 1024)::text || ' To'; END IF;
  RETURN gb::text || ' Go';
END;
$$;

-- Grade ramené à 3 paliers magasin : A+/A->A, B+/B->B, C+/C->C.
-- D / E / inconnu / NULL -> NULL  (exclus du matching : jamais vendus).
CREATE OR REPLACE FUNCTION public.fn_grade_tier(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE g text; m text[];
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  g := upper(btrim(regexp_replace(raw, '\s+', ' ', 'g')));
  IF g = '' THEN RETURN NULL; END IF;
  m := regexp_match(g, '\m(?:GRADE\s*)?([ABC])\s*(\+)?');
  IF m IS NOT NULL THEN RETURN m[1]; END IF;   -- m[1] = lettre A/B/C (le « + » est ignoré)
  RETURN NULL;                                  -- D, E, libellés non reconnus
END;
$$;

-- Couleur canonique : noms marketing Apple -> couleur de base Foxway.
-- CONSERVATEUR : seuls les synonymes sûrs sont repliés. Les ambigus
-- (midnight, starlight, natural/desert titanium, ultramarine, rose gold…)
-- restent en identité => pas de match => variante VENDABLE (fail-open),
-- et remontent au diagnostic admin pour cartographie manuelle.
CREATE OR REPLACE FUNCTION public.fn_canonical_color(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
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
    -- bleu
    WHEN 'sierra blue' THEN 'blue'
    WHEN 'pacific blue' THEN 'blue'
    WHEN 'blue titanium' THEN 'blue'
    -- vert
    WHEN 'alpine green' THEN 'green'
    WHEN 'midnight green' THEN 'green'
    -- gris
    WHEN 'space gray' THEN 'grey'
    WHEN 'space grey' THEN 'grey'
    WHEN 'gray' THEN 'grey'
    -- violet
    WHEN 'deep purple' THEN 'purple'
    -- blanc
    WHEN 'white titanium' THEN 'white'
    -- identité (inclut les ambigus laissés volontairement non mappés)
    ELSE c
  END;
END;
$$;

-- ---------------------------------------------------------------------
-- 2) Réglages (singleton) : interrupteur + seuil de fraîcheur.
--    greying_enabled=false par défaut => grisage INACTIF tant qu'on n'a pas
--    fait un ré-import frais (sécurité : sinon le miroir actuel à stock=0
--    griserait tout). À basculer ON depuis l'admin après vérification.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_sync_settings (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  greying_enabled boolean NOT NULL DEFAULT false,
  freshness_hours int     NOT NULL DEFAULT 48 CHECK (freshness_hours > 0),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.supplier_sync_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.supplier_sync_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_sync_settings_admin_all ON public.supplier_sync_settings;
CREATE POLICY supplier_sync_settings_admin_all ON public.supplier_sync_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.supplier_sync_settings TO service_role;

-- Réutilise le trigger générique updated_at (migration 001).
DROP TRIGGER IF EXISTS trg_supplier_sync_settings_updated_at ON public.supplier_sync_settings;
CREATE TRIGGER trg_supplier_sync_settings_updated_at
  BEFORE UPDATE ON public.supplier_sync_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Index d'appui pour l'agrégat miroir.
CREATE INDEX IF NOT EXISTS idx_products_source_category
  ON public.products (source, category);

-- ---------------------------------------------------------------------
-- 3) Vue d'agrégat du stock fournisseur, par clé canonique.
--    Ignore is_active (le miroir est caché mais son stock compte) ;
--    exclut D/E et les clés incomplètes (storage/color/grade manquants).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_supplier_variant_stock
WITH (security_invoker = true) AS
SELECT
  public.fn_norm_text(brand)               AS brand_k,
  public.fn_canonical_model(model)         AS model_k,
  public.fn_norm_storage(storage_capacity) AS storage_k,
  public.fn_grade_tier(grade)              AS grade_k,
  public.fn_canonical_color(color)         AS color_k,
  SUM(GREATEST(COALESCE(stock, 0), 0))     AS supplier_stock,
  MAX(updated_at)                          AS supplier_last_synced,
  COUNT(*)                                 AS supplier_rows
FROM public.products
WHERE source = 'fluxitron'
  AND category = 'telephones'
  AND public.fn_grade_tier(grade)              IS NOT NULL
  AND public.fn_norm_storage(storage_capacity) IS NOT NULL
  AND public.fn_canonical_color(color)         IS NOT NULL
  AND public.fn_norm_text(brand)               IS NOT NULL
  AND public.fn_canonical_model(model)         IS NOT NULL
GROUP BY 1, 2, 3, 4, 5;

-- ---------------------------------------------------------------------
-- 4) Vue overlay catalogue : products magasin + greyed_by_supplier.
--    cfg via agrégat (renvoie TOUJOURS 1 ligne, même table vide) pour ne
--    jamais réduire le catalogue à zéro ligne.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_catalog_products
WITH (security_invoker = true) AS
SELECT
  p.*,
  (s.supplier_rows IS NOT NULL)            AS supplier_match,
  s.supplier_stock                         AS supplier_stock,
  s.supplier_last_synced                   AS supplier_last_synced,
  (
        cfg.greying_enabled
    AND s.supplier_rows IS NOT NULL
    AND s.supplier_last_synced > (now() - make_interval(hours => cfg.freshness_hours))
    AND COALESCE(s.supplier_stock, 0) = 0
  )                                        AS greyed_by_supplier
FROM public.products p
CROSS JOIN (
  SELECT
    COALESCE(bool_or(greying_enabled), false) AS greying_enabled,
    COALESCE(max(freshness_hours), 48)        AS freshness_hours
  FROM public.supplier_sync_settings
) cfg
LEFT JOIN public.v_supplier_variant_stock s
  ON  s.brand_k   = public.fn_norm_text(p.brand)
  AND s.model_k   = public.fn_canonical_model(p.model)
  AND s.storage_k = public.fn_norm_storage(p.storage_capacity)
  AND s.grade_k   = public.fn_grade_tier(p.grade)
  AND s.color_k   = public.fn_canonical_color(p.color)
WHERE p.source = 'manual';

GRANT SELECT ON public.v_supplier_variant_stock TO service_role;
GRANT SELECT ON public.v_catalog_products       TO service_role;
-- Sécurité : un GRANT est additif, il ne restreint PAS. Les privilèges par
-- défaut du schéma public exposeraient ces vues à anon/authenticated (PostgREST).
-- On RÉVOQUE explicitement : ces vues portent des données fournisseur
-- confidentielles (stock miroir) et ne doivent jamais sortir par l'API publique.
REVOKE ALL ON public.v_supplier_variant_stock FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_catalog_products       FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) Diagnostic « santé du flux » (admin) : compteurs en une passe.
--    Inclut les couleurs probablement NON MAPPÉES : variante magasin dont
--    (modèle, stockage, grade) matche le miroir mais PAS la couleur.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.supplier_sync_health()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cfg AS (
    SELECT COALESCE(bool_or(greying_enabled), false) AS greying_enabled,
           COALESCE(max(freshness_hours), 48)        AS freshness_hours
    FROM public.supplier_sync_settings
  ),
  manual AS (
    SELECT
      public.fn_norm_text(brand)               AS brand_k,
      public.fn_canonical_model(model)         AS model_k,
      public.fn_norm_storage(storage_capacity) AS storage_k,
      public.fn_grade_tier(grade)              AS grade_k,
      public.fn_canonical_color(color)         AS color_k,
      color
    FROM public.products
    WHERE source = 'manual' AND is_active AND category = 'telephones'
  ),
  sup AS (SELECT * FROM public.v_supplier_variant_stock),
  cat AS (
    SELECT greyed_by_supplier, supplier_match
    FROM public.v_catalog_products
    WHERE is_active AND category = 'telephones'
  )
  SELECT jsonb_build_object(
    'greying_enabled',      (SELECT greying_enabled FROM cfg),
    'freshness_hours',      (SELECT freshness_hours FROM cfg),
    'manual_active',        (SELECT count(*) FROM cat),
    'manual_matched',       (SELECT count(*) FROM cat WHERE supplier_match),
    'manual_unmatched',     (SELECT count(*) FROM cat WHERE NOT supplier_match),
    'greyed_now',           (SELECT count(*) FROM cat WHERE greyed_by_supplier),
    'supplier_keys',        (SELECT count(*) FROM sup),
    'supplier_fresh_keys',  (SELECT count(*) FROM sup
                             WHERE supplier_last_synced > now() - make_interval(hours => (SELECT freshness_hours FROM cfg))),
    'supplier_stale_keys',  (SELECT count(*) FROM sup
                             WHERE supplier_last_synced <= now() - make_interval(hours => (SELECT freshness_hours FROM cfg))),
    'supplier_orphan_keys', (SELECT count(*) FROM sup s
                             WHERE NOT EXISTS (
                               SELECT 1 FROM manual m
                               WHERE m.brand_k = s.brand_k AND m.model_k = s.model_k
                                 AND m.storage_k = s.storage_k AND m.grade_k = s.grade_k
                                 AND m.color_k = s.color_k)),
    -- Vrais trous de mapping : couleur magasin dont la forme canonique
    -- n'apparaît NULLE PART côté miroir (≠ simple trou de couverture).
    'unmapped_colors',      (SELECT COALESCE(jsonb_agg(DISTINCT m.color ORDER BY m.color), '[]'::jsonb)
                             FROM manual m
                             WHERE m.color_k IS NOT NULL
                               AND NOT EXISTS (SELECT 1 FROM sup s WHERE s.color_k = m.color_k))
  );
$$;

GRANT EXECUTE ON FUNCTION public.supplier_sync_health() TO service_role;
-- SECURITY DEFINER + privilèges par défaut => anon pourrait l'appeler via RPC.
-- On révoque : diagnostic fournisseur réservé à l'admin (route service_role).
REVOKE ALL ON FUNCTION public.supplier_sync_health() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) Défense en profondeur DB : le miroir Fluxitron ne doit JAMAIS être
--    lisible par les rôles publics (anon/authenticated) via PostgREST.
--    La policy de lecture publique de products n'avait pas de garde `source`
--    (un invité pouvait lire products?source=eq.fluxitron). On la durcit ;
--    les admins gardent leur policy is_admin() pour la visibilité complète.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Anyone can view active products"
  ON public.products FOR SELECT
  USING (is_active = true AND source = 'manual');

COMMIT;
