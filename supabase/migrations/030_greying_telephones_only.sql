-- =====================================================================
-- TEL & CASH — Migration 030
-- FIX 029 : le grisage fail-closed ne doit s'appliquer qu'aux TÉLÉPHONES.
--
-- Bug 029 : en fail-closed, toute ligne source='manual' SANS miroir était
-- grisée — or les accessoires (et toute catégorie hors téléphones) n'ont
-- jamais de miroir fournisseur (le feed Foxway ne couvre que les mobiles).
-- Résultat : 9/9 accessoires grisés à tort. On restreint greyed_by_supplier
-- ET greyable à category='telephones'. Tout le reste reste vendable.
-- =====================================================================

BEGIN;

CREATE OR REPLACE VIEW public.v_catalog_products
WITH (security_invoker = true) AS
WITH cfg AS (
  SELECT
    COALESCE(bool_or(greying_enabled), false) AS greying_enabled,
    COALESCE(max(freshness_hours), 48)        AS freshness_hours,
    COALESCE(max(min_supplier_rows), 0)       AS min_supplier_rows
  FROM public.supplier_sync_settings
),
gfeed AS (
  SELECT max(supplier_last_synced) AS last_sync, count(*)::int AS rows
  FROM public.v_supplier_variant_stock
)
SELECT
  p.*,
  (s.supplier_rows IS NOT NULL)            AS supplier_match,
  s.supplier_stock                         AS supplier_stock,
  s.supplier_last_synced                   AS supplier_last_synced,
  (
        cfg.greying_enabled
    AND p.category = 'telephones'                 -- +030 : grisage limité aux mobiles
    AND gfeed.last_sync IS NOT NULL
    AND gfeed.last_sync > (now() - make_interval(hours => cfg.freshness_hours))
    AND gfeed.rows >= cfg.min_supplier_rows
    AND NOT (
          s.supplier_rows IS NOT NULL
      AND s.supplier_last_synced > (now() - make_interval(hours => cfg.freshness_hours))
      AND COALESCE(s.supplier_stock, 0) > 0
    )
  )                                        AS greyed_by_supplier,
  (
        gfeed.last_sync IS NOT NULL
    AND gfeed.last_sync > (now() - make_interval(hours => cfg.freshness_hours))
    AND gfeed.rows >= cfg.min_supplier_rows
  )                                        AS supplier_feed_fresh,
  (
        p.category = 'telephones'                 -- +030 : grisable limité aux mobiles
    AND gfeed.last_sync IS NOT NULL
    AND gfeed.last_sync > (now() - make_interval(hours => cfg.freshness_hours))
    AND gfeed.rows >= cfg.min_supplier_rows
    AND NOT (
          s.supplier_rows IS NOT NULL
      AND s.supplier_last_synced > (now() - make_interval(hours => cfg.freshness_hours))
      AND COALESCE(s.supplier_stock, 0) > 0
    )
  )                                        AS greyable
FROM public.products p
CROSS JOIN cfg
CROSS JOIN gfeed
LEFT JOIN public.v_supplier_variant_stock s
  ON  s.brand_k   = public.fn_norm_text(p.brand)
  AND s.model_k   = public.fn_canonical_model(p.model)
  AND s.storage_k = public.fn_norm_storage(p.storage_capacity)
  AND s.grade_k   = public.fn_grade_tier(p.grade)
  AND s.color_k   = public.fn_canonical_color(p.color)
WHERE p.source = 'manual';

COMMIT;
