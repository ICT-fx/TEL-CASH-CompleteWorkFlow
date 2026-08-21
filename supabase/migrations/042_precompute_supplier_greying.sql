-- ---------------------------------------------------------------------
-- 042 — Précalcul du grisage fournisseur (performance catalogue)
--
-- PROBLÈME MESURÉ (EXPLAIN ANALYZE, TIMING OFF, buffers en cache) :
--   v_catalog_products recalculait à CHAQUE requête l'agrégat complet du
--   miroir Fluxitron (2 199 lignes × 5 fonctions plpgsql), et deux fois :
--   une pour `gfeed`, une pour la jointure. Elle appelait EN PLUS ces
--   5 fonctions sur chacune des 2 946 lignes du catalogue magasin.
--   Soit ~37 000 appels plpgsql par requête.
--
--     un chunk du catalogue (1 000 lignes) : 593–903 ms  (vs 4,8 ms sur products)
--     les « frères » d'une fiche produit   : 2 928 ms    (vs 2,5 ms sur products)
--
--   L'API /api/products pagine par 1 000 → 3 chunks séquentiels ≈ 2,4 s de SQL
--   pour un seul affichage du catalogue.
--
-- CORRECTIF — supprimer les appels de fonctions du chemin de lecture :
--   1) côté FOURNISSEUR : l'agrégat devient une VUE MATÉRIALISÉE, rafraîchie
--      par le cron du feed (les lignes source='fluxitron' ne bougent qu'une
--      fois par jour) ;
--   2) côté MAGASIN : les 5 clés de jointure deviennent des COLONNES GÉNÉRÉES
--      STORED sur products — calculées à l'écriture, jamais à la lecture.
--
--   La jointure redevient une jointure de hachage ordinaire sur des colonnes
--   texte indexées. AUCUN changement de sémantique : la logique fail-closed
--   (cfg / gfeed / fenêtre de fraîcheur) est reproduite à l'identique, et elle
--   continue d'être évaluée en direct (now()), pas figée au rafraîchissement.
-- ---------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Agrégat fournisseur matérialisé.
--    Corps identique à l'ancienne v_supplier_variant_stock.
-- ---------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.mv_supplier_variant_stock CASCADE;

CREATE MATERIALIZED VIEW public.mv_supplier_variant_stock AS
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

-- Index UNIQUE : indispensable pour REFRESH ... CONCURRENTLY (le catalogue
-- reste lisible pendant le rafraîchissement). Les 5 clés sont le GROUP BY,
-- elles sont donc uniques par construction et toutes NOT NULL (cf. WHERE).
CREATE UNIQUE INDEX mv_supplier_variant_stock_key
  ON public.mv_supplier_variant_stock (brand_k, model_k, storage_k, grade_k, color_k);

-- ---------------------------------------------------------------------
-- 2) Clés de jointure précalculées sur le catalogue magasin.
--    Les 5 fn_* sont IMMUTABLE et purement textuelles (aucune lecture de
--    table) : une colonne générée STORED est donc exacte par construction,
--    et recalculée automatiquement à chaque INSERT/UPDATE.
--
--    ⚠️ SEUL point d'attention : PostgreSQL ne recalcule PAS les colonnes
--    générées quand on redéfinit une fonction. Toute future migration qui
--    modifie une fn_* DOIT forcer le recalcul — voir fn_recompute_product_keys()
--    en fin de fichier.
-- ---------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN brand_k   text GENERATED ALWAYS AS (public.fn_norm_text(brand))               STORED,
  ADD COLUMN model_k   text GENERATED ALWAYS AS (public.fn_canonical_model(model))         STORED,
  ADD COLUMN storage_k text GENERATED ALWAYS AS (public.fn_norm_storage(storage_capacity)) STORED,
  ADD COLUMN grade_k   text GENERATED ALWAYS AS (public.fn_grade_tier(grade))              STORED,
  ADD COLUMN color_k   text GENERATED ALWAYS AS (public.fn_canonical_color(color))         STORED;

CREATE INDEX idx_products_variant_keys
  ON public.products (brand_k, model_k, storage_k, grade_k, color_k)
  WHERE source = 'manual';

-- ---------------------------------------------------------------------
-- 3) v_supplier_variant_stock : conservée pour compatibilité (scripts,
--    diagnostics admin), mais elle lit désormais la vue matérialisée.
--    Mêmes colonnes, mêmes types → CREATE OR REPLACE accepté.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_supplier_variant_stock AS
SELECT brand_k, model_k, storage_k, grade_k, color_k,
       supplier_stock, supplier_last_synced, supplier_rows
FROM public.mv_supplier_variant_stock;

-- ---------------------------------------------------------------------
-- 4) v_catalog_products : mêmes colonnes, même sémantique, sans un seul
--    appel de fonction sur le chemin de lecture.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_catalog_products
WITH (security_invoker = true) AS
WITH cfg AS (
  SELECT COALESCE(bool_or(greying_enabled), false) AS greying_enabled,
         COALESCE(max(freshness_hours), 48)        AS freshness_hours,
         COALESCE(max(min_supplier_rows), 0)       AS min_supplier_rows
  FROM public.supplier_sync_settings
), gfeed AS (
  SELECT max(supplier_last_synced) AS last_sync,
         count(*)::integer         AS rows
  FROM public.mv_supplier_variant_stock
)
SELECT
  p.id, p.brand, p.model, p.storage_capacity, p.color, p.imei, p.warranty,
  p.condition_description, p.grade, p.battery_health, p.price,
  p.compare_at_price, p.stock, p.images, p.category, p.is_active,
  p.created_at, p.updated_at, p.sku, p.handle, p.vendor, p.product_type,
  p.tags, p.category_id, p.source, p.fluxitron_group_id,
  p.is_fluxitron_group_parent, p.cost_price, p.specs, p.price_updated_at,
  (s.supplier_rows IS NOT NULL) AS supplier_match,
  s.supplier_stock,
  s.supplier_last_synced,
  (
        cfg.greying_enabled
    AND p.category = 'telephones'
    AND gfeed.last_sync IS NOT NULL
    AND gfeed.last_sync > (now() - make_interval(hours => cfg.freshness_hours))
    AND gfeed.rows >= cfg.min_supplier_rows
    AND NOT (
          s.supplier_rows IS NOT NULL
      AND s.supplier_last_synced > (now() - make_interval(hours => cfg.freshness_hours))
      AND COALESCE(s.supplier_stock, 0::bigint) > 0
    )
  ) AS greyed_by_supplier,
  (
        gfeed.last_sync IS NOT NULL
    AND gfeed.last_sync > (now() - make_interval(hours => cfg.freshness_hours))
    AND gfeed.rows >= cfg.min_supplier_rows
  ) AS supplier_feed_fresh,
  (
        p.category = 'telephones'
    AND gfeed.last_sync IS NOT NULL
    AND gfeed.last_sync > (now() - make_interval(hours => cfg.freshness_hours))
    AND gfeed.rows >= cfg.min_supplier_rows
    AND NOT (
          s.supplier_rows IS NOT NULL
      AND s.supplier_last_synced > (now() - make_interval(hours => cfg.freshness_hours))
      AND COALESCE(s.supplier_stock, 0::bigint) > 0
    )
  ) AS greyable
FROM public.products p
CROSS JOIN cfg
CROSS JOIN gfeed
LEFT JOIN public.mv_supplier_variant_stock s
  ON  s.brand_k   = p.brand_k
  AND s.model_k   = p.model_k
  AND s.storage_k = p.storage_k
  AND s.grade_k   = p.grade_k
  AND s.color_k   = p.color_k
WHERE p.source = 'manual';

-- ---------------------------------------------------------------------
-- 5) Rafraîchissement, appelé par le cron du feed après écriture du miroir.
--    CONCURRENTLY : le catalogue reste lisible pendant l'opération.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_refresh_supplier_stock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_supplier_variant_stock;
END;
$$;

-- Recalcul forcé des colonnes générées. À appeler UNIQUEMENT après avoir
-- modifié une fn_* : PostgreSQL ne le fait pas tout seul.
CREATE OR REPLACE FUNCTION public.fn_recompute_product_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Écriture neutre : force la ré-évaluation des 5 colonnes GENERATED.
  UPDATE public.products SET brand = brand;
END;
$$;

-- ---------------------------------------------------------------------
-- 6) Droits — un GRANT est additif, il ne restreint PAS. On révoque
--    explicitement : la vue matérialisée porte le stock fournisseur
--    (donnée confidentielle) et ne doit jamais sortir par l'API publique.
--    Même motif que les REVOKE de la migration 022 / 024.
-- ---------------------------------------------------------------------
REVOKE ALL ON public.mv_supplier_variant_stock FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON public.mv_supplier_variant_stock TO service_role;

REVOKE ALL ON FUNCTION public.fn_refresh_supplier_stock()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recompute_product_keys()  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_refresh_supplier_stock() TO service_role;
GRANT  EXECUTE ON FUNCTION public.fn_recompute_product_keys() TO service_role;

COMMIT;

-- ⚠️ HORS TRANSACTION — à lancer une fois la migration validée :
--   ANALYZE public.products;
--   ANALYZE public.mv_supplier_variant_stock;
