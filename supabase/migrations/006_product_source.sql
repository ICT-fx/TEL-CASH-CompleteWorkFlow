-- =====================================================================
-- TEL & CASH -- Migration 006
-- Colonne source pour distinguer les catalogues Boutique / Fluxitron
-- A executer dans Supabase SQL Editor
-- =====================================================================

-- Ajouter la colonne source sur products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'fluxitron'));

CREATE INDEX IF NOT EXISTS idx_products_source ON public.products(source);

-- Tous les produits existants sont des produits boutique manuels
UPDATE public.products SET source = 'manual' WHERE source IS NULL OR source = 'manual';

-- Verification
SELECT source, category, COUNT(*) FROM public.products GROUP BY source, category ORDER BY source, category;
