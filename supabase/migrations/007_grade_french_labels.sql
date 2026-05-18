-- =====================================================================
-- TEL & CASH -- Migration 007
-- Relax CHECK constraint on products.grade to accept French labels
-- coming from Fluxitron / Foxway mapping
-- A executer dans Supabase SQL Editor
-- =====================================================================

-- 1. Migrate existing A/B/C grades to French labels (idempotent)
UPDATE public.products SET grade = 'Parfait État'   WHERE grade = 'A';
UPDATE public.products SET grade = 'Très Bon État'  WHERE grade = 'B';
UPDATE public.products SET grade = 'État Correct'   WHERE grade = 'C';

-- 2. Drop old constraint if it exists, then add the new one
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_grade_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_grade_check
  CHECK (grade IS NULL OR grade IN ('Parfait État', 'Très Bon État', 'État Correct'));

-- Verification
SELECT grade, COUNT(*) FROM public.products GROUP BY grade ORDER BY grade;
