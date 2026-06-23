-- Pré-lancement — sécurisation anti-survente (suite de la 018).
--   Restauration ATOMIQUE du stock quand une commande payée doit être annulée
--   parce qu'un article s'est révélé indisponible au moment du paiement
--   (le miroir local était périmé vs Foxway). On rend le stock qu'on avait
--   décrémenté pour les AUTRES articles de la même commande avant de rembourser.
--
-- Idempotent : ré-exécutable sans danger (CREATE OR REPLACE).

-- ─────────────────────────────────────────────────────────────────────────────
-- increment_stock : ajoute p_qty au stock d'un produit, sous verrou de ligne.
-- Symétrique de decrement_stock. Retourne le stock résultant, ou -1 si le
-- produit n'existe plus (snapshot conservé dans order_items, produit supprimé).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_stock(p_product_id UUID, p_qty INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  remaining INT;
BEGIN
  UPDATE public.products
     SET stock = stock + p_qty,
         updated_at = now()
   WHERE id = p_product_id
  RETURNING stock INTO remaining;

  IF NOT FOUND THEN
    RETURN -1;  -- produit absent : rien à restaurer
  END IF;

  RETURN remaining;
END;
$$;
