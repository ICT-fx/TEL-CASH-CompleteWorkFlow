-- =====================================================================
-- TEL & CASH -- Migration 023
-- Durcissement : fige le search_path des fonctions de normalisation de la
-- migration 022 (advisor Supabase `function_search_path_mutable`).
-- Sûr : ces fonctions ne référencent que des built-ins pg_catalog (toujours
-- résolus) et des fonctions public.* QUALIFIÉES → search_path='' n'altère rien.
-- =====================================================================

ALTER FUNCTION public.fn_norm_text(text)       SET search_path = '';
ALTER FUNCTION public.fn_canonical_model(text) SET search_path = '';
ALTER FUNCTION public.fn_norm_storage(text)    SET search_path = '';
ALTER FUNCTION public.fn_grade_tier(text)      SET search_path = '';
ALTER FUNCTION public.fn_canonical_color(text) SET search_path = '';
