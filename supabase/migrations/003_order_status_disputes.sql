-- ========================================
-- TEL & CASH — Migration 003
-- Extend order statuses + add disputes table
-- ========================================

-- ----------------------------------------
-- 1. Extend orders.status CHECK constraint
-- ----------------------------------------
-- Drop the old constraint and recreate it with new values
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',
    'awaiting_payment',  -- paiement différé en attente
    'paid',
    'failed',            -- paiement échoué
    'shipped',
    'delivered',
    'refunded',          -- remboursé
    'disputed',          -- litige ouvert
    'cancelled'
  ));

-- ----------------------------------------
-- 2. Create disputes table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  reason TEXT,               -- e.g. 'fraudulent', 'product_not_received'
  status TEXT NOT NULL,      -- e.g. 'warning_needs_response', 'needs_response'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON public.disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_stripe_dispute_id ON public.disputes(stripe_dispute_id);
