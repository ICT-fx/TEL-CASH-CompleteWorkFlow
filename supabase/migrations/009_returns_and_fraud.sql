-- ========================================
-- TEL & CASH — Migration 009
-- Anti-fraud system: IMEI tracking, shipping photos,
-- return requests workflow, fraud blocklist.
-- ========================================

-- ----------------------------------------
-- 1. ORDER_ITEMS — IMEI shipped (per-item)
-- ----------------------------------------
-- The IMEI actually expedited (locked at shipping time).
-- Used at return inspection to detect swap-fraud.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS imei_shipped TEXT;

-- ----------------------------------------
-- 2. ORDERS — shipping evidence & refund tracking
-- ----------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_photos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS shipping_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2);

-- ----------------------------------------
-- 3. RETURN_REQUESTS — client-initiated returns
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rma_number TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL CHECK (reason IN (
    'retractation',     -- 14-day legal retraction
    'defective',        -- defective product
    'not_as_described', -- not as described
    'wrong_item',       -- wrong item received
    'other'
  )),
  description TEXT,
  photos TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested',     -- client submitted, awaiting admin review
    'approved',      -- admin approved, return label sent
    'label_sent',    -- return label generated & sent to client
    'in_transit',    -- client shipped the return
    'received',      -- warehouse received the package
    'inspecting',    -- under inspection
    'refunded',      -- refund issued
    'rejected'       -- refund denied
  )),
  rejection_reason TEXT,
  admin_notes TEXT,
  return_tracking_number TEXT,
  inspection_imei_matches BOOLEAN,
  inspection_condition_ok BOOLEAN,
  inspection_factory_reset BOOLEAN,
  refund_amount NUMERIC(10,2),
  stripe_refund_id TEXT,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON public.return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_user_id ON public.return_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON public.return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_rma ON public.return_requests(rma_number);

-- updated_at trigger
CREATE TRIGGER trg_return_requests_updated_at
  BEFORE UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------
-- 4. FRAUD_BLOCKLIST — recidivist protection
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.fraud_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('email', 'ip', 'imei', 'phone', 'user_id')),
  value TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(type, value)
);

CREATE INDEX IF NOT EXISTS idx_fraud_blocklist_lookup ON public.fraud_blocklist(type, value);

-- ----------------------------------------
-- 5. RLS — return_requests
-- ----------------------------------------
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own returns"
  ON public.return_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users create own returns"
  ON public.return_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage all returns"
  ON public.return_requests FOR ALL
  USING (public.is_admin());

-- ----------------------------------------
-- 6. RLS — fraud_blocklist (admin only)
-- ----------------------------------------
ALTER TABLE public.fraud_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage blocklist"
  ON public.fraud_blocklist FOR ALL
  USING (public.is_admin());

-- ----------------------------------------
-- 7. RMA number generator (e.g. RMA-2026-0001)
-- ----------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.rma_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_rma_number()
RETURNS TEXT AS $$
  SELECT 'RMA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.rma_seq')::text, 4, '0');
$$ LANGUAGE SQL VOLATILE;
