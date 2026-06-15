-- Migration 015 : regroupement des variantes Fluxitron.
--
-- Contexte : notre boutique est mono-variante (1 produit = 1 ligne = 1 variante).
-- Foxway/Fluxitron pousse des produits MULTI-variantes (un « iPhone 13 128 Go »
-- avec N variantes couleur × grade). POST /api/v1/products éclate ce push en N
-- lignes indépendantes, puis renvoie ces lignes IMBRIQUÉES comme variants[] sous
-- l'id de la 1ʳᵉ ligne (le « parent »). Fluxitron enregistre donc des paires
-- (platformProductId = parent, platformVariantId = ligne sœur). Lors d'un GET, le
-- parent ne renvoyait que SA propre variante → 97 % des variantes « introuvables »
-- (skippedNoVariant) → la synchro des prix n'aboutissait jamais.
--
-- Correctif : on matérialise le groupe d'origine via `fluxitron_group_id`
-- (= l'id du parent = ligne la plus ancienne partageant brand/model/storage).
-- Les lectures (GET /products et GET /products/:id) renvoient alors toutes les
-- variantes du groupe → les mappings déjà enregistrés par Fluxitron redeviennent
-- valides et la synchro s'auto-répare au prochain run.

-- 1) Colonne de groupe.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS fluxitron_group_id uuid;

-- 2) Toute nouvelle ligne est son propre groupe par défaut (parent = elle-même).
--    POST /api/v1/products réécrit ensuite les variantes sœurs vers l'id du parent.
CREATE OR REPLACE FUNCTION public.set_default_fluxitron_group_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.fluxitron_group_id IS NULL THEN
    NEW.fluxitron_group_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_default_fluxitron_group ON public.products;
CREATE TRIGGER trg_products_default_fluxitron_group
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_fluxitron_group_id();

-- 3) Backfill des lignes Fluxitron existantes : parent = ligne la plus ancienne
--    partageant (brand, model, storage_capacity). PARTITION BY traite les NULL
--    comme égaux (comme GROUP BY), donc les variantes à storage NULL d'un même
--    modèle se regroupent correctement. brand/model ne sont jamais NULL ici.
WITH g AS (
  SELECT id,
         first_value(id) OVER (
           PARTITION BY brand, model, storage_capacity
           ORDER BY created_at, id
         ) AS parent_id
  FROM public.products
  WHERE source = 'fluxitron'
)
UPDATE public.products p
SET fluxitron_group_id = g.parent_id
FROM g
WHERE p.id = g.id;

-- 4) Tout le reste (produits manuels, ou lignes restées NULL) est son propre groupe.
UPDATE public.products
SET fluxitron_group_id = id
WHERE fluxitron_group_id IS NULL;

-- 5) Colonne générée : la ligne est-elle le parent de son groupe ? Sert à paginer
--    la liste sur les seuls parents (1 produit logique = 1 entrée).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_fluxitron_group_parent boolean
  GENERATED ALWAYS AS (id = fluxitron_group_id) STORED;

-- 6) Index pour les lectures groupées et la pagination des parents.
CREATE INDEX IF NOT EXISTS idx_products_fluxitron_group
  ON public.products(fluxitron_group_id);
CREATE INDEX IF NOT EXISTS idx_products_fluxitron_group_parent
  ON public.products(is_fluxitron_group_parent, created_at);
