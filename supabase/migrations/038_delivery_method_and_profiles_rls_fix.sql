-- ========================================
-- TEL & CASH — Migration 038
-- Click & Collect (delivery_method) + fix RLS profiles (auto-promotion role)
-- + code de retrait sécurisé (anti-fraude comptoir)
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

-- 3) Code de retrait sécurisé (anti-fraude comptoir) — uniquement pertinent
--    pour delivery_method='pickup'. Généré à la commande payée (CSPRNG,
--    imprévisible, jamais séquentiel — cf. src/lib/pickupCode.ts), révélé au
--    client uniquement par email quand la commande est prête, JAMAIS exposé
--    par les routes admin (seule la vérification côté serveur compte).
--
--    pickup_code_verified_by n'a volontairement PAS de contrainte FK vers
--    profiles : orders a déjà une FK vers profiles via user_id, et PostgREST
--    refuse un embed "profiles" ambigu dès qu'il existe plusieurs FK entre
--    les deux tables — ça casserait tous les select('*, profile:profiles(...))')
--    déjà utilisés partout dans l'admin. L'intégrité est garantie côté
--    application (toujours écrit depuis le profile.id d'un requireAdmin() réussi).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_code TEXT,
  ADD COLUMN IF NOT EXISTS pickup_code_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_code_verified_by UUID,
  ADD COLUMN IF NOT EXISTS pickup_code_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_code_locked_until TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_pickup_code
  ON public.orders (pickup_code) WHERE pickup_code IS NOT NULL;

COMMENT ON COLUMN public.orders.pickup_code IS
  'Code de retrait imprévisible (8 car., CSPRNG) — jamais renvoyé par les routes admin, uniquement au client par email.';
COMMENT ON COLUMN public.orders.pickup_code_verified_at IS
  'Horodatage de la vérification réussie en magasin — NULL = pas encore retiré, non-NULL = code déjà consommé (anti-double-retrait).';
COMMENT ON COLUMN public.orders.pickup_code_verified_by IS
  'profiles.id de l''admin/employé ayant validé le code (pas de FK, cf. note ci-dessus).';
