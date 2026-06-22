-- =====================================================================
-- TEL & CASH -- Migration 019
-- Catalogue 100 % magasin : consolidation + prix manuels + abandon Fluxitron.
-- Spec : docs/superpowers/specs/2026-06-22-catalogue-magasin-prix-manuels-design.md (§5)
--
-- IDEMPOTENTE & NON DESTRUCTIVE :
--   * Aucune ligne supprimée (FK cart_items ON DELETE CASCADE,
--     order_items ON DELETE SET NULL) → on désactive (is_active=false).
--   * Rejouable : chaque passe re-filtre sur is_active=true et recalcule la
--     normalisation (displayGrade('A')='A', normalize('256 Go')='256 Go').
--
-- AVERTISSEMENT : met stock=0 sur toutes les lignes téléphones consolidées
--   → site inachetable jusqu'à saisie du stock dans /admin/prix (décision D7).
--
-- REJEU : idempotente AVANT toute saisie de prix/stock dans /admin/prix. Si elle
--   est rejouée APRÈS une saisie admin, l'étape 5 réécrit le prix MIN d'origine
--   (écrase les prix manuels) et l'étape 4b remet stock=0. À n'exécuter qu'UNE
--   FOIS (le suivi de migrations Supabase l'empêche normalement de se rejouer).
--
-- Périmètre : category='telephones' uniquement (8 accessoires NON touchés).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0) Helpers SQL éphémères répliquant la logique TypeScript.
-- ---------------------------------------------------------------------

-- Réplique normalizeStorage() (src/lib/productVariants.ts:17) :
--   '256 GO' / '256' / '256 GB' -> '256 Go'
--   '1024' / '1 TO' / '1 to'    -> '1 To'
--   NULL / '' / '—' / non parsable -> NULL  (S25 Ultra reste NULL)
CREATE OR REPLACE FUNCTION public.fn_normalize_storage_telephones(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s     text;
  m     text[];
  num   bigint;
  unit  text;
  gb    bigint;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  s := btrim(raw);
  IF s = '' OR s = '—' THEN RETURN NULL; END IF;

  -- (\d{1,4})\s*(to|tb|go|gb)? insensible à la casse — 1er match
  m := regexp_match(s, '(\d{1,4})\s*(to|tb|go|gb)?', 'i');
  IF m IS NULL THEN RETURN NULL; END IF;

  num  := (m[1])::bigint;
  unit := lower(coalesce(m[2], ''));
  gb   := num;
  IF unit IN ('to', 'tb') THEN
    gb := num * 1024;                       -- To/TB -> Go pour le calcul
  END IF;

  IF gb <= 0 THEN RETURN NULL; END IF;
  IF gb >= 1024 AND gb % 1024 = 0 THEN
    RETURN (gb / 1024)::text || ' To';
  END IF;
  RETURN gb::text || ' Go';
END;
$$;

-- Réplique displayGrade() (src/lib/products.ts:112) repliée en A/B/C :
--   A+, A           -> A
--   B+, B           -> B
--   C+, C, D, E     -> C
--   non reconnu / NULL -> NULL
CREATE OR REPLACE FUNCTION public.fn_display_grade_telephones(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  g       text;
  letter  text;
  m       text[];
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  g := upper(btrim(regexp_replace(raw, '\s+', ' ', 'g')));
  IF g = '' THEN RETURN NULL; END IF;

  -- Lettres canoniques A/B/C avec « + » éventuel.
  m := regexp_match(g, '\m(?:GRADE\s*)?([ABC])\s*(\+)?');
  IF m IS NOT NULL THEN
    letter := m[1] || CASE WHEN m[2] IS NOT NULL THEN '+' ELSE '' END;
    IF letter IN ('A+','A') THEN RETURN 'A'; END IF;
    IF letter IN ('B+','B') THEN RETURN 'B'; END IF;
    IF letter IN ('C+','C') THEN RETURN 'C'; END IF;
  END IF;

  -- Grades Foxway D / E -> repliés en C. NB : chemin de robustesse uniquement —
  -- l'étape 2 a déjà désactivé (is_active=false) les lignes D/E avant la
  -- consolidation, donc ce repli ne sert qu'au rejeu / à une réutilisation future.
  m := regexp_match(g, '\m(?:GRADE\s*)?([DE])\M');
  IF m IS NOT NULL THEN
    RETURN 'C';
  END IF;

  -- Libellés FR legacy.
  IF g LIKE 'PARFAIT%' OR g LIKE 'EXCELLENT%' THEN RETURN 'A'; END IF;     -- ->A
  IF g LIKE 'TRÈS BON%' OR g LIKE 'TRES BON%' THEN RETURN 'B'; END IF;     -- B+ -> B
  IF g LIKE 'BON %' OR g = 'BON' THEN RETURN 'B'; END IF;                  -- ->B
  IF position('CORRECT' IN g) > 0 THEN RETURN 'C'; END IF;                 -- ->C

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------
-- 1) Normaliser storage_capacity (telephones). NULL conservés.
--    Idempotent : '256 Go' -> '256 Go'.
-- ---------------------------------------------------------------------
UPDATE public.products p
SET storage_capacity = public.fn_normalize_storage_telephones(p.storage_capacity)
WHERE p.category = 'telephones'
  AND p.storage_capacity IS NOT NULL
  AND public.fn_normalize_storage_telephones(p.storage_capacity) IS DISTINCT FROM p.storage_capacity;

-- ---------------------------------------------------------------------
-- 2) Exclure D / E / grade NULL (telephones) : is_active=false.
--    Idempotent : ne réactive jamais.
-- ---------------------------------------------------------------------
UPDATE public.products p
SET is_active = false
WHERE p.category = 'telephones'
  AND p.is_active = true
  AND (p.grade IS NULL OR public.fn_display_grade_telephones(p.grade) IS NULL OR p.grade IN ('D','E'));

-- ---------------------------------------------------------------------
-- 3) Seed des prix de départ AVANT toute mutation de price/grade.
--    Prix par (model, storage normalisé, grade affiché) = MIN(price) des
--    lignes ACTIVES restantes (le « à partir de »). Capturé en table TEMP.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _seed_prices ON COMMIT DROP AS
SELECT
  p.model                                              AS model,
  p.storage_capacity                                   AS storage_capacity,  -- déjà normalisé (NULL ok)
  public.fn_display_grade_telephones(p.grade)          AS dgrade,
  MIN(p.price)                                         AS seed_price
FROM public.products p
WHERE p.category = 'telephones'
  AND p.is_active = true
  AND public.fn_display_grade_telephones(p.grade) IS NOT NULL
GROUP BY p.model, p.storage_capacity, public.fn_display_grade_telephones(p.grade);

-- ---------------------------------------------------------------------
-- 4) Consolidation par groupe G = (model, storage normalisé, displayGrade, color)
--    sur les lignes ACTIVES restantes :
--      - canonique = plus petit id (ORDER BY id) ;
--      - canonique : grade -> A/B/C, images -> union dédupliquée de G,
--        source='manual', stock=0 ;
--      - autres lignes de G : is_active=false (jamais DELETE).
--    NULL (storage ou color) groupés ensemble via la PARTITION (NULL = NULL).
-- ---------------------------------------------------------------------

-- 4a) Désigner la canonique de chaque groupe + collecter l'union d'images.
CREATE TEMP TABLE _consolidation ON COMMIT DROP AS
WITH active_tel AS (
  SELECT
    p.id,
    p.model,
    p.storage_capacity,
    p.color,
    public.fn_display_grade_telephones(p.grade) AS dgrade,
    p.images
  FROM public.products p
  WHERE p.category = 'telephones'
    AND p.is_active = true
    AND public.fn_display_grade_telephones(p.grade) IS NOT NULL
),
ranked AS (
  SELECT
    a.*,
    first_value(a.id) OVER (
      PARTITION BY a.model, a.storage_capacity, a.dgrade, a.color
      ORDER BY a.id
    ) AS canonical_id
  FROM active_tel a
),
-- union dédupliquée des images de tout le groupe (ordre stable)
group_images AS (
  SELECT
    r.canonical_id,
    array_agg(img ORDER BY img) AS merged_images
  FROM (
    SELECT DISTINCT r.canonical_id, img
    FROM ranked r
    LEFT JOIN LATERAL unnest(coalesce(r.images, ARRAY[]::text[])) AS img ON true
    WHERE img IS NOT NULL
  ) r
  GROUP BY r.canonical_id
)
SELECT
  r.id,
  r.canonical_id,
  (r.id = r.canonical_id)                          AS is_canonical,
  r.dgrade,
  gi.merged_images
FROM ranked r
LEFT JOIN group_images gi ON gi.canonical_id = r.canonical_id;

-- 4b) Mettre à jour les lignes CANONIQUES.
UPDATE public.products p
SET grade   = c.dgrade,
    images  = c.merged_images,
    source  = 'manual',
    stock   = 0
FROM _consolidation c
WHERE p.id = c.id
  AND c.is_canonical = true;

-- 4c) Désactiver les AUTRES lignes du groupe (jamais DELETE).
UPDATE public.products p
SET is_active = false
FROM _consolidation c
WHERE p.id = c.id
  AND c.is_canonical = false;

-- ---------------------------------------------------------------------
-- 5) Seed du prix sur TOUTES les lignes couleur du groupe (dénormalisation).
--    Écrit le MIN pré-migration sur chaque canonique active du
--    (model, storage normalisé, grade A/B/C). compare_at_price conservé.
-- ---------------------------------------------------------------------
UPDATE public.products p
SET price = s.seed_price
FROM _seed_prices s
WHERE p.category = 'telephones'
  AND p.is_active = true
  AND p.grade IN ('A','B','C')
  AND p.model IS NOT DISTINCT FROM s.model
  AND p.storage_capacity IS NOT DISTINCT FROM s.storage_capacity
  AND p.grade IS NOT DISTINCT FROM s.dgrade
  AND p.price IS DISTINCT FROM s.seed_price;

-- ---------------------------------------------------------------------
-- 6) Convertir toutes les lignes restantes source='fluxitron' -> 'manual'.
-- ---------------------------------------------------------------------
UPDATE public.products
SET source = 'manual'
WHERE source = 'fluxitron';

-- ---------------------------------------------------------------------
-- 7) Nettoyage des helpers éphémères.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_normalize_storage_telephones(text);
DROP FUNCTION IF EXISTS public.fn_display_grade_telephones(text);

COMMIT;
