-- ========================================
-- TEL & CASH — Migration 011
-- Bon de commande fournisseur :
--   1. nouveau statut interne `supplier_ordered`
--   2. table `supplier_orders` (historique des bons générés)
-- A executer dans Supabase SQL Editor
-- ========================================

-- ----------------------------------------
-- 1. Etendre orders.status CHECK constraint
-- ----------------------------------------
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',
    'awaiting_payment',
    'paid',
    'supplier_ordered',  -- transmis au fournisseur (interne, vu "En préparation" côté client)
    'failed',
    'shipped',
    'delivered',
    'refunded',
    'disputed',
    'cancelled'
  ));

-- ----------------------------------------
-- 2. Table supplier_orders (bons de commande)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number   INTEGER NOT NULL,                 -- numéro lisible séquentiel (n°1, n°2…)
  lines       JSONB NOT NULL DEFAULT '[]',      -- [{brand, model, storage, color, grade, qty}]
  order_ids   UUID[] NOT NULL DEFAULT '{}',     -- commandes incluses dans ce bon
  total_units INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_orders_po_number
  ON public.supplier_orders(po_number);

-- RLS : table d'admin uniquement, manipulée via le service role (bypass RLS).
ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;

-- Verification
SELECT 'migration 011 OK' AS status;
