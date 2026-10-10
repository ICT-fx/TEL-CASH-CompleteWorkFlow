// Grades CLIENT (boutique) — libellés et batterie minimum garantie.
// SOURCE UNIQUE pour l'affichage côté client (fiche, catalogue, accueil,
// /reconditionnement). L'admin / l'ingestion / Fluxitron gardent leurs propres
// paliers (GRADES dans lib/products.ts) : ne rien importer d'ici côté admin.
//
// Décret 2022-190 : les mentions « comme neuf », « état neuf », « quasi neuf »
// sont INTERDITES pour un produit reconditionné → A = « Parfait état ».

import type { DisplayGrade } from './products';

// Batterie minimum garantie par grade client (en %).
// A : provisoire, à confirmer avec Édouard.
export const GRADE_BATTERY_MIN: Record<DisplayGrade, number> = {
  A: 95,
  B: 92,
  C: 85,
};

export interface ClientGradeCopy {
  letter: DisplayGrade;
  label: string;   // nom affiché (« Parfait état »…)
  sub: string;     // description courte de l'aspect
  battery: number; // minimum garanti (%), = GRADE_BATTERY_MIN
}

export const CLIENT_GRADES: ClientGradeCopy[] = [
  { letter: 'A', label: 'Parfait état',  sub: "Impossible de voir qu'il a servi.",        battery: GRADE_BATTERY_MIN.A },
  { letter: 'B', label: 'Très bon état', sub: 'Micro-rayures, invisibles avec une coque.', battery: GRADE_BATTERY_MIN.B },
  { letter: 'C', label: 'État correct',  sub: 'Des traces, mais il marche parfaitement.',  battery: GRADE_BATTERY_MIN.C },
];

// « Batterie ≥ 95 % » (ou version courte « Batt. ≥ 95 % »).
export function gradeBatteryLabel(letter: DisplayGrade, short = false): string {
  return `${short ? 'Batt.' : 'Batterie'} ≥ ${GRADE_BATTERY_MIN[letter]} %`;
}
