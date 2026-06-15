-- Marges : coût fournisseur séparé du prix de vente, règles de marge,
-- réglages de cohérence, et coût figé à la vente.

-- 1. Coût fournisseur. Au départ, price = prix fournisseur → on l'y recopie.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);
UPDATE public.products SET cost_price = price WHERE cost_price IS NULL;

-- 2. Coût figé à la vente (NULL sur l'historique → exclu des stats de marge).
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS cost_at_purchase NUMERIC(10,2);

-- 3. Règles de marge (cascade : global < brand < model < product).
CREATE TABLE IF NOT EXISTS public.margin_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_level TEXT NOT NULL CHECK (scope_level IN ('global','brand','model','product')),
  brand TEXT,
  model TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  grade TEXT CHECK (grade IN ('A','B','C')),
  margin_type TEXT NOT NULL CHECK (margin_type IN ('percent','fixed','combined')),
  margin_percent NUMERIC,
  margin_fixed NUMERIC,
  rounding TEXT NOT NULL DEFAULT 'cent'
    CHECK (rounding IN ('cent','decicent','euro','five_euro','ten_euro','ends_99')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unicité d'une règle par (niveau, cible, grade). COALESCE pour gérer les NULL.
CREATE UNIQUE INDEX IF NOT EXISTS margin_rules_unique_scope
  ON public.margin_rules (
    scope_level,
    COALESCE(brand,''),
    COALESCE(model,''),
    COALESCE(product_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(grade,'')
  );

-- 4. Réglages globaux (singleton).
CREATE TABLE IF NOT EXISTS public.margin_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  coherence_enabled BOOLEAN NOT NULL DEFAULT false,
  coherence_min_gap_percent NUMERIC NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO public.margin_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 5. RLS : tables d'admin uniquement (service-role bypasse la RLS).
ALTER TABLE public.margin_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.margin_settings ENABLE ROW LEVEL SECURITY;
-- Pas de policy publique : seul le service-role (API admin) y accède.
