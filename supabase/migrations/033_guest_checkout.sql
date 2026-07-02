-- ========================================
-- TEL & CASH — Migration 033
-- Guest checkout : commandes sans compte (email comme identifiant)
-- ========================================
-- Jusqu'ici orders.user_id était NOT NULL (FK profiles) → impossible de créer
-- une commande sans compte. On rend user_id NULLABLE et on ajoute guest_email
-- pour les commandes invité. Une commande a désormais SOIT un user_id (client
-- connecté) SOIT un guest_email (invité).
--
-- Sécurité : le webhook Stripe et /api/checkout écrivent via la service role
-- (bypass RLS). Les policies RLS d'orders restent inchangées : une commande
-- invité (user_id NULL) n'est lisible par AUCUN utilisateur authentifié — seuls
-- l'admin et la service role y accèdent, et le client invité est informé par
-- email. C'est le comportement voulu.

ALTER TABLE public.orders
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS guest_email TEXT;

-- Cohérence : une commande doit être rattachée à un compte OU à un email invité.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_owner_present;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_owner_present
  CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL);

COMMENT ON COLUMN public.orders.guest_email IS
  'Email de l''acheteur invité (commande sans compte). NULL si la commande est rattachée à un user_id.';
