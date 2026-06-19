-- Écriture des prix EN MASSE via un seul statement SQL.
--
-- Contexte (incident) : recomputeAndWritePrices écrivait les prix produit par
-- produit (des milliers d'UPDATE en parallèle pour une règle globale). Ça
-- saturait le pool de connexions Postgres (60 max), si bien que le middleware
-- — qui fait un auth.getUser() + lecture profiles À CHAQUE requête — ne trouvait
-- plus de connexion → MIDDLEWARE_INVOCATION_TIMEOUT sur tout le site.
--
-- Cette fonction applique TOUTES les mises à jour en un seul UPDATE côté serveur
-- (1 connexion), à partir d'un tableau JSON [{id, price, compare_at_price?}].
-- compare_at_price n'est touché que s'il est présent dans l'objet.

CREATE OR REPLACE FUNCTION public.bulk_update_prices(updates jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH u AS (
    SELECT
      (e->>'id')::uuid                                   AS id,
      (e->>'price')::numeric                             AS price,
      (e ? 'compare_at_price')                           AS has_cap,
      CASE WHEN e ? 'compare_at_price'
           THEN (e->>'compare_at_price')::numeric END    AS cap
    FROM jsonb_array_elements(updates) AS e
  )
  UPDATE public.products p
  SET price = u.price,
      compare_at_price = CASE WHEN u.has_cap THEN u.cap ELSE p.compare_at_price END,
      updated_at = now()
  FROM u
  WHERE p.id = u.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
