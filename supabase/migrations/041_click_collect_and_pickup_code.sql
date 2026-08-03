-- =====================================================================
-- TEL & CASH -- Migration 041
-- Click & Collect (orders.delivery_method) + code de retrait anti-fraude.
--
-- Origine : bloc SQL transmis par un collaborateur sous le numéro « 038 ».
-- Deux écarts assumés par rapport au message d'origine :
--
--   1. RENUMÉROTÉE 038 -> 041. Le 038 est pris (arrondi psychologique),
--      ainsi que le 039 (correctif RLS profiles) et le 040 (search_path).
--
--   2. LE BLOC « DROP POLICY / CREATE POLICY » A ÉTÉ VOLONTAIREMENT RETIRÉ.
--      La faille d'auto-promotion qu'il visait est déjà corrigée en prod par
--      la migration 039, dans une version strictement plus robuste. Rejouer
--      le bloc d'origine remplacerait 039 par une policy dépourvue de la
--      branche `public.is_admin()`, ce qui introduirait un couplage silencieux :
--      les admins ne conserveraient leur droit de modifier `role` QUE grâce à
--      la policy séparée « Admins full access profiles » (FOR ALL, combinée en
--      OU). Vérifié en base, transactions annulées :
--        (a) sous la policy d'origine, l'auto-promotion échoue bien (42501) ;
--        (b) un admin peut toujours promouvoir — via l'autre policy ;
--        (c) en retirant « Admins full access profiles », un admin ne peut
--            PLUS changer de rôle sous la policy d'origine, alors que la
--            version 039 continue de fonctionner seule.
--      Le correctif de sécurité annoncé est donc bien en place : il n'y a
--      rien à réappliquer, et le réappliquer serait une régression.
--
-- Le reste est repris tel quel : que des ajouts de colonnes, un index unique
-- partiel et des commentaires. Aucune fonction SECURITY DEFINER créée, donc
-- pas de pattern REVOKE/GRANT à appliquer ici.
--
-- Note sur pickup_code_verified_by : volontairement SANS clé étrangère vers
-- public.profiles, pour qu'une suppression de compte employé ne bloque pas la
-- ligne de commande ni n'efface la trace du retrait. (Le commentaire du message
-- d'origine renvoyait à une « note ci-dessus » qui n'existait pas ; la voici.)
-- =====================================================================

BEGIN;

-- --- Click & Collect ---------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'home'
    CHECK (delivery_method IN ('home', 'pickup'));

COMMENT ON COLUMN public.orders.delivery_method IS
  'home = livraison à domicile (shipping_method/shipping_address renseignés) ; '
  'pickup = retrait en boutique Angers (les deux sont alors NULL).';

-- --- Code de retrait sécurisé (anti-fraude comptoir) --------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_code              TEXT,
  ADD COLUMN IF NOT EXISTS pickup_code_verified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_code_verified_by  UUID,
  ADD COLUMN IF NOT EXISTS pickup_code_attempts     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_code_locked_until TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_pickup_code
  ON public.orders (pickup_code) WHERE pickup_code IS NOT NULL;

COMMENT ON COLUMN public.orders.pickup_code IS
  'Code de retrait imprévisible (8 car., CSPRNG) — jamais renvoyé par les routes admin, uniquement au client par email.';
COMMENT ON COLUMN public.orders.pickup_code_verified_at IS
  'Horodatage de la vérification réussie en magasin — NULL = pas encore retiré, non-NULL = code déjà consommé (anti-double-retrait).';
COMMENT ON COLUMN public.orders.pickup_code_verified_by IS
  'profiles.id de l''admin/employé ayant validé le code (pas de FK, cf. note en en-tête).';

COMMIT;
