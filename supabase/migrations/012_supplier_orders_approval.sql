-- ========================================
-- TEL & CASH — Migration 012
-- Étape d'approbation admin sur les bons de commande fournisseur.
--   draft     : bon généré, en attente d'approbation (commandes encore "paid")
--   confirmed : bon approuvé → commandes basculées en "supplier_ordered"
-- A executer dans Supabase SQL Editor
-- ========================================

ALTER TABLE public.supplier_orders
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed')),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
