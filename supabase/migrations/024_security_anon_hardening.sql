-- =====================================================================
-- TEL & CASH -- Migration 024
-- Durcissement sécurité : failles pré-existantes repérées par les advisors
-- Supabase (cf. memory security-anon-rpc-flags).
-- =====================================================================

-- 1) bulk_update_prices() est SECURITY DEFINER et, via les privilèges par défaut
--    du schéma public, exécutable par anon/authenticated -> un visiteur non
--    authentifié pourrait réécrire les prix via /rest/v1/rpc/bulk_update_prices.
--    L'admin l'appelle uniquement via service_role (createAdminClient) -> on
--    révoque les rôles publics et on confirme le grant service_role.
REVOKE ALL ON FUNCTION public.bulk_update_prices(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_prices(jsonb) TO service_role;

-- 2) Tables de backup d'images exposées sans RLS (lisibles par anon via
--    PostgREST). On active RLS sans policy -> deny par défaut pour anon/
--    authenticated ; service_role (et donc l'admin) bypass RLS. Données gardées.
ALTER TABLE public.fluxitron_images_backup_20260621 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_images_backup_20260621     ENABLE ROW LEVEL SECURITY;
