-- =====================================================================
-- TEL & CASH -- Migration 025
-- Invariant DB : une ligne source='fluxitron' (miroir de stock fournisseur)
-- n'est JAMAIS active/vendable. Garantit que le ré-import ne fait jamais
-- apparaître de produit Fluxitron sur la boutique — même si un déploiement
-- tourne encore l'ancien code (sans filtre source='manual').
--
-- Le miroir reste exploité par v_supplier_variant_stock (qui IGNORE is_active),
-- donc le signal de stock fonctionne toujours.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.enforce_fluxitron_inactive()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.source = 'fluxitron' THEN
    NEW.is_active := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fluxitron_inactive ON public.products;
CREATE TRIGGER trg_fluxitron_inactive
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_fluxitron_inactive();

-- Sécurise l'existant (rattrape d'éventuelles lignes miroir actives).
UPDATE public.products SET is_active = false
WHERE source = 'fluxitron' AND is_active = true;
