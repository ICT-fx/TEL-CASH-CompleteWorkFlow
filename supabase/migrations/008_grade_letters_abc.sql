-- =====================================================================
-- TEL & CASH -- Migration 008
-- Revert grades to letters A / B / C (3 grades only)
-- Fluxitron Foxway sends A / B / B+ / C / C+ → mapped to A / B / C
-- A executer dans Supabase SQL Editor
-- =====================================================================

-- 1. Drop the existing constraint so we can change values freely
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_grade_check;

-- 2. Migrate French labels back to A / B / C (idempotent)
UPDATE public.products SET grade = 'A' WHERE grade IN ('Parfait État',  'Parfait Etat');
UPDATE public.products SET grade = 'B' WHERE grade IN ('Très Bon État', 'Tres Bon Etat', 'Bon État', 'Bon Etat');
UPDATE public.products SET grade = 'C' WHERE grade IN ('État Correct',  'Etat Correct');

-- 3. Normalise edge cases that may still exist
UPDATE public.products SET grade = 'A' WHERE grade IN ('A+', 'Grade A', 'Excellent', 'Like New');
UPDATE public.products SET grade = 'B' WHERE grade IN ('B+', 'C+', 'Grade B', 'Grade B+', 'Grade C+', 'Very Good', 'Good');
UPDATE public.products SET grade = 'C' WHERE grade IN ('Grade C', 'Acceptable', 'Fair');

-- 4. Re-add the constraint with the canonical A / B / C set
ALTER TABLE public.products
  ADD CONSTRAINT products_grade_check
  CHECK (grade IS NULL OR grade IN ('A', 'B', 'C'));

-- Verification
SELECT grade, COUNT(*) FROM public.products GROUP BY grade ORDER BY grade;
