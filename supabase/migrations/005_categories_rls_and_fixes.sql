-- ========================================
-- TEL & CASH — Migration 005
-- RLS pour categories & disputes
-- Corrections de compatibilité Fluxitron
-- ========================================

-- ----------------------------------------
-- 1. RLS sur la table categories
--    (créée dans 004 sans politiques)
-- ----------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Lecture publique : tout le monde peut voir les catégories
CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  USING (true);

-- Seuls les admins peuvent créer/modifier/supprimer
CREATE POLICY "Admins can insert categories"
  ON public.categories FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update categories"
  ON public.categories FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete categories"
  ON public.categories FOR DELETE
  USING (public.is_admin());

-- ----------------------------------------
-- 2. RLS sur la table disputes
--    (créée dans 003 sans politiques)
-- ----------------------------------------
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Seuls les admins accèdent aux litiges
CREATE POLICY "Admins manage disputes"
  ON public.disputes FOR ALL
  USING (public.is_admin());

-- ----------------------------------------
-- 3. S'assurer que les 2 catégories par défaut
--    existent (idempotent, safe à re-lancer)
-- ----------------------------------------
INSERT INTO public.categories (id, name)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Téléphones'),
  ('a0000000-0000-0000-0000-000000000002', 'Accessoires')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------
-- 4. Migrer category_id sur les produits existants
--    qui ne l'auraient pas encore (safe à re-lancer)
-- ----------------------------------------
UPDATE public.products
SET category_id = 'a0000000-0000-0000-0000-000000000001'
WHERE category = 'telephones' AND category_id IS NULL;

UPDATE public.products
SET category_id = 'a0000000-0000-0000-0000-000000000002'
WHERE category = 'accessoires' AND category_id IS NULL;

-- ----------------------------------------
-- 5. Générer les SKU manquants (produits sans sku)
-- ----------------------------------------
UPDATE public.products
SET sku = UPPER(
  REPLACE(REPLACE(
    COALESCE(brand, '') || '-' || COALESCE(model, '') || '-' || COALESCE(storage_capacity, '') || '-' || COALESCE(grade, 'STD'),
    ' ', '-'
  ), '--', '-')
)
WHERE sku IS NULL;

-- ----------------------------------------
-- 6. Générer les handles manquants
-- ----------------------------------------
UPDATE public.products
SET handle = LOWER(
  REPLACE(REPLACE(REPLACE(
    COALESCE(brand, '') || '-' || COALESCE(model, '') || '-' || COALESCE(storage_capacity, '') || '-' || COALESCE(grade, ''),
    ' ', '-'
  ), '--', '-'), '''', '')
)
WHERE handle IS NULL;

-- ----------------------------------------
-- 7. Générer les order_number manquants
-- ----------------------------------------
UPDATE public.orders
SET order_number = 'TC-' || UPPER(LEFT(id::text, 8))
WHERE order_number IS NULL;

-- ----------------------------------------
-- 8. Ajouter fulfillment_status par défaut
--    si la colonne existe sans valeur
-- ----------------------------------------
UPDATE public.orders
SET fulfillment_status = 'unfulfilled'
WHERE fulfillment_status IS NULL;
