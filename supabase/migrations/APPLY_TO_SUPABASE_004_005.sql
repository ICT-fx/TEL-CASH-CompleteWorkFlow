-- =====================================================================
-- TEL & CASH -- Migrations 003 + 004 + 005 combinees
-- A executer dans Supabase SQL Editor
-- https://supabase.com/dashboard/project/klungktcrjlwxqfbbbec/sql/new
-- =====================================================================

-- -----------------------------------------------------------------------
-- MIGRATION 003 : Statuts orders etendus + table disputes
-- -----------------------------------------------------------------------

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',
    'awaiting_payment',
    'paid',
    'failed',
    'shipped',
    'delivered',
    'refunded',
    'disputed',
    'cancelled'
  ));

CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  reason TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON public.disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_stripe_dispute_id ON public.disputes(stripe_dispute_id);

-- -----------------------------------------------------------------------
-- MIGRATION 004 : Fluxitron Custom Store Connector Schema
-- -----------------------------------------------------------------------

-- 1. Nouvelles colonnes sur products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_handle ON public.products(handle);

-- 2. Table categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

INSERT INTO public.categories (id, name)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Telephones'),
  ('a0000000-0000-0000-0000-000000000002', 'Accessoires')
ON CONFLICT (id) DO NOTHING;

-- 3. Lier products aux categories
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

UPDATE public.products
SET category_id = 'a0000000-0000-0000-0000-000000000001'
WHERE category = 'telephones' AND category_id IS NULL;

UPDATE public.products
SET category_id = 'a0000000-0000-0000-0000-000000000002'
WHERE category = 'accessoires' AND category_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- 4. Nouvelles colonnes sur orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT
  DEFAULT 'unfulfilled'
  CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled', 'cancelled'));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON public.orders(fulfillment_status);

UPDATE public.orders
SET order_number = 'TC-' || UPPER(LEFT(id::text, 8))
WHERE order_number IS NULL;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'TC-' || UPPER(LEFT(NEW.id::text, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_order_number ON public.orders;
CREATE TRIGGER trg_orders_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- 5. Generer SKU automatiquement
UPDATE public.products
SET sku = UPPER(
  REPLACE(REPLACE(
    COALESCE(brand, '') || '-' || COALESCE(model, '') || '-' || COALESCE(storage_capacity, '') || '-' || COALESCE(grade, 'STD'),
    ' ', '-'
  ), '--', '-')
)
WHERE sku IS NULL;

-- 6. Generer handle automatiquement
UPDATE public.products
SET handle = LOWER(
  REPLACE(REPLACE(
    COALESCE(brand, '') || '-' || COALESCE(model, '') || '-' || COALESCE(storage_capacity, '') || '-' || COALESCE(grade, ''),
    ' ', '-'
  ), '--', '-')
)
WHERE handle IS NULL;

-- -----------------------------------------------------------------------
-- MIGRATION 005 : RLS pour categories & disputes + corrections
-- -----------------------------------------------------------------------

-- RLS categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON public.categories FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update categories"
  ON public.categories FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete categories"
  ON public.categories FOR DELETE
  USING (public.is_admin());

-- RLS disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage disputes"
  ON public.disputes FOR ALL
  USING (public.is_admin());

-- Fulfillment status par defaut
UPDATE public.orders
SET fulfillment_status = 'unfulfilled'
WHERE fulfillment_status IS NULL;

-- -----------------------------------------------------------------------
-- VERIFICATION FINALE
-- -----------------------------------------------------------------------
SELECT 'categories table' AS check_name, COUNT(*) AS rows FROM public.categories
UNION ALL
SELECT 'disputes table', COUNT(*) FROM public.disputes
UNION ALL
SELECT 'products with sku', COUNT(*) FROM public.products WHERE sku IS NOT NULL
UNION ALL
SELECT 'products with category_id', COUNT(*) FROM public.products WHERE category_id IS NOT NULL
UNION ALL
SELECT 'orders with order_number', COUNT(*) FROM public.orders WHERE order_number IS NOT NULL
UNION ALL
SELECT 'orders with fulfillment_status', COUNT(*) FROM public.orders WHERE fulfillment_status IS NOT NULL;
