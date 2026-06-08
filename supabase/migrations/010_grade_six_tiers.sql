-- =====================================================================
-- TEL & CASH -- Migration 010
-- Passage à 6 paliers de grade : A+ / A / B+ / B / C+ / C
-- (annule la réduction A/B/C de la migration 008)
-- Foxway/Fluxitron émet les 6 grades — on les conserve tels quels.
-- Ordre commercial : A+ > A > B+ > B > C+ > C (le « + » = un cran au-dessus).
-- À EXÉCUTER dans le Supabase SQL Editor.
-- =====================================================================

-- 1. Drop de la contrainte A/B/C
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_grade_check;

-- 2. Correctif des produits C+ jadis rejetés par l'ancienne règle :
--    grade vidé (null) + tag de rejet, alors que le tag Foxway « grade-c+ »
--    porte l'info. On ré-applique le grade et on retire le tag de rejet.
UPDATE public.products
   SET grade = 'C+'
 WHERE grade IS NULL
   AND 'grade-c+' = ANY(tags);

UPDATE public.products
   SET tags = array_remove(tags, 'rejected-grade-c-plus')
 WHERE 'rejected-grade-c-plus' = ANY(tags);

-- 3. Nouvelle contrainte avec les 6 paliers (null toujours autorisé)
ALTER TABLE public.products
  ADD CONSTRAINT products_grade_check
  CHECK (grade IS NULL OR grade IN ('A+', 'A', 'B+', 'B', 'C+', 'C'));

-- Vérification
SELECT grade, COUNT(*) FROM public.products GROUP BY grade ORDER BY grade;
