-- Migration 014 : ajoute les grades D et E (mauvais états) à la contrainte.
-- D et E sont conservés comme paliers à part entière mais les produits qui les
-- portent sont désactivés d'office à l'import (jamais publiés sur la boutique).
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_grade_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_grade_check
  CHECK (grade IS NULL OR grade IN ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'E'));
