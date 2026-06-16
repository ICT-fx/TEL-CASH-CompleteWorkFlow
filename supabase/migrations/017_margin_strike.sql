-- Prix barré (compare_at_price) piloté par les règles de marge.
-- Chaque règle peut, en option, définir comment calculer le prix barré DEPUIS
-- le prix de vente margé : « X % en moins » (barré = prix / (1 − X/100)) ou
-- « Y € en moins » (barré = prix + Y), avec son propre arrondi.

ALTER TABLE public.margin_rules
  ADD COLUMN IF NOT EXISTS strike_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS strike_type TEXT CHECK (strike_type IN ('percent','fixed')),
  ADD COLUMN IF NOT EXISTS strike_value NUMERIC,
  ADD COLUMN IF NOT EXISTS strike_rounding TEXT
    CHECK (strike_rounding IN ('cent','decicent','euro','five_euro','ten_euro','ends_99'));
