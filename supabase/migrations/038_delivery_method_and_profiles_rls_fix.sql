-- ========================================
-- TEL & CASH — Migration 038
-- Click & Collect (delivery_method) + fix RLS profiles (auto-promotion role)
-- ========================================

-- 1) Mode de livraison — orthogonal à shipping_method (qui reste le
--    "transporteur" pour le domicile). DEFAULT 'home' : rétrocompatible avec
--    tous les inserts existants (test-order, bons fournisseur, etc.).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'home'
    CHECK (delivery_method IN ('home', 'pickup'));

COMMENT ON COLUMN public.orders.delivery_method IS
  'home = livraison à domicile (shipping_method/shipping_address renseignés) ; '
  'pickup = retrait en boutique Angers (les deux sont alors NULL).';

-- 2) Fix sécurité (trouvé à l'audit, indépendant du Click & Collect) :
--    la policy UPDATE sur profiles n'avait pas de WITH CHECK, donc un
--    utilisateur authentifié pouvait en théorie s'auto-promouvoir
--    (UPDATE profiles SET role='admin' WHERE id=auth.uid()) via l'API
--    PostgREST directe, sans passer par le code Next.js. Le WITH CHECK
--    ci-dessous verrouille role à sa valeur actuelle pour ce chemin RLS —
--    ne touche pas le service_role (BYPASSRLS), donc aucune route admin
--    existante n'est affectée.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );
