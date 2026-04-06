-- ========================================
-- TEL & CASH — Migration 004
-- Fluxitron Custom Store Connector Schema
-- ========================================

-- ----------------------------------------
-- 1. Products: Add SKU, handle, vendor, product_type, tags
-- ----------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_handle ON public.products(handle);

-- ----------------------------------------
-- 2. Categories table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

-- Insert default categories matching existing CHECK constraint values
INSERT INTO public.categories (id, name)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Téléphones'),
  ('a0000000-0000-0000-0000-000000000002', 'Accessoires')
ON CONFLICT (id) DO NOTHING;

-- Add category_id FK to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Migrate existing category TEXT values to category_id
UPDATE public.products
SET category_id = 'a0000000-0000-0000-0000-000000000001'
WHERE category = 'telephones' AND category_id IS NULL;

UPDATE public.products
SET category_id = 'a0000000-0000-0000-0000-000000000002'
WHERE category = 'accessoires' AND category_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- ----------------------------------------
-- 3. Orders: Add fulfillment_status, order_number
-- ----------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT
  DEFAULT 'unfulfilled'
  CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled', 'cancelled'));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON public.orders(fulfillment_status);

-- Auto-generate order_number for existing orders without one
-- Format: TC-<first 8 chars of UUID>
UPDATE public.orders
SET order_number = 'TC-' || UPPER(LEFT(id::text, 8))
WHERE order_number IS NULL;

-- Trigger to auto-generate order_number on new orders
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

-- Auto-generate SKU for products without one
-- Format: BRAND-MODEL-STORAGE-GRADE (uppercase, spaces to dashes)
UPDATE public.products
SET sku = UPPER(
  REPLACE(REPLACE(
    COALESCE(brand, '') || '-' || COALESCE(model, '') || '-' || COALESCE(storage_capacity, '') || '-' || COALESCE(grade, 'STD'),
    ' ', '-'
  ), '--', '-')
)
WHERE sku IS NULL;

-- Auto-generate handle for products without one
UPDATE public.products
SET handle = LOWER(
  REPLACE(REPLACE(REPLACE(
    COALESCE(brand, '') || '-' || COALESCE(model, '') || '-' || COALESCE(storage_capacity, '') || '-' || COALESCE(grade, ''),
    ' ', '-'
  ), '--', '-'), '''', '')
)
WHERE handle IS NULL;
