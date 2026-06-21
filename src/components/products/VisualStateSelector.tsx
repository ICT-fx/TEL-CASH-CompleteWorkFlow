// Étape 3 (v4) — Sélecteur d'état VISUEL par PHOTOS RÉELLES. Une image par grade
// client (Premium / A / B / C) ; cliquer un grade affiche la photo correspondante.
// Remplace l'ancienne illustration SVG « rayures dynamiques » par de vraies
// photos macro (public/grades/*.png).

'use client';

import { CircleCheck } from 'lucide-react';
import { displayGrade, DISPLAY_GRADE_ORDER, type DisplayGrade } from '@/lib/products';

type Letter = DisplayGrade;

export interface VisualGradeOption {
  letter: Letter;
  name: string;
  sub: string;
  price: number | null;
}

interface Props {
  grades: VisualGradeOption[];
  /** Grade partagé (source de vérité unique, remontée au niveau page). */
  selectedGrade?: string | null;
  /** Remonte le changement de grade au parent → synchronise TOUTE la page. */
  onSelectGrade?: (grade: string) => void;
}

// Photo réelle par grade client (public/grades/*.png).
const GRADE_IMG: Record<DisplayGrade, string> = {
  Premium: '/grades/premium.png',
  A: '/grades/a.png',
  B: '/grades/b.png',
  C: '/grades/c.png',
};

const WEAR_TAG: Record<DisplayGrade, string> = {
  Premium: "Aucun signe d'usure",
  A: "Presque aucun signe d'usure",
  B: "Légers signes d'usure",
  C: "Signes d'usure visibles",
};

export function VisualStateSelector({ grades, selectedGrade, onSelectGrade }: Props) {
  const available = grades.filter((g) => DISPLAY_GRADE_ORDER.includes(g.letter));
  if (available.length === 0) return null;

  // L'état affiché est DÉRIVÉ du grade partagé (pas d'état local dupliqué) : la
  // section reste donc toujours synchronisée avec le sélecteur principal et le
  // reste de la page. Fallback sur le 1er grade dispo si le courant n'en fait
  // pas partie.
  const currentLetter = displayGrade(selectedGrade);
  const activeLetter: Letter = available.some((g) => g.letter === currentLetter)
    ? (currentLetter as Letter)
    : available[0].letter;

  const img = GRADE_IMG[activeLetter];

  return (
    <section className="mt-12 md:mt-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 bg-white border border-[#ECECEC] rounded-[20px] p-5 md:p-6 items-start">
        {/* Colonne visuel */}
        <div>
          <div className="relative bg-[#F4F5F7] rounded-[18px] overflow-hidden min-h-[420px] flex items-center justify-center">
            <span className="absolute top-2.5 right-2.5 z-[2] text-[10px] font-semibold text-white bg-black/55 px-2 py-0.5 rounded-md">
              Photo réelle
            </span>

            <img
              src={img}
              alt={`État ${activeLetter} — ${WEAR_TAG[activeLetter]}`}
              className="h-[400px] max-w-[92%] object-contain"
            />

            <div className="absolute left-3 bottom-3 z-[2] flex flex-wrap gap-1.5 max-w-[92%]">
              <span className="text-[11px] font-semibold text-[#2B2740] bg-white/95 rounded-full px-2.5 py-1">{WEAR_TAG[activeLetter]}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2B2740] bg-white/95 rounded-full px-2.5 py-1">
                <CircleCheck className="w-3.5 h-3.5 text-[#1FA971]" />
                Pièces vérifiées
              </span>
            </div>
          </div>
        </div>

        {/* Colonne explication + options */}
        <div>
          <p className="text-[#4B7BFF] font-caveat text-2xl mb-1">L&apos;état, en images</p>
          <h3 className="text-[23px] font-extrabold text-[#0B1437] mb-2">Voyez la différence</h3>
          <p className="text-[13px] text-[#5A6172] leading-relaxed mb-4">
            Le même téléphone, selon l&apos;état choisi. Les performances, elles, sont identiques — et tout est garanti 24 mois.
          </p>

          {available.map((g) => {
            const on = g.letter === activeLetter;
            const heading = g.letter === 'Premium' ? g.name : `Grade ${g.letter} · ${g.name}`;
            return (
              <button
                key={g.letter}
                onClick={() => onSelectGrade?.(g.letter)}
                className={`flex items-center gap-3 w-full text-left rounded-[13px] px-3.5 py-3 mb-2.5 border transition-all ${
                  on ? 'border-[#2F6BFF] bg-[#F7F9FF] shadow-[0_12px_26px_-20px_rgba(47,107,255,0.45)]' : 'border-[#E8E8E8] bg-white'
                }`}
              >
                <span className={`w-[18px] h-[18px] rounded-full flex-none border-2 ${on ? 'border-[#2F6BFF] bg-[#2F6BFF] shadow-[inset_0_0_0_3px_#fff]' : 'border-[#C9CDD6] bg-white'}`} />
                <span className="flex-1">
                  <b className="block text-sm font-extrabold text-[#0B1437]">{heading}</b>
                  <span className="text-[11px] font-semibold text-[#9AA3B2]">{g.sub}</span>
                </span>
                {g.price != null && <span className="text-sm font-extrabold text-[#0B1437]">{g.price.toFixed(0)} €</span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
