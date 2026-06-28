-- =====================================================================
-- TEL & CASH — Migration 029
-- Grisage fournisseur : bascule FAIL-OPEN -> FAIL-CLOSED.
--
-- DÉCISION MÉTIER : le magasin s'approvisionne PRINCIPALEMENT chez Foxway.
-- Donc une variante n'est vendable QUE si Foxway l'a en stock frais (miroir,
-- stock > 0). Toute variante sans stock fournisseur dispo (pas de miroir, OU
-- miroir à stock 0) est GRISÉE. Elle redevient vendable automatiquement dès
-- qu'un miroir frais avec stock > 0 réapparaît (vue calculée à la lecture).
--
-- Avant (022) : grisé = miroir frais ET stock 0 (les sans-miroir restaient
--   vendables). Désormais : grisé = PAS (miroir frais ET stock > 0).
--
-- GARDE-FOU GLOBAL (anti-mass-grey) : on ne grise QUE si le feed est
--   globalement sain — dernière sync fraîche ET nb de lignes miroir >= seuil.
--   Si la sync est périmée/vide/tronquée (Foxway down, cron raté), on retombe
--   en fail-open TOTAL (rien n'est grisé) pour ne jamais cacher la boutique
--   sur une panne de flux.
--
-- NON DESTRUCTIVE : CREATE OR REPLACE (privilèges 022 préservés). Le grisage
--   reste piloté par supplier_sync_settings.greying_enabled (OFF par défaut).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Seuil plancher de lignes miroir (garde-fou anti-sync-tronquée).
--    0 par défaut historique impossible (NOT NULL DEFAULT) -> 500 : une
--    sync saine fait ~1500 lignes ; 500 ne sert qu'à bloquer un effondrement.
-- ---------------------------------------------------------------------
ALTER TABLE public.supplier_sync_settings
  ADD COLUMN IF NOT EXISTS min_supplier_rows int NOT NULL DEFAULT 500
  CHECK (min_supplier_rows >= 0);

-- ---------------------------------------------------------------------
-- 2) Vue overlay catalogue, version fail-closed + garde-fou.
--    Colonnes ajoutées EN FIN (CREATE OR REPLACE compatible) :
--      supplier_feed_fresh = le garde-fou global est satisfait
--      greyable            = grisable hors interrupteur (pour le diagnostic)
-- ---------------------------------------------------------------------
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
    -- garde-fou global : feed sain
    AND gfeed.last_sync IS NOT NULL
    AND gfeed.last_sync > (now() - make_interval(hours => cfg.freshness_hours))
    AND gfeed.rows >= cfg.min_supplier_rows
    -- vendable SEULEMENT si miroir frais avec stock > 0 -> sinon grisé
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
        gfeed.last_sync IS NOT NULL
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

-- ---------------------------------------------------------------------
-- 3) Diagnostic santé : ajoute le seuil, la fraîcheur globale, la dernière
--    sync et SURTOUT « would_grey_if_enabled » = combien seraient grisées
--    si on activait l'interrupteur (preview avant bascule).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.supplier_sync_health()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cfg AS (
    SELECT COALESCE(bool_or(greying_enabled), false) AS greying_enabled,
           COALESCE(max(freshness_hours), 48)        AS freshness_hours,
           COALESCE(max(min_supplier_rows), 0)       AS min_supplier_rows
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
    SELECT greyed_by_supplier, supplier_match, greyable
    FROM public.v_catalog_products
    WHERE is_active AND category = 'telephones'
  )
  SELECT jsonb_build_object(
    'greying_enabled',      (SELECT greying_enabled FROM cfg),
    'freshness_hours',      (SELECT freshness_hours FROM cfg),
    'min_supplier_rows',    (SELECT min_supplier_rows FROM cfg),
    'manual_active',        (SELECT count(*) FROM cat),
    'manual_matched',       (SELECT count(*) FROM cat WHERE supplier_match),
    'manual_unmatched',     (SELECT count(*) FROM cat WHERE NOT supplier_match),
    'greyed_now',           (SELECT count(*) FROM cat WHERE greyed_by_supplier),
    'would_grey_if_enabled',(SELECT count(*) FROM cat WHERE greyable),
    'supplier_keys',        (SELECT count(*) FROM sup),
    'supplier_last_sync',   (SELECT max(supplier_last_synced) FROM sup),
    'supplier_feed_fresh',  (
       SELECT (max(supplier_last_synced) IS NOT NULL
         AND max(supplier_last_synced) > now() - make_interval(hours => (SELECT freshness_hours FROM cfg))
         AND count(*) >= (SELECT min_supplier_rows FROM cfg))
       FROM sup),
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
    'unmapped_colors',      (SELECT COALESCE(jsonb_agg(DISTINCT m.color ORDER BY m.color), '[]'::jsonb)
                             FROM manual m
                             WHERE m.color_k IS NOT NULL
                               AND NOT EXISTS (SELECT 1 FROM sup s WHERE s.color_k = m.color_k))
  );
$$;

COMMIT;
