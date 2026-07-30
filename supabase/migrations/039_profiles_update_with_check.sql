-- =====================================================================
-- TEL & CASH -- Migration 039
-- Faille d'élévation de privilèges sur public.profiles : la policy UPDATE
-- créée par la migration 002 (lignes 31-33) n'avait pas de WITH CHECK.
--
--   CREATE POLICY "Users can update own profile"
--     ON public.profiles FOR UPDATE
--     USING (id = auth.uid());          -- <- aucun WITH CHECK
--
-- Quand WITH CHECK est absent, Postgres réutilise l'expression USING pour
-- valider la ligne APRÈS modification. Conséquence : `id = auth.uid()`
-- empêche bien de s'attribuer la ligne d'autrui, mais n'impose RIEN sur les
-- autres colonnes. Un simple PATCH /rest/v1/profiles?id=eq.<moi> avec
-- {"role":"admin"} suffisait donc à se promouvoir administrateur.
--
-- Correctif : on recrée la policy avec un WITH CHECK qui exige, pour un
-- non-admin, que `role` reste identique à sa valeur en base. Les admins
-- conservent un accès complet — d'une part via public.is_admin() dans cette
-- policy, d'autre part via la policy "Admins full access profiles" (FOR ALL),
-- les policies PERMISSIVE étant combinées en OU.
--
-- Pourquoi la sous-requête renvoie bien l'ANCIEN rôle : en READ COMMITTED,
-- une sous-requête voit le snapshot pris au début de l'instruction, donc
-- l'état d'avant l'UPDATE en cours. On compare bien NEW.role à OLD.role.
--
-- Piège de récursion RLS (vérifié explicitement avant écriture) : la
-- sous-requête lit public.profiles depuis une policy portée par cette même
-- table. Elle ne boucle pas, pour trois raisons cumulées :
--   1. une sous-requête SELECT ne déclenche que les policies SELECT, jamais
--      cette policy UPDATE ;
--   2. la policy SELECT applicable est "Users can view own profile"
--      (id = auth.uid()) — elle ne relit pas profiles ;
--   3. l'autre policy applicable appelle public.is_admin(), qui est
--      SECURITY DEFINER et s'exécute donc en tant que `postgres`, lequel est
--      propriétaire de la table (relforcerowsecurity = false) ET rolbypassrls
--      = true : la RLS ne s'y applique pas.
--
-- Aucune fonction n'est créée ici, donc pas de pattern REVOKE/GRANT à
-- appliquer (cf. migrations 024/036/037/038). public.is_admin() garde
-- l'EXECUTE de anon/authenticated : c'est indispensable, une policy est
-- évaluée avec les droits de l'appelant.
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      public.is_admin()
      OR role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

COMMIT;
