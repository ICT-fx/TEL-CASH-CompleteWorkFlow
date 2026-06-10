-- Migration 013 : snapshot produit dans order_items + suppression libre des produits
-- Rend les commandes autonomes (nom/sku figés à l'achat) pour qu'un produit
-- puisse être supprimé sans casser l'historique des commandes.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS product_sku  TEXT;

-- Backfill : figer le nom/sku depuis le produit encore lié
UPDATE public.order_items oi
SET product_name = NULLIF(trim(concat_ws(' ', p.brand, p.model, p.storage_capacity)), ''),
    product_sku  = p.sku
FROM public.products p
WHERE oi.product_id = p.id
  AND oi.product_name IS NULL;

-- product_id devient optionnel + FK passe en ON DELETE SET NULL :
-- supprimer un produit met product_id à NULL en conservant le snapshot.
ALTER TABLE public.order_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
